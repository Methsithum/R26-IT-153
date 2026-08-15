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


def _stage_allowed(question: dict, tasks: List[Dict], selected: List[str]) -> bool:
    stage = question.get("stage") or "daily_checkin"
    if stage == "deadline_needed":
        if not tasks:
            return True
        return any(not t.get("deadline") for t in tasks)
    if stage == "mark_review":
        done = {"completed", "report_completed", "viva_pending"}
        return any((t.get("progress") or t.get("progress_stage") or "") in done for t in tasks)
    if stage == "mark_entry":
        done = {"completed", "report_completed", "viva_pending"}
        return any((t.get("progress") or t.get("progress_stage") or "") in done for t in tasks)
    if stage == "exam_date":
        return "exam_preparation" in selected
    return True


def build_shortlist(
    selected_activities: List[str],
    asked_ids: List[str],
    tasks: List[Dict],
) -> List[dict]:
    asked = set(asked_ids or [])
    matching = []
    generic = []
    for question in QUESTION_BANK:
        if question["id"] in asked:
            continue
        if not _stage_allowed(question, tasks, selected_activities):
            continue
        if _matches_activities(question, selected_activities):
            if question.get("activities") == ["*"]:
                generic.append(question)
            else:
                matching.append(question)
    # Activity-specific templates first, then generic wellbeing fillers.
    ordered = matching + generic
    return ordered[:SHORTLIST_SIZE]


def hydrate(question: Optional[dict]) -> Optional[dict]:
    if not question:
        return None
    return {
        **question,
        "options": pad_options(question.get("options")),
    }


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
) -> Dict[str, Any]:
    """Return {end_session, question, task_updates}. `question` is a bank row or None."""
    if total_questions_asked >= max_questions:
        return {"end_session": True, "question": None, "task_updates": []}

    shortlist = build_shortlist(selected_activities, asked_ids, tasks)
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
    return {"end_session": False, "question": hydrate(chosen), "task_updates": task_updates}
