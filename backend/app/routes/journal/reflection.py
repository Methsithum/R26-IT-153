from datetime import timedelta

from fastapi import APIRouter, HTTPException, Query
from app.schemas.journal.reflection import WeeklyReflectionRequest
from app.models.journal.reflection import ReflectionModel
from app.models.journal.daily_session import DailySessionModel
from app.models.user.user import UserModel
from app.services.journal.llm_service import generate_weekly_summary
from app.services.time_utils import calendar_datetime, local_today, to_local_date

router = APIRouter(prefix="/reflection", tags=["reflection"])

WEEKLY_MIN_JOURNALS = 1


def _week_bounds(day=None):
    today = day or local_today()
    start = today - timedelta(days=today.weekday())
    end = start + timedelta(days=6)
    return start, end


def _session_brief(session: dict) -> str:
    day = to_local_date(session.get("date"))
    label = day.isoformat() if day else "a campus day"
    entry = str(session.get("journal_entry") or "").strip()
    highlights = session.get("journal_highlights") or []
    highlight_text = "; ".join(str(item) for item in highlights[:4] if item)
    activities = ", ".join(session.get("selected_activities") or [])
    parts = [f"{label}: {entry}" if entry else f"{label} logged"]
    if activities:
        parts.append(f"activities={activities}")
    if highlight_text:
        parts.append(highlight_text)
    return " — ".join(parts)


def _session_preview(session: dict) -> dict:
    day = to_local_date(session.get("date"))
    highlights = [str(item).strip() for item in (session.get("journal_highlights") or []) if str(item).strip()]
    entry = str(session.get("journal_entry") or "").strip()
    return {
        "date": day.isoformat() if day else None,
        "activities": session.get("selected_activities") or [],
        "excerpt": (highlights[0] if highlights else entry[:140]) or "Campus day logged",
    }


def _date_iso(value) -> str | None:
    day = to_local_date(value)
    return day.isoformat() if day else None


def _pack_reflection(doc: dict | None) -> dict | None:
    if not doc:
        return None
    narrative = doc.get("narrative") or doc.get("summary") or ""
    return {
        "id": doc.get("id"),
        "week_start": _date_iso(doc.get("week_start")),
        "week_end": _date_iso(doc.get("week_end")),
        "answers": doc.get("answers") or {},
        "narrative": narrative,
        "highlights": doc.get("highlights") or [],
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }


def _weeks_with_journals(sessions: list[dict]) -> list[dict]:
    grouped: dict[str, dict] = {}
    for session in sessions:
        day = to_local_date(session.get("date"))
        if not day:
            continue
        start, end = _week_bounds(day)
        key = start.isoformat()
        bucket = grouped.setdefault(
            key,
            {"week_start": start.isoformat(), "week_end": end.isoformat(), "journal_count": 0},
        )
        bucket["journal_count"] += 1
    return sorted(grouped.values(), key=lambda item: item["week_start"], reverse=True)


@router.get("/status/{user_id}")
async def reflection_status(user_id: str, date: str | None = Query(None, description="Any date inside the week")):
    user = await UserModel.find_by_id(user_id)
    if not user:
        raise HTTPException(404, "User not found")

    today = local_today()
    selected = to_local_date(date) or today
    if selected > today:
        selected = today
    week_start, week_end = _week_bounds(selected)
    week_sessions = [
        session
        for session in await DailySessionModel.find_user_sessions(
            user_id, calendar_datetime(week_start), calendar_datetime(week_end)
        )
        if session.get("completed")
    ]
    all_sessions = [session for session in await DailySessionModel.find_user_sessions(user_id) if session.get("completed")]
    existing_week = await ReflectionModel.find_weekly_in_range(
        user_id, calendar_datetime(week_start), calendar_datetime(week_end)
    )
    week_count = len(week_sessions)
    weekly_ready = week_count >= WEEKLY_MIN_JOURNALS

    return {
        "date": selected.isoformat(),
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "weeks": _weeks_with_journals(all_sessions),
        "sessions": [_session_preview(session) for session in week_sessions],
        "weekly": {
            "available": weekly_ready,
            "needed": WEEKLY_MIN_JOURNALS,
            "journal_count": week_count,
            "existing": _pack_reflection(existing_week),
            "reason": None
            if weekly_ready
            else "No campus journal in this week yet. Pick another week, or finish a run first.",
        },
    }


@router.post("/weekly")
async def weekly_reflection(req: WeeklyReflectionRequest):
    user = await UserModel.find_by_id(req.user_id)
    if not user:
        raise HTTPException(404, "User not found")
    start = to_local_date(req.week_start) or _week_bounds()[0]
    end = to_local_date(req.week_end) or _week_bounds()[1]
    sessions = [
        session
        for session in await DailySessionModel.find_user_sessions(
            req.user_id, calendar_datetime(start), calendar_datetime(end)
        )
        if session.get("completed")
    ]
    if len(sessions) < WEEKLY_MIN_JOURNALS:
        raise HTTPException(400, "Finish at least one campus journal in that week first.")
    briefs = [_session_brief(session) for session in sessions]
    data_summary = f"Week from {start.isoformat()} to {end.isoformat()}. Journals: " + "; ".join(briefs)
    page = await generate_weekly_summary(user["name"], data_summary)
    stored = await ReflectionModel.upsert_weekly(
        req.user_id,
        calendar_datetime(start),
        calendar_datetime(end),
        {
            "answers": {},
            "narrative": page["narrative"],
            "highlights": page["highlights"],
            "summary": page["narrative"],
        },
    )
    packed = _pack_reflection(stored)
    return {"reflection_id": packed["id"], **packed}


@router.get("/weekly/{user_id}")
async def get_weekly_reflections(user_id: str):
    user = await UserModel.find_by_id(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    docs = await ReflectionModel.find_weekly_by_user(user_id)
    return {"user_id": user_id, "reflections": [_pack_reflection(doc) for doc in docs]}
