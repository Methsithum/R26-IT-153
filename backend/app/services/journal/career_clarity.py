"""Weekly career-clarity check-in from the campus run (4 lanes, no typing)."""

from datetime import timedelta

from app.models.journal.daily_session import DailySessionModel
from app.services.time_utils import as_of_day

CAREER_CLARITY_QID = "career-clarity"
CAREER_CLARITY_SCORES = {
    "poor": 20,
    "fair": 45,
    "good": 70,
    "strong": 90,
}


def week_start_for(day) -> str:
    as_of = as_of_day(day)
    start = as_of - timedelta(days=as_of.weekday())
    return start.isoformat()


def score_from_answer(answer):
    text = str(answer or "").strip().lower()
    if not text:
        return None
    for label, score in CAREER_CLARITY_SCORES.items():
        if text == label or text.startswith(label):
            return score
    return None


def scored_career_clarity(qa_list):
    """Latest mapped 0–100 score in this QA list, or None if they have not answered."""
    for qa in reversed(qa_list or []):
        qid = str(qa.get("question_id") or "")
        if qid != CAREER_CLARITY_QID and not qid.startswith(CAREER_CLARITY_QID):
            continue
        score = score_from_answer(qa.get("answer"))
        if score is not None:
            return score
    return None


async def week_already_answered_career_clarity(user_id: str, as_of) -> bool:
    """True only if a *completed* journal for this play day's Mon–Sun week has a scored answer.

    Incomplete / abandoned runs do not lock the week. Catch-up uses the journal
    date's week, not calendar today.
    """
    week = week_start_for(as_of)
    sessions = await DailySessionModel.find_user_sessions(user_id)
    for session in sessions or []:
        if not session.get("completed"):
            continue
        if week_start_for(session.get("date")) != week:
            continue
        if scored_career_clarity(session.get("qa_history")) is not None:
            return True
    return False
