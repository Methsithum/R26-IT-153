"""Filter the question bank, then ask the LLM to pick one id from the shortlist.

The LLM decides among eligible flavour questions. The backend still guarantees
setup coverage and date/mark gates so academic facts cannot be skipped.
"""

from typing import Any, Dict, List, Optional, Sequence

from app.services.journal.llm_service import pick_question_id
from app.services.journal.journal_constants import MARK_RECEIVED_STAGES, is_mark_check_due
from app.models.journal.question import QuestionModel
from app.services.journal.question_bank import QUESTION_BANK, get_question, get_questions, pad_options
from app.services.time_utils import as_of_day, to_local_date

SHORTLIST_SIZE = 20
KIND_ORDER = ("mid", "final", "lab", "quiz")
KIND_PHRASE = {
    "mid": "mid",
    "final": "final",
    "lab": "lab",
    "quiz": "quiz",
}
FORCED_QUESTION_IDS = {
    "lecture-subjects",
    "assignment-subjects",
    "exam-setup",
    "lab-subjects",
    "quiz-subjects",
    "asg-next-assignment",
    "asg-deadline-check",
    "asg-deadline",
    "asg-status",
    "asg-status-b",
    "asg-mark-pick",
    "asg-mark-check",
    "asg-mark-enter",
    "exam-dates-check",
    "exam-dates",
    "exam-mark-pick",
    "exam-mark-check",
    "exam-mark-enter",
}
FORCED_ONLY_STAGES = {
    "lecture_subjects_needed",
    "assignment_subjects_needed",
    "exam_setup_needed",
    "lab_subjects_needed",
    "quiz_subjects_needed",
    "next_assignment_check",
    "deadline_needed",
    "deadline_check",
    "exam_date",
    "exam_date_check",
    "assignment_progress",
    "mark_review",
    "mark_entry",
    "mark_subject_needed",
    "exam_mark_review",
    "exam_mark_entry",
    "exam_mark_subject_needed",
}
ACTIVITY_FLAVOR_PREFIXES = {
    "academic_study": ("study-", "lecture-"),
    "assignment_work": ("asg-", "assignment-"),
    "exam_preparation": ("exam-",),
    "lab_practical": ("lab-",),
    "quiz_work": ("quiz-",),
    "project_development": ("proj-",),
    "internship": ("intern-",),
    "club_participation": ("club-",),
    "event_participation": ("club-",),
    "sports": ("club-",),
    "other": ("day-",),
}


def _exam_label(exam: dict) -> str:
    kind = str(exam.get("exam_type") or "exam").title()
    return f"{exam.get('subject')} · {kind}"


def _exam_kind(exam: dict) -> str:
    return str(exam.get("exam_type") or "").strip().lower()


def _kind_phrase(kind: Optional[str]) -> str:
    key = str(kind or "").strip().lower()
    return KIND_PHRASE.get(key, key or "exam")


def _group_by_kind(exams: Sequence[dict]) -> Dict[str, List[dict]]:
    groups: Dict[str, List[dict]] = {}
    for exam in exams or []:
        kind = _exam_kind(exam) or "exam"
        groups.setdefault(kind, []).append(exam)
    return groups


def _next_kind(groups: Dict[str, List[dict]], asked_kinds: Sequence[str]) -> tuple[Optional[str], List[dict]]:
    asked = {str(k).lower() for k in (asked_kinds or [])}
    for kind in KIND_ORDER:
        if kind in groups and kind not in asked:
            return kind, groups[kind]
    for kind, items in groups.items():
        if kind not in asked:
            return kind, items
    return None, []


def _matches_activities(question: dict, selected: List[str]) -> bool:
    tags = question.get("activities") or []
    if not tags or "*" in tags:
        return True
    return any(tag in selected for tag in tags)


SUBMITTED_SKIP_IDS = {
    "asg-worked",
    "asg-worked-b",
    "asg-worked-c",
    "asg-status",
    "asg-status-b",
    "asg-blockers",
    "asg-next",
    "asg-hours",
    "asg-confidence",
}
SUBMITTED_SKIP_INTENTS = {
    "asg-worked",
    "asg-status",
    "asg-blockers",
    "asg-next",
    "asg-hours",
    "asg-confidence",
}


def _assignment_created_key(task: Dict) -> tuple:
    return (str(task.get("created_at") or ""), str(task.get("id") or ""))


def _assignments_for_subject(tasks: List[Dict], subject: Optional[str]) -> List[Dict]:
    items = [task for task in _assignment_tasks(tasks) if task.get("subject") == subject]
    items.sort(key=_assignment_created_key)
    return items


def _assignment_ordinal(tasks: List[Dict], task: Dict) -> tuple[int, int]:
    siblings = _assignments_for_subject(tasks, task.get("subject"))
    total = len(siblings)
    number = next(
        (index for index, item in enumerate(siblings, start=1) if item.get("id") == task.get("id")),
        1,
    )
    return number, total


def _assignment_ref(subject: Optional[str], number: int = 1, total: int = 1) -> str:
    if not subject:
        return "assignment"
    if total <= 1:
        return f"{subject} assignment"
    return f"{subject} assignment {number}"


def _mark_assignment_rows(unmarked_assignments: List[Dict], tasks: Optional[List[Dict]] = None) -> List[Dict]:
    rows: List[Dict] = []
    catalog = tasks or unmarked_assignments
    for task in unmarked_assignments or []:
        task_id = task.get("id")
        subject = task.get("subject")
        if not task_id or not subject:
            continue
        number, total = _assignment_ordinal(catalog, task)
        title = task.get("title") or _assignment_ref(subject, number, total)
        rows.append({"id": str(task_id), "subject": subject, "title": title})
    return rows


def _assignment_tasks(tasks: List[Dict]) -> List[Dict]:
    return [
        task
        for task in (tasks or [])
        if task.get("subject") and (task.get("task_type") or "assignment") == "assignment"
    ]


def _current_assignment_by_subject(tasks: List[Dict]) -> Dict[str, Dict]:
    current: Dict[str, Dict] = {}
    for task in _assignment_tasks(tasks):
        subject = task.get("subject")
        previous = current.get(subject)
        if not previous or _assignment_created_key(task) > _assignment_created_key(previous):
            current[subject] = task
    return current


def assignment_deadline_passed(task: Optional[Dict], as_of=None) -> bool:
    if not task:
        return False
    day = to_local_date(task.get("deadline"))
    if not day:
        return False
    return day < as_of_day(as_of)


def _open_assignment_subjects(tasks: List[Dict], assignment_subjects: List[str]) -> List[str]:
    current = _current_assignment_by_subject(tasks)
    open_subjects: List[str] = []
    for subject in assignment_subjects or []:
        task = current.get(subject)
        stage = str((task or {}).get("progress_stage") or "").lower()
        if stage not in MARK_RECEIVED_STAGES:
            open_subjects.append(subject)
    return open_subjects


def _subjects_needing_next_assignment(
    tasks: List[Dict],
    assignment_subjects: List[str],
    asked: Optional[List[str]] = None,
    as_of=None,
) -> List[str]:
    already = set(asked or [])
    current = _current_assignment_by_subject(tasks)
    needed: List[str] = []
    for subject in assignment_subjects or []:
        if not subject or subject in already:
            continue
        siblings = _assignments_for_subject(tasks, subject)
        if any(
            str(task.get("progress_stage") or "").lower() not in MARK_RECEIVED_STAGES
            for task in siblings
        ):
            continue
        if assignment_deadline_passed(current.get(subject), as_of):
            needed.append(subject)
    return needed


def _progress_bucket(task: Dict, as_of=None) -> int:
    due = to_local_date(task.get("deadline"))
    as_of = as_of_day(as_of)
    if due and due <= as_of:
        return 0
    if to_local_date(task.get("created_at")) == as_of:
        return 1
    return 2


def _assignment_progress_variant(task: Dict, as_of=None) -> str:
    due = to_local_date(task.get("deadline"))
    as_of = as_of_day(as_of)
    if due and due <= as_of:
        return "due"
    if to_local_date(task.get("created_at")) == as_of:
        return "new"
    return "status"


def _assignments_needing_progress(
    tasks: List[Dict],
    assignment_subjects: List[str],
    asked_ids: Optional[List[str]] = None,
    as_of=None,
) -> List[Dict]:
    wanted = {subject for subject in (assignment_subjects or []) if subject}
    already = set(asked_ids or [])
    needed: List[Dict] = []
    for task in _assignment_tasks(tasks):
        subject = task.get("subject")
        task_id = task.get("id")
        if subject not in wanted or not task_id or task_id in already:
            continue
        stage = str(task.get("progress_stage") or "").lower()
        if stage in MARK_RECEIVED_STAGES:
            continue
        needed.append(task)
    subject_rank = {subject: index for index, subject in enumerate(assignment_subjects or [])}
    needed.sort(
        key=lambda task: (
            _progress_bucket(task, as_of),
            subject_rank.get(task.get("subject"), 99),
            _assignment_created_key(task),
        )
    )
    return needed


def _subjects_needing_deadline(tasks: List[Dict], today_subjects: List[str], as_of=None) -> List[str]:
    current = _current_assignment_by_subject(tasks)
    as_of = as_of_day(as_of)
    needed: List[str] = []
    for subject in today_subjects or []:
        task = current.get(subject)
        if not task or not task.get("deadline"):
            if (
                subject
                and is_mark_check_due((task or {}).get("last_deadline_check"), today=as_of)
                and subject not in needed
            ):
                needed.append(subject)
    for subject, task in current.items():
        if (
            subject
            and not task.get("deadline")
            and is_mark_check_due(task.get("last_deadline_check"), today=as_of)
            and subject not in needed
        ):
            needed.append(subject)
    return needed


def _stage_allowed(question: dict) -> bool:
    stage = question.get("stage") or "daily_checkin"
    return stage not in FORCED_ONLY_STAGES


def _question_covers_activity(question: Optional[dict], activity: str) -> bool:
    if not question:
        return False
    tags = question.get("activities") or []
    if activity in tags:
        return True
    qid = str(question.get("id") or "")
    return any(qid.startswith(prefix) for prefix in ACTIVITY_FLAVOR_PREFIXES.get(activity, ()))


def uncovered_activities(
    selected_activities: List[str],
    asked_ids: List[str],
    *,
    lecture_subjects: List[str],
    assignment_subjects: List[str],
    exam_subjects: List[str],
    exam_kinds: List[str],
    lab_subjects: Optional[List[str]] = None,
    quiz_subjects: Optional[List[str]] = None,
) -> List[str]:
    asked = set(asked_ids or [])
    lab_subjects = lab_subjects or []
    quiz_subjects = quiz_subjects or []
    asked_questions = get_questions(asked_ids or [])
    uncovered: List[str] = []
    for activity in selected_activities or []:
        if activity == "academic_study" and not (lecture_subjects or "lecture-subjects" in asked):
            uncovered.append(activity)
            continue
        if activity == "assignment_work" and not (assignment_subjects or "assignment-subjects" in asked):
            uncovered.append(activity)
            continue
        if activity == "exam_preparation" and not (
            (exam_subjects and exam_kinds) or "exam-setup" in asked
        ):
            uncovered.append(activity)
            continue
        if activity == "lab_practical" and not (lab_subjects or "lab-subjects" in asked):
            uncovered.append(activity)
            continue
        if activity == "quiz_work" and not (quiz_subjects or "quiz-subjects" in asked):
            uncovered.append(activity)
            continue
        flavor_asked = [
            question
            for question in asked_questions
            if question and question.get("id") not in FORCED_QUESTION_IDS
        ]
        if any(_question_covers_activity(question, activity) for question in flavor_asked):
            continue
        uncovered.append(activity)
    return uncovered


def _flavor_intents(intents: Optional[Sequence[str]]) -> List[str]:
    return [intent for intent in (intents or []) if intent and intent not in FORCED_QUESTION_IDS]


def _order_shortlist(sampled: List[dict], selected_activities: List[str], uncovered: Optional[List[str]]) -> List[dict]:
    matching = []
    uncovered_matching = []
    generic = []
    for question in sampled:
        if not question or not _stage_allowed(question):
            continue
        if question.get("activities") == ["*"]:
            generic.append(question)
        elif uncovered and any(tag in uncovered for tag in (question.get("activities") or [])):
            uncovered_matching.append(question)
        elif _matches_activities(question, selected_activities):
            matching.append(question)
    return uncovered_matching + matching + generic


def _bank_shortlist(
    selected_activities: List[str],
    exclude_ids: Sequence[str],
    exclude_intents: Sequence[str],
    uncovered: Optional[List[str]] = None,
) -> List[dict]:
    skip_ids = set(exclude_ids)
    skip_intents = set(exclude_intents)
    sampled = []
    for question in QUESTION_BANK:
        qid = question.get("id")
        intent = question.get("intent_id") or qid
        if question.get("system") or not _stage_allowed(question):
            continue
        if qid in skip_ids or intent in skip_intents:
            continue
        sampled.append(question)
    return _order_shortlist(sampled, selected_activities, uncovered)


def build_shortlist(
    selected_activities: List[str],
    asked_ids: List[str],
    recent_asked_ids: Optional[List[str]] = None,
    uncovered: Optional[List[str]] = None,
    asked_intent_ids: Optional[List[str]] = None,
    recent_intent_ids: Optional[List[str]] = None,
) -> List[dict]:
    asked = set(asked_ids or [])
    recent = {qid for qid in (recent_asked_ids or []) if qid not in FORCED_QUESTION_IDS}
    exclude_ids = list(asked | recent)
    session_intents = _flavor_intents(asked_intent_ids)
    recent_intents = _flavor_intents(recent_intent_ids)
    sampled: List[dict] = []
    try:
        sampled = QuestionModel.flavor_shortlist(
            selected_activities=selected_activities,
            exclude_ids=exclude_ids,
            exclude_intents=session_intents + recent_intents,
            sample_size=80,
        )
        if len(sampled) < 8:
            sampled = QuestionModel.flavor_shortlist(
                selected_activities=selected_activities,
                exclude_ids=exclude_ids,
                exclude_intents=session_intents,
                sample_size=80,
            )
    except Exception:
        sampled = []
    ordered = _order_shortlist(sampled, selected_activities, uncovered)
    if len(ordered) < 8:
        ordered = _bank_shortlist(selected_activities, exclude_ids, session_intents, uncovered)
    return ordered[:SHORTLIST_SIZE]


def hydrate(
    question: Optional[dict],
    *,
    subject: Optional[str] = None,
    missing_exams: Optional[List[Dict]] = None,
    subject_options: Optional[List[str]] = None,
    exam_kind: Optional[str] = None,
    remaining: bool = False,
    deadline: Optional[str] = None,
    task_id: Optional[str] = None,
    assignment_variant: Optional[str] = None,
    assignment_ref: Optional[str] = None,
    mark_assignments: Optional[List[Dict]] = None,
    as_of=None,
) -> Optional[dict]:
    if not question:
        return None
    text = question.get("question") or ""
    options = question.get("options")
    kind = exam_kind or (_exam_kind(missing_exams[0]) if missing_exams else None)
    phrase = _kind_phrase(kind)
    assignment_name = assignment_ref or (f"{subject} assignment" if subject else "assignment")
    mark_assignments = [
        {
            "id": str(item.get("id")),
            "subject": item.get("subject"),
            "title": item.get("title") or item.get("subject"),
        }
        for item in (mark_assignments or [])
        if item.get("id") and item.get("subject")
    ]
    option_labels = subject_options or [item["title"] for item in mark_assignments] or None
    if subject:
        if question.get("stage") == "assignment_progress":
            due = to_local_date(deadline)
            as_of = as_of_day(as_of)
            if assignment_variant == "due" and due:
                due_label = "today" if due == as_of else due.isoformat()
                text = f"Did you submit the {assignment_name} due {due_label}?"
                options = ["Yes, submitted", "Almost done", "Still in progress", "Not started"]
            elif assignment_variant == "new":
                text = f"Is this new {assignment_name} still in progress?"
                options = ["Yes, in progress", "Almost done", "Submitted", "Not started"]
            elif "{subject} assignment" in text:
                text = text.replace("{subject} assignment", assignment_name)
            elif "{subject}" in text:
                text = text.replace("{subject}", subject)
        elif "{subject}" in text:
            text = text.replace("{subject}", subject)
        elif question.get("stage") == "deadline_check":
            text = f"Has the deadline for {subject} been given?"
        elif question.get("stage") == "next_assignment_check":
            text = f"Is this the next assignment for {subject}?"
        elif question.get("stage") == "deadline_needed":
            text = f"When is the deadline for {subject}?"
        elif question.get("stage") == "mark_entry":
            text = f"Log the mark you received for {subject}."
        elif question.get("stage") == "mark_review":
            text = f"Have you received a mark for {subject}?"
    if question.get("stage") == "exam_date_check" and kind:
        if remaining:
            text = f"Have {phrase} dates been released for the other subjects too?"
        else:
            text = f"Have {phrase} dates been released?"
    if question.get("stage") == "exam_date" and missing_exams:
        labels = [_exam_label(e) for e in missing_exams]
        text = f"Confirm the missing {phrase} date{'s' if len(labels) > 1 else ''}: {', '.join(labels)}."
    if question.get("stage") == "exam_mark_subject_needed" and missing_exams:
        labels = [_exam_label(e) for e in missing_exams]
        text = f"Which {phrase} result do you want to log? {', '.join(labels)}."
    if question.get("stage") == "mark_subject_needed" and option_labels:
        text = f"Which assignment do you want to log a mark for? {', '.join(option_labels)}."
    if question.get("stage") == "exam_mark_review" and kind:
        if remaining:
            text = f"Did {phrase} results come out for the other subjects too?"
        else:
            text = f"Have {phrase} results come out?"
    if question.get("stage") == "exam_mark_entry" and missing_exams:
        label = _exam_label(missing_exams[0])
        if _exam_kind(missing_exams[0]) == "final" or kind == "final":
            text = f"Fill the vial for the letter grade you received in {label}."
        else:
            text = f"Log the mark you received for {label}."
    return {
        **question,
        "question": text,
        "options": pad_options(options),
        "subject": subject,
        "missing_exams": missing_exams or None,
        "subject_options": option_labels,
        "exam_kind": kind,
        "task_id": task_id,
        "deadline": deadline,
        "assignment_ref": assignment_name if subject else None,
        "mark_assignments": mark_assignments or None,
    }


def _forced_setup_question(
    selected: List[str],
    lecture_subjects: List[str],
    assignment_subjects: List[str],
    exam_subjects: List[str],
    exam_kinds: List[str],
    registered_subjects: List[str],
    lab_subjects: Optional[List[str]] = None,
    quiz_subjects: Optional[List[str]] = None,
) -> Optional[dict]:
    if not registered_subjects:
        return None
    lab_subjects = lab_subjects or []
    quiz_subjects = quiz_subjects or []
    if "academic_study" in selected and not lecture_subjects:
        return get_question("lecture-subjects")
    if "assignment_work" in selected and not assignment_subjects:
        return get_question("assignment-subjects")
    if "exam_preparation" in selected and (not exam_subjects or not exam_kinds):
        return get_question("exam-setup")
    if "lab_practical" in selected and not lab_subjects:
        return get_question("lab-subjects")
    if "quiz_work" in selected and not quiz_subjects:
        return get_question("quiz-subjects")
    return None


def _forced_next_assignment(
    selected: List[str],
    tasks: List[Dict],
    assignment_subjects: List[str],
    asked_next_assignment_subjects: Optional[List[str]] = None,
    as_of=None,
) -> Optional[Dict[str, Any]]:
    if "assignment_work" not in (selected or []):
        return None
    needed = _subjects_needing_next_assignment(
        tasks, assignment_subjects, asked_next_assignment_subjects, as_of=as_of
    )
    if not needed:
        return None
    return {
        "question": get_question("asg-next-assignment"),
        "subject": needed[0],
        "missing_exams": None,
        "subject_options": None,
    }


def _forced_assignment_progress(
    selected: List[str],
    tasks: List[Dict],
    assignment_subjects: List[str],
    asked_assignment_progress_ids: Optional[List[str]] = None,
    as_of=None,
) -> Optional[Dict[str, Any]]:
    if "assignment_work" not in (selected or []):
        return None
    needed = _assignments_needing_progress(
        tasks, assignment_subjects, asked_assignment_progress_ids, as_of=as_of
    )
    if not needed:
        return None
    task = needed[0]
    number, total = _assignment_ordinal(tasks, task)
    return {
        "question": get_question("asg-status"),
        "subject": task.get("subject"),
        "deadline": task.get("deadline"),
        "task_id": task.get("id"),
        "assignment_variant": _assignment_progress_variant(task, as_of),
        "assignment_ref": _assignment_ref(task.get("subject"), number, total),
        "missing_exams": None,
        "subject_options": None,
    }


def _forced_date_followup(
    selected: List[str],
    tasks: List[Dict],
    assignment_subjects: List[str],
    missing_exams: List[Dict],
    asked_deadline_subjects: Optional[List[str]] = None,
    asked_exam_date_kinds: Optional[List[str]] = None,
    pending_exam_date_kind: Optional[str] = None,
    dated_exam_kinds: Optional[Sequence[str]] = None,
    as_of=None,
) -> Optional[Dict[str, Any]]:
    already_checked = set(asked_deadline_subjects or [])
    dated_kinds = {str(k).lower() for k in (dated_exam_kinds or [])}
    needed = [
        subject
        for subject in _subjects_needing_deadline(tasks, assignment_subjects, as_of=as_of)
        if subject not in already_checked
    ]
    if needed:
        return {
            "question": get_question("asg-deadline-check"),
            "subject": needed[0],
            "missing_exams": None,
            "subject_options": None,
        }
    if pending_exam_date_kind:
        remaining = [exam for exam in missing_exams if _exam_kind(exam) == pending_exam_date_kind]
        if remaining:
            return {
                "question": get_question("exam-dates"),
                "subject": remaining[0].get("subject"),
                "missing_exams": remaining,
                "subject_options": None,
                "exam_kind": pending_exam_date_kind,
                "remaining": pending_exam_date_kind in dated_kinds,
            }
    kind, group = _next_kind(_group_by_kind(missing_exams), asked_exam_date_kinds or [])
    if kind and group:
        return {
            "question": get_question("exam-dates-check"),
            "subject": group[0].get("subject"),
            "missing_exams": group,
            "subject_options": None,
            "exam_kind": kind,
            "remaining": kind in dated_kinds,
        }
    return None


def _forced_mark_followup(
    unmarked_exams: List[Dict],
    unmarked_assignments: List[Dict],
    pending_mark_exam_id: Optional[str],
    pending_mark_subject: Optional[str],
    pending_exam_mark_kind: Optional[str] = None,
    asked_exam_mark_kinds: Optional[List[str]] = None,
    marked_exam_kinds: Optional[Sequence[str]] = None,
    asked_ids: Optional[List[str]] = None,
    confirmed_assignment_marks: bool = False,
    pending_mark_task_id: Optional[str] = None,
    tasks: Optional[List[Dict]] = None,
) -> Optional[Dict[str, Any]]:
    marked_kinds = {str(k).lower() for k in (marked_exam_kinds or [])}

    if pending_mark_exam_id:
        target = next(
            (exam for exam in unmarked_exams if str(exam.get("id")) == str(pending_mark_exam_id)),
            None,
        )
        if target:
            return {
                "question": get_question("exam-mark-enter"),
                "missing_exams": [target],
                "subject": target.get("subject"),
                "subject_options": None,
                "exam_kind": _exam_kind(target),
            }

    if pending_exam_mark_kind:
        remaining = [exam for exam in unmarked_exams if _exam_kind(exam) == pending_exam_mark_kind]
        if len(remaining) == 1:
            return {
                "question": get_question("exam-mark-enter"),
                "missing_exams": remaining,
                "subject": remaining[0].get("subject"),
                "subject_options": None,
                "exam_kind": pending_exam_mark_kind,
            }
        if remaining:
            return {
                "question": get_question("exam-mark-pick"),
                "missing_exams": remaining,
                "subject": None,
                "subject_options": [_exam_label(exam) for exam in remaining],
                "exam_kind": pending_exam_mark_kind,
            }

    kind, group = _next_kind(_group_by_kind(unmarked_exams), asked_exam_mark_kinds or [])
    if kind and group:
        return {
            "question": get_question("exam-mark-check"),
            "missing_exams": group,
            "subject": group[0].get("subject"),
            "subject_options": None,
            "exam_kind": kind,
            "remaining": kind in marked_kinds,
        }

    ready = _mark_assignment_rows(unmarked_assignments, tasks)
    labels = [item["title"] for item in ready]

    if pending_mark_task_id:
        match = next(
            (item for item in ready if item["id"] == str(pending_mark_task_id)),
            None,
        )
        if match:
            return {
                "question": get_question("asg-mark-enter"),
                "missing_exams": None,
                "subject": match["subject"],
                "task_id": match["id"],
                "subject_options": None,
                "mark_assignments": [match],
            }

    if pending_mark_subject:
        match = next(
            (item for item in ready if item.get("subject") == pending_mark_subject),
            None,
        )
        if match:
            return {
                "question": get_question("asg-mark-enter"),
                "missing_exams": None,
                "subject": match["subject"],
                "task_id": match["id"],
                "subject_options": None,
                "mark_assignments": [match],
            }

    if ready:
        asked = set(asked_ids or [])
        already_confirmed = confirmed_assignment_marks or "asg-mark-check" in asked
        if already_confirmed:
            if len(ready) > 1:
                return {
                    "question": get_question("asg-mark-pick"),
                    "missing_exams": None,
                    "subject": None,
                    "subject_options": labels,
                    "mark_assignments": ready,
                }
            return {
                "question": get_question("asg-mark-enter"),
                "missing_exams": None,
                "subject": ready[0]["subject"],
                "task_id": ready[0]["id"],
                "subject_options": None,
                "mark_assignments": ready,
            }
        return {
            "question": get_question("asg-mark-check"),
            "missing_exams": None,
            "subject": ready[0]["subject"] if len(ready) == 1 else None,
            "task_id": ready[0]["id"] if len(ready) == 1 else None,
            "subject_options": labels if len(ready) > 1 else None,
            "mark_assignments": ready,
        }
    return None


def _prefer_followup(shortlist: List[dict], qa_history: List[Dict], uncovered: List[str]) -> List[dict]:
    if not shortlist or not qa_history:
        return shortlist
    last = qa_history[-1]
    last_id = str(last.get("question_id") or "")
    last_q = get_question(last_id)
    if not last_q:
        return shortlist
    last_tags = [tag for tag in (last_q.get("activities") or []) if tag != "*"]
    if not last_tags:
        return shortlist
    follow = [q for q in shortlist if any(tag in (q.get("activities") or []) for tag in last_tags)]
    if not follow:
        return shortlist
    # After one follow-up beat, rotate to an uncovered activity if one exists.
    last_activity = last_tags[0]
    if last_activity not in uncovered:
        rotate = [q for q in shortlist if any(tag in uncovered for tag in (q.get("activities") or []))]
        if rotate:
            return rotate + [q for q in shortlist if q not in rotate]
    return follow + [q for q in shortlist if q not in follow]


def _hydrate_forced(payload: Dict[str, Any], as_of=None) -> dict:
    return hydrate(
        payload["question"],
        subject=payload.get("subject"),
        missing_exams=payload.get("missing_exams"),
        subject_options=payload.get("subject_options"),
        exam_kind=payload.get("exam_kind"),
        remaining=bool(payload.get("remaining")),
        deadline=payload.get("deadline"),
        task_id=payload.get("task_id"),
        assignment_variant=payload.get("assignment_variant"),
        assignment_ref=payload.get("assignment_ref"),
        mark_assignments=payload.get("mark_assignments"),
        as_of=as_of,
    )


async def pick_next_question(
    *,
    user_name: str,
    selected_activities: List[str],
    asked_ids: List[str],
    qa_history: List[Dict],
    tasks: List[Dict],
    session_context: Optional[Dict[str, Any]] = None,
    total_questions_asked: int = 0,
    max_questions: int = 12,
    today_subjects: Optional[List[str]] = None,
    lecture_subjects: Optional[List[str]] = None,
    assignment_subjects: Optional[List[str]] = None,
    exam_subjects: Optional[List[str]] = None,
    exam_kinds: Optional[List[str]] = None,
    lab_subjects: Optional[List[str]] = None,
    quiz_subjects: Optional[List[str]] = None,
    registered_subjects: Optional[List[str]] = None,
    missing_exams: Optional[List[Dict]] = None,
    unmarked_exams: Optional[List[Dict]] = None,
    unmarked_assignments: Optional[List[Dict]] = None,
    pending_mark_exam_id: Optional[str] = None,
    pending_mark_subject: Optional[str] = None,
    pending_mark_task_id: Optional[str] = None,
    pending_exam_date_kind: Optional[str] = None,
    pending_exam_mark_kind: Optional[str] = None,
    confirmed_assignment_marks: bool = False,
    asked_deadline_subjects: Optional[List[str]] = None,
    asked_exam_date_kinds: Optional[List[str]] = None,
    asked_exam_mark_kinds: Optional[List[str]] = None,
    dated_exam_kinds: Optional[List[str]] = None,
    marked_exam_kinds: Optional[List[str]] = None,
    recent_asked_ids: Optional[List[str]] = None,
    asked_intent_ids: Optional[List[str]] = None,
    recent_intent_ids: Optional[List[str]] = None,
    asked_next_assignment_subjects: Optional[List[str]] = None,
    asked_assignment_progress_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    today_subjects = today_subjects or []
    lecture_subjects = lecture_subjects or []
    assignment_subjects = assignment_subjects or []
    exam_subjects = exam_subjects or []
    exam_kinds = exam_kinds or []
    lab_subjects = lab_subjects or []
    quiz_subjects = quiz_subjects or []
    registered_subjects = registered_subjects or []
    missing_exams = missing_exams or []
    unmarked_exams = unmarked_exams or []
    unmarked_assignments = unmarked_assignments or []
    asked_deadline_subjects = asked_deadline_subjects or []
    asked_exam_date_kinds = asked_exam_date_kinds or []
    asked_exam_mark_kinds = asked_exam_mark_kinds or []
    dated_exam_kinds = dated_exam_kinds or []
    marked_exam_kinds = marked_exam_kinds or []
    recent_asked_ids = recent_asked_ids or []
    asked_intent_ids = asked_intent_ids or QuestionModel.intents_for_ids(asked_ids)
    recent_intent_ids = recent_intent_ids or []
    asked_next_assignment_subjects = asked_next_assignment_subjects or []
    asked_assignment_progress_ids = asked_assignment_progress_ids or []
    as_of = as_of_day((session_context or {}).get("journal_date"))

    forced = _forced_setup_question(
        selected_activities,
        lecture_subjects,
        assignment_subjects,
        exam_subjects,
        exam_kinds,
        registered_subjects,
        lab_subjects,
        quiz_subjects,
    )
    if forced:
        return {
            "end_session": False,
            "question": hydrate(forced, subject_options=registered_subjects),
            "task_updates": [],
        }

    next_assignment = _forced_next_assignment(
        selected_activities,
        tasks,
        assignment_subjects,
        asked_next_assignment_subjects,
        as_of=as_of,
    )
    if next_assignment and next_assignment.get("question"):
        return {"end_session": False, "question": _hydrate_forced(next_assignment, as_of), "task_updates": []}

    date_followup = _forced_date_followup(
        selected_activities,
        tasks,
        assignment_subjects,
        missing_exams,
        asked_deadline_subjects,
        asked_exam_date_kinds,
        pending_exam_date_kind,
        dated_exam_kinds,
        as_of=as_of,
    )
    if date_followup and date_followup.get("question"):
        return {"end_session": False, "question": _hydrate_forced(date_followup, as_of), "task_updates": []}

    progress_followup = _forced_assignment_progress(
        selected_activities,
        tasks,
        assignment_subjects,
        asked_assignment_progress_ids,
        as_of=as_of,
    )
    if progress_followup and progress_followup.get("question"):
        return {"end_session": False, "question": _hydrate_forced(progress_followup, as_of), "task_updates": []}

    mark_followup = _forced_mark_followup(
        unmarked_exams,
        unmarked_assignments,
        pending_mark_exam_id,
        pending_mark_subject,
        pending_exam_mark_kind,
        asked_exam_mark_kinds,
        marked_exam_kinds,
        asked_ids,
        confirmed_assignment_marks,
        pending_mark_task_id,
        tasks,
    )
    if mark_followup and mark_followup.get("question"):
        return {"end_session": False, "question": _hydrate_forced(mark_followup, as_of), "task_updates": []}

    uncovered = uncovered_activities(
        selected_activities,
        asked_ids,
        lecture_subjects=lecture_subjects,
        assignment_subjects=assignment_subjects,
        exam_subjects=exam_subjects,
        exam_kinds=exam_kinds,
        lab_subjects=lab_subjects,
        quiz_subjects=quiz_subjects,
    )
    if not _open_assignment_subjects(tasks, assignment_subjects):
        uncovered = [activity for activity in uncovered if activity != "assignment_work"]
    hard_cap = max_questions + 8
    if total_questions_asked >= hard_cap:
        return {"end_session": True, "question": None, "task_updates": []}
    if total_questions_asked >= max_questions and not uncovered:
        return {"end_session": True, "question": None, "task_updates": []}

    shortlist = build_shortlist(
        selected_activities,
        asked_ids,
        recent_asked_ids,
        uncovered,
        asked_intent_ids=asked_intent_ids,
        recent_intent_ids=recent_intent_ids,
    )
    if not _open_assignment_subjects(tasks, assignment_subjects):
        shortlist = [
            question
            for question in shortlist
            if question["id"] not in SUBMITTED_SKIP_IDS
            and (question.get("intent_id") or question["id"]) not in SUBMITTED_SKIP_INTENTS
        ]
    shortlist = _prefer_followup(shortlist, qa_history, uncovered)
    if not shortlist:
        return {"end_session": True, "question": None, "task_updates": []}

    decision = await pick_question_id(
        user_name=user_name,
        selected_activities=selected_activities,
        qa_history=qa_history,
        tasks=tasks,
        candidates=shortlist,
        session_context=session_context,
        total_questions_asked=total_questions_asked,
        max_questions=max_questions,
        uncovered_activities=uncovered,
    )

    task_updates = decision.get("task_updates") or []
    if decision.get("end_session"):
        if uncovered:
            chosen = shortlist[0]
        else:
            return {"end_session": True, "question": None, "task_updates": task_updates}
    else:
        chosen_id = decision.get("question_id")
        chosen = get_question(chosen_id) if chosen_id else None
        if chosen is None:
            chosen = shortlist[0]

    mark_qids = {"asg-mark-pick", "asg-mark-enter", "asg-mark-check"}
    if chosen and chosen.get("id") in mark_qids:
        if mark_followup and mark_followup.get("question"):
            return {
                "end_session": False,
                "question": _hydrate_forced(mark_followup, as_of),
                "task_updates": task_updates,
            }
        chosen = next((question for question in shortlist if question.get("id") not in mark_qids), None)
        if not chosen:
            return {"end_session": True, "question": None, "task_updates": task_updates}

    subject = None
    exams_for_q = None
    if lecture_subjects and "academic_study" in (chosen.get("activities") or []):
        subject = lecture_subjects[0]
    elif assignment_subjects:
        subject = assignment_subjects[0]
    elif lecture_subjects:
        subject = lecture_subjects[0]
    elif today_subjects:
        subject = today_subjects[0]

    return {
        "end_session": False,
        "question": hydrate(
            chosen,
            subject=subject,
            missing_exams=exams_for_q,
            subject_options=registered_subjects,
            as_of=as_of,
        ),
        "task_updates": task_updates,
    }
