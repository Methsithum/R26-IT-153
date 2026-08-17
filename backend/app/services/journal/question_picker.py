"""Filter the question bank, then ask the LLM to pick one id from the shortlist."""

from typing import Any, Dict, List, Optional

from app.services.journal.llm_service import pick_question_id
from app.services.journal.question_bank import QUESTION_BANK, get_question, pad_options

SHORTLIST_SIZE = 20
MARK_CHECK_IDS = {"exam-mark-check", "exam-mark-enter", "asg-mark-check", "asg-mark-enter"}
DEADLINE_CHECK_IDS = {"asg-deadline-check", "asg-deadline"}
EXAM_DATE_CHECK_IDS = {"exam-dates-check", "exam-dates"}
FORCED_ONLY_STAGES = {
    "lecture_subjects_needed",
    "assignment_subjects_needed",
    "exam_setup_needed",
    "deadline_needed",
    "deadline_check",
    "exam_date",
    "exam_date_check",
}
MARK_STAGES = {
    "mark_review",
    "mark_entry",
    "mark_subject_needed",
    "exam_mark_review",
    "exam_mark_entry",
    "exam_mark_subject_needed",
}


def _exam_label(exam: dict) -> str:
    kind = str(exam.get("exam_type") or "exam").title()
    return f"{exam.get('subject')} · {kind}"


def _matches_activities(question: dict, selected: List[str]) -> bool:
    tags = question.get("activities") or []
    if not tags or "*" in tags:
        return True
    return any(tag in selected for tag in tags)


def _subjects_needing_deadline(tasks: List[Dict], today_subjects: List[str]) -> List[str]:
    by_subject = {t.get("subject"): t for t in tasks if t.get("subject")}
    needed = []
    for subject in today_subjects:
        task = by_subject.get(subject)
        if not task or not task.get("deadline"):
            needed.append(subject)
    return needed


def _stage_allowed(
    question: dict,
    tasks: List[Dict],
    selected: List[str],
    assignment_subjects: List[str],
    missing_exams: List[Dict],
    unmarked_exams: Optional[List[Dict]] = None,
    unmarked_assignments: Optional[List[Dict]] = None,
    asked_ids: Optional[List[str]] = None,
) -> bool:
    stage = question.get("stage") or "daily_checkin"
    unmarked_exams = unmarked_exams or []
    unmarked_assignments = unmarked_assignments or []
    asked = set(asked_ids or [])
    if stage in FORCED_ONLY_STAGES:
        return False
    if stage in MARK_STAGES and asked & MARK_CHECK_IDS:
        return False
    if stage == "mark_subject_needed":
        return len(unmarked_assignments) > 1
    if stage in {"mark_review", "mark_entry"}:
        return bool(unmarked_assignments)
    if stage == "exam_mark_subject_needed":
        return len(unmarked_exams) > 1
    if stage in {"exam_mark_review", "exam_mark_entry"}:
        return bool(unmarked_exams)
    return True


def build_shortlist(
    selected_activities: List[str],
    asked_ids: List[str],
    tasks: List[Dict],
    assignment_subjects: Optional[List[str]] = None,
    missing_exams: Optional[List[Dict]] = None,
    unmarked_exams: Optional[List[Dict]] = None,
    unmarked_assignments: Optional[List[Dict]] = None,
) -> List[dict]:
    asked = set(asked_ids or [])
    assignment_subjects = assignment_subjects or []
    missing_exams = missing_exams or []
    unmarked_exams = unmarked_exams or []
    unmarked_assignments = unmarked_assignments or []
    matching = []
    generic = []
    for question in QUESTION_BANK:
        if question["id"] in asked:
            continue
        if not _stage_allowed(
            question,
            tasks,
            selected_activities,
            assignment_subjects,
            missing_exams,
            unmarked_exams,
            unmarked_assignments,
            asked_ids,
        ):
            continue
        if _matches_activities(question, selected_activities):
            if question.get("activities") == ["*"]:
                generic.append(question)
            else:
                matching.append(question)
    ordered = matching + generic
    return ordered[:SHORTLIST_SIZE]


def hydrate(
    question: Optional[dict],
    *,
    subject: Optional[str] = None,
    missing_exams: Optional[List[Dict]] = None,
    subject_options: Optional[List[str]] = None,
) -> Optional[dict]:
    if not question:
        return None
    text = question.get("question") or ""
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
    if question.get("stage") == "exam_date_check" and missing_exams:
        labels = [_exam_label(e) for e in missing_exams]
        if len(labels) == 1:
            text = f"Have {labels[0]} dates been released?"
        else:
            text = f"Have exam dates been released for {', '.join(labels)}?"
    if question.get("stage") == "exam_date" and missing_exams:
        labels = [_exam_label(e) for e in missing_exams]
        text = f"Confirm the missing exam date{'s' if len(labels) > 1 else ''}: {', '.join(labels)}."
    if question.get("stage") == "exam_mark_subject_needed" and missing_exams:
        labels = [_exam_label(e) for e in missing_exams]
        text = f"Which exam result do you want to log? {', '.join(labels)}."
    if question.get("stage") == "mark_subject_needed" and subject_options:
        text = f"Which assignment do you want to log a mark for? {', '.join(subject_options)}."
    if question.get("stage") in {"exam_mark_review", "exam_mark_entry"} and missing_exams:
        label = _exam_label(missing_exams[0])
        if question.get("stage") == "exam_mark_entry":
            text = f"Log the mark you received for {label}."
        else:
            text = f"Have you received a mark for {label}?"
    return {
        **question,
        "question": text,
        "options": pad_options(question.get("options")),
        "subject": subject,
        "missing_exams": missing_exams or None,
        "subject_options": subject_options or None,
    }


def _forced_setup_question(
    selected: List[str],
    lecture_subjects: List[str],
    assignment_subjects: List[str],
    exam_subjects: List[str],
    exam_kinds: List[str],
    registered_subjects: List[str],
) -> Optional[dict]:
    if not registered_subjects:
        return None
    if "academic_study" in selected and not lecture_subjects:
        return get_question("lecture-subjects")
    if "assignment_work" in selected and not assignment_subjects:
        return get_question("assignment-subjects")
    if "exam_preparation" in selected and (not exam_subjects or not exam_kinds):
        return get_question("exam-setup")
    return None


def _forced_date_followup(
    selected: List[str],
    asked_ids: List[str],
    tasks: List[Dict],
    assignment_subjects: List[str],
    missing_exams: List[Dict],
) -> Optional[Dict[str, Any]]:
    asked = set(asked_ids or [])
    if "assignment_work" in selected and not (asked & DEADLINE_CHECK_IDS):
        needed = _subjects_needing_deadline(tasks, assignment_subjects)
        if needed:
            return {
                "question": get_question("asg-deadline-check"),
                "subject": needed[0],
                "missing_exams": None,
                "subject_options": None,
            }
    if "exam_preparation" in selected and missing_exams and not (asked & EXAM_DATE_CHECK_IDS):
        return {
            "question": get_question("exam-dates-check"),
            "subject": missing_exams[0].get("subject"),
            "missing_exams": missing_exams,
            "subject_options": None,
        }
    return None


def _forced_mark_followup(
    asked_ids: List[str],
    unmarked_exams: List[Dict],
    unmarked_assignments: List[Dict],
    pending_mark_exam_id: Optional[str],
    pending_mark_subject: Optional[str],
) -> Optional[Dict[str, Any]]:
    asked = set(asked_ids or [])
    if asked & MARK_CHECK_IDS:
        return None

    if unmarked_exams:
        if len(unmarked_exams) > 1 and not pending_mark_exam_id:
            if "exam-mark-pick" in asked:
                return None
            return {
                "question": get_question("exam-mark-pick"),
                "missing_exams": unmarked_exams,
                "subject": None,
                "subject_options": [_exam_label(exam) for exam in unmarked_exams],
            }
        target = None
        if pending_mark_exam_id:
            target = next(
                (exam for exam in unmarked_exams if str(exam.get("id")) == str(pending_mark_exam_id)),
                None,
            )
        if not target:
            target = unmarked_exams[0]
        return {
            "question": get_question("exam-mark-check"),
            "missing_exams": [target],
            "subject": target.get("subject"),
            "subject_options": None,
        }

    if unmarked_assignments:
        subjects = list(
            dict.fromkeys(task.get("subject") for task in unmarked_assignments if task.get("subject"))
        )
        if not subjects:
            return None
        if len(subjects) > 1 and not pending_mark_subject:
            if "asg-mark-pick" in asked:
                return None
            return {
                "question": get_question("asg-mark-pick"),
                "missing_exams": None,
                "subject": None,
                "subject_options": subjects,
            }
        subject = pending_mark_subject if pending_mark_subject in subjects else subjects[0]
        return {
            "question": get_question("asg-mark-check"),
            "missing_exams": None,
            "subject": subject,
            "subject_options": None,
        }
    return None


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
    registered_subjects: Optional[List[str]] = None,
    missing_exams: Optional[List[Dict]] = None,
    unmarked_exams: Optional[List[Dict]] = None,
    unmarked_assignments: Optional[List[Dict]] = None,
    pending_mark_exam_id: Optional[str] = None,
    pending_mark_subject: Optional[str] = None,
) -> Dict[str, Any]:
    today_subjects = today_subjects or []
    lecture_subjects = lecture_subjects or []
    assignment_subjects = assignment_subjects or []
    exam_subjects = exam_subjects or []
    exam_kinds = exam_kinds or []
    registered_subjects = registered_subjects or []
    missing_exams = missing_exams or []
    unmarked_exams = unmarked_exams or []
    unmarked_assignments = unmarked_assignments or []

    forced = _forced_setup_question(
        selected_activities,
        lecture_subjects,
        assignment_subjects,
        exam_subjects,
        exam_kinds,
        registered_subjects,
    )
    if forced:
        return {
            "end_session": False,
            "question": hydrate(forced, subject_options=registered_subjects),
            "task_updates": [],
        }

    date_followup = _forced_date_followup(
        selected_activities,
        asked_ids,
        tasks,
        assignment_subjects,
        missing_exams,
    )
    if date_followup and date_followup.get("question"):
        return {
            "end_session": False,
            "question": hydrate(
                date_followup["question"],
                subject=date_followup.get("subject"),
                missing_exams=date_followup.get("missing_exams"),
                subject_options=date_followup.get("subject_options"),
            ),
            "task_updates": [],
        }

    mark_followup = _forced_mark_followup(
        asked_ids,
        unmarked_exams,
        unmarked_assignments,
        pending_mark_exam_id,
        pending_mark_subject,
    )
    if mark_followup and mark_followup.get("question"):
        return {
            "end_session": False,
            "question": hydrate(
                mark_followup["question"],
                subject=mark_followup.get("subject"),
                missing_exams=mark_followup.get("missing_exams"),
                subject_options=mark_followup.get("subject_options"),
            ),
            "task_updates": [],
        }

    if total_questions_asked >= max_questions:
        return {"end_session": True, "question": None, "task_updates": []}

    shortlist = build_shortlist(
        selected_activities,
        asked_ids,
        tasks,
        assignment_subjects,
        missing_exams,
        unmarked_exams,
        unmarked_assignments,
    )
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
    )

    task_updates = decision.get("task_updates") or []
    if decision.get("end_session"):
        return {"end_session": True, "question": None, "task_updates": task_updates}

    chosen_id = decision.get("question_id")
    chosen = get_question(chosen_id) if chosen_id else None
    if chosen is None:
        chosen = shortlist[0]

    subject = None
    exams_for_q = None
    if chosen.get("stage") == "deadline_needed":
        needed = _subjects_needing_deadline(tasks, assignment_subjects)
        subject = needed[0] if needed else (assignment_subjects[0] if assignment_subjects else None)
    elif chosen.get("stage") in {"mark_review", "mark_entry"}:
        subjects = [t.get("subject") for t in unmarked_assignments if t.get("subject")]
        if pending_mark_subject and pending_mark_subject in subjects:
            subject = pending_mark_subject
        else:
            subject = subjects[0] if subjects else (assignment_subjects[0] if assignment_subjects else None)
    elif chosen.get("stage") == "exam_date":
        exams_for_q = missing_exams
        if missing_exams:
            subject = missing_exams[0].get("subject")
    elif chosen.get("stage") == "exam_mark_subject_needed":
        exams_for_q = unmarked_exams
    elif chosen.get("stage") in {"exam_mark_review", "exam_mark_entry"}:
        target = None
        if pending_mark_exam_id:
            target = next(
                (exam for exam in unmarked_exams if str(exam.get("id")) == str(pending_mark_exam_id)),
                None,
            )
        exams_for_q = [target] if target else unmarked_exams[:1]
        if exams_for_q:
            subject = exams_for_q[0].get("subject")
    elif lecture_subjects and "academic_study" in (chosen.get("activities") or []):
        subject = lecture_subjects[0]
    elif assignment_subjects:
        subject = assignment_subjects[0]
    elif lecture_subjects:
        subject = lecture_subjects[0]
    elif today_subjects:
        subject = today_subjects[0]

    subject_options_for_q = registered_subjects
    if chosen.get("stage") == "mark_subject_needed":
        subject_options_for_q = list(
            dict.fromkeys(t.get("subject") for t in unmarked_assignments if t.get("subject"))
        )
    elif chosen.get("stage") == "exam_mark_subject_needed":
        subject_options_for_q = [_exam_label(exam) for exam in (exams_for_q or unmarked_exams)]

    return {
        "end_session": False,
        "question": hydrate(
            chosen,
            subject=subject,
            missing_exams=exams_for_q,
            subject_options=subject_options_for_q,
        ),
        "task_updates": task_updates,
    }
