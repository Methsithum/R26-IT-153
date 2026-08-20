"""Filter the question bank, then ask the LLM to pick one id from the shortlist.

The LLM decides among eligible flavour questions. The backend still guarantees
setup coverage and date/mark gates so academic facts cannot be skipped.
"""

from typing import Any, Dict, List, Optional, Sequence

from app.services.journal.llm_service import pick_question_id
from app.services.journal.journal_constants import is_mark_check_due
from app.services.journal.question_bank import QUESTION_BANK, get_question, pad_options

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
    "asg-deadline-check",
    "asg-deadline",
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
    "deadline_needed",
    "deadline_check",
    "exam_date",
    "exam_date_check",
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


def _subjects_needing_deadline(tasks: List[Dict], today_subjects: List[str]) -> List[str]:
    assignment_tasks = [
        task
        for task in tasks
        if task.get("subject") and (task.get("task_type") or "assignment") == "assignment"
    ]
    by_subject = {task.get("subject"): task for task in assignment_tasks}
    needed: List[str] = []
    for subject in today_subjects:
        task = by_subject.get(subject)
        if not task or not task.get("deadline"):
            if subject and is_mark_check_due((task or {}).get("last_deadline_check")) and subject not in needed:
                needed.append(subject)
    for task in assignment_tasks:
        subject = task.get("subject")
        if (
            subject
            and not task.get("deadline")
            and is_mark_check_due(task.get("last_deadline_check"))
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
    asked_questions = [get_question(qid) for qid in asked_ids or []]
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


def build_shortlist(
    selected_activities: List[str],
    asked_ids: List[str],
    recent_asked_ids: Optional[List[str]] = None,
    uncovered: Optional[List[str]] = None,
) -> List[dict]:
    asked = set(asked_ids or [])
    recent = {qid for qid in (recent_asked_ids or []) if qid not in FORCED_QUESTION_IDS}
    matching = []
    uncovered_matching = []
    generic = []
    for question in QUESTION_BANK:
        qid = question["id"]
        if qid in asked or qid in recent:
            continue
        if not _stage_allowed(question):
            continue
        if _matches_activities(question, selected_activities):
            if question.get("activities") == ["*"]:
                generic.append(question)
            elif uncovered and any(tag in uncovered for tag in (question.get("activities") or [])):
                uncovered_matching.append(question)
            else:
                matching.append(question)
    ordered = uncovered_matching + matching + generic
    return ordered[:SHORTLIST_SIZE]


def hydrate(
    question: Optional[dict],
    *,
    subject: Optional[str] = None,
    missing_exams: Optional[List[Dict]] = None,
    subject_options: Optional[List[str]] = None,
    exam_kind: Optional[str] = None,
    remaining: bool = False,
) -> Optional[dict]:
    if not question:
        return None
    text = question.get("question") or ""
    kind = exam_kind or (_exam_kind(missing_exams[0]) if missing_exams else None)
    phrase = _kind_phrase(kind)
    if subject:
        if "{subject}" in text:
            text = text.replace("{subject}", subject)
        elif question.get("stage") == "deadline_check":
            text = f"Has the deadline for {subject} been given?"
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
    if question.get("stage") == "mark_subject_needed" and subject_options:
        text = f"Which assignment do you want to log a mark for? {', '.join(subject_options)}."
    if question.get("stage") == "exam_mark_review" and kind:
        if remaining:
            text = f"Did {phrase} results come out for the other subjects too?"
        else:
            text = f"Have {phrase} results come out?"
    if question.get("stage") == "exam_mark_entry" and missing_exams:
        text = f"Log the mark you received for {_exam_label(missing_exams[0])}."
    return {
        **question,
        "question": text,
        "options": pad_options(question.get("options")),
        "subject": subject,
        "missing_exams": missing_exams or None,
        "subject_options": subject_options or None,
        "exam_kind": kind,
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


def _forced_date_followup(
    selected: List[str],
    tasks: List[Dict],
    assignment_subjects: List[str],
    missing_exams: List[Dict],
    asked_deadline_subjects: Optional[List[str]] = None,
    asked_exam_date_kinds: Optional[List[str]] = None,
    pending_exam_date_kind: Optional[str] = None,
    dated_exam_kinds: Optional[Sequence[str]] = None,
) -> Optional[Dict[str, Any]]:
    already_checked = set(asked_deadline_subjects or [])
    dated_kinds = {str(k).lower() for k in (dated_exam_kinds or [])}
    needed = [
        subject
        for subject in _subjects_needing_deadline(tasks, assignment_subjects)
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

    if pending_mark_subject:
        match = next(
            (task for task in unmarked_assignments if task.get("subject") == pending_mark_subject),
            None,
        )
        if match:
            return {
                "question": get_question("asg-mark-enter"),
                "missing_exams": None,
                "subject": pending_mark_subject,
                "subject_options": None,
            }

    if unmarked_assignments:
        subjects = list(
            dict.fromkeys(task.get("subject") for task in unmarked_assignments if task.get("subject"))
        )
        if not subjects:
            return None
        asked = set(asked_ids or [])
        already_confirmed = confirmed_assignment_marks or "asg-mark-check" in asked
        if already_confirmed:
            if len(subjects) > 1:
                return {
                    "question": get_question("asg-mark-pick"),
                    "missing_exams": None,
                    "subject": None,
                    "subject_options": subjects,
                }
            return {
                "question": get_question("asg-mark-enter"),
                "missing_exams": None,
                "subject": subjects[0],
                "subject_options": None,
            }
        return {
            "question": get_question("asg-mark-check"),
            "missing_exams": None,
            "subject": subjects[0] if len(subjects) == 1 else None,
            "subject_options": subjects if len(subjects) > 1 else None,
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


def _hydrate_forced(payload: Dict[str, Any]) -> dict:
    return hydrate(
        payload["question"],
        subject=payload.get("subject"),
        missing_exams=payload.get("missing_exams"),
        subject_options=payload.get("subject_options"),
        exam_kind=payload.get("exam_kind"),
        remaining=bool(payload.get("remaining")),
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
    pending_exam_date_kind: Optional[str] = None,
    pending_exam_mark_kind: Optional[str] = None,
    confirmed_assignment_marks: bool = False,
    asked_deadline_subjects: Optional[List[str]] = None,
    asked_exam_date_kinds: Optional[List[str]] = None,
    asked_exam_mark_kinds: Optional[List[str]] = None,
    dated_exam_kinds: Optional[List[str]] = None,
    marked_exam_kinds: Optional[List[str]] = None,
    recent_asked_ids: Optional[List[str]] = None,
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

    date_followup = _forced_date_followup(
        selected_activities,
        tasks,
        assignment_subjects,
        missing_exams,
        asked_deadline_subjects,
        asked_exam_date_kinds,
        pending_exam_date_kind,
        dated_exam_kinds,
    )
    if date_followup and date_followup.get("question"):
        return {"end_session": False, "question": _hydrate_forced(date_followup), "task_updates": []}

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
    )
    if mark_followup and mark_followup.get("question"):
        return {"end_session": False, "question": _hydrate_forced(mark_followup), "task_updates": []}

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
    )
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
        ),
        "task_updates": task_updates,
    }
