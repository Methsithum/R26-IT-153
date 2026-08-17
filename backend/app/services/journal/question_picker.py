"""Filter the question bank, then ask the LLM to pick one id from the shortlist."""

from typing import Any, Dict, List, Optional

from app.services.journal.llm_service import pick_question_id
from app.services.journal.question_bank import QUESTION_BANK, get_question, pad_options

SHORTLIST_SIZE = 20


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
) -> bool:
    stage = question.get("stage") or "daily_checkin"
    if stage in {"lecture_subjects_needed", "assignment_subjects_needed", "exam_setup_needed"}:
        return False
    if stage == "deadline_needed":
        if "assignment_work" not in selected:
            return False
        return bool(_subjects_needing_deadline(tasks, assignment_subjects))
    if stage in {"mark_review", "mark_entry"}:
        if "assignment_work" not in selected or not assignment_subjects:
            return False
        done = {"completed", "report_completed", "viva_pending"}
        relevant = [t for t in tasks if t.get("subject") in assignment_subjects]
        return any((t.get("progress") or t.get("progress_stage") or "") in done for t in relevant)
    if stage == "exam_date":
        return "exam_preparation" in selected and bool(missing_exams)
    return True


def build_shortlist(
    selected_activities: List[str],
    asked_ids: List[str],
    tasks: List[Dict],
    assignment_subjects: Optional[List[str]] = None,
    missing_exams: Optional[List[Dict]] = None,
) -> List[dict]:
    asked = set(asked_ids or [])
    assignment_subjects = assignment_subjects or []
    missing_exams = missing_exams or []
    matching = []
    generic = []
    for question in QUESTION_BANK:
        if question["id"] in asked:
            continue
        if not _stage_allowed(question, tasks, selected_activities, assignment_subjects, missing_exams):
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
        elif question.get("stage") == "deadline_needed":
            text = f"When is the deadline for {subject}?"
        elif question.get("stage") == "mark_entry":
            text = f"Log the mark you received for {subject}."
        elif question.get("stage") == "mark_review":
            text = f"Have you received a mark for {subject}?"
    if question.get("stage") == "exam_date" and missing_exams:
        labels = [f"{e['subject']} · {str(e['exam_type']).title()}" for e in missing_exams]
        text = f"Confirm the missing exam date{'s' if len(labels) > 1 else ''}: {', '.join(labels)}."
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
) -> Dict[str, Any]:
    today_subjects = today_subjects or []
    lecture_subjects = lecture_subjects or []
    assignment_subjects = assignment_subjects or []
    exam_subjects = exam_subjects or []
    exam_kinds = exam_kinds or []
    registered_subjects = registered_subjects or []
    missing_exams = missing_exams or []
    if total_questions_asked >= max_questions:
        return {"end_session": True, "question": None, "task_updates": []}

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

    shortlist = build_shortlist(
        selected_activities, asked_ids, tasks, assignment_subjects, missing_exams
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
        subject = assignment_subjects[0] if assignment_subjects else None
    elif chosen.get("stage") == "exam_date":
        exams_for_q = missing_exams
        if missing_exams:
            subject = missing_exams[0].get("subject")
    elif lecture_subjects and "academic_study" in (chosen.get("activities") or []):
        subject = lecture_subjects[0]
    elif assignment_subjects:
        subject = assignment_subjects[0]
    elif lecture_subjects:
        subject = lecture_subjects[0]
    elif today_subjects:
        subject = today_subjects[0]

    return {
        "end_session": False,
        "question": hydrate(chosen, subject=subject, missing_exams=exams_for_q, subject_options=registered_subjects),
        "task_updates": task_updates,
    }
