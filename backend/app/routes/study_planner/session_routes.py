"""
session_routes.py

Durable study-session history + the permission-first missed-session flow:

  1. POST /sessions/mark  {status: "missed"}  -> saved as missed with
     reschedule_decision="pending". NOTHING is moved.
  2. The student chooses:
       - "this week" / "next week" -> POST /sessions/{id}/suggest-slots
         shows free slots up to the deadline, then
         POST /sessions/{id}/reschedule-to books ONLY the slot they picked
       - "don't reschedule"        -> POST /sessions/{id}/decline
  3. Booked manual sessions are returned by GET /sessions/blocked, which the
     frontend passes as blocked_slots to /schedule, /multi-week-schedule and
     /reschedule so the generator never double-books them.

The automatic /reschedule flow is never used for a missed session - only
for "mark complete" - so a missed session is never moved without asking.
"""

from datetime import date, timedelta

from fastapi import APIRouter, HTTPException, Query
from pymongo.errors import DuplicateKeyError

from app.models.journal.exam import ExamModel
from app.models.journal.task import TaskModel
from app.models.study_planner.study_session import StudySessionModel
from app.schemas.study_planner.session_schemas import (
    BlockedSlotResponse,
    DeclineRequest,
    LiveScheduleContext,
    MarkRequest,
    RescheduleToRequest,
    RescheduleToResponse,
    SessionResponse,
    SessionStatsResponse,
    SnapshotRequest,
    SnapshotResponse,
    SuggestSlotsResponse,
)
from app.services.study_planner.session_service import build_suggestions, is_slot_still_free
from app.services.time_utils import local_now, local_today, local_today_iso, to_local_date

router = APIRouter(prefix="/study-planner/sessions", tags=["study-planner"])

# History requests are capped so one call can't scan a whole collection.
MAX_HISTORY_DAYS = 120


def _now_minutes() -> int:
    now = local_now()
    return now.hour * 60 + now.minute


async def _owned_session(session_id: str, user_id: str) -> dict:
    session = await StudySessionModel.find_by_id(session_id)
    if not session or session["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Session not found.")
    return session


async def _resolve_deadline(session: dict) -> date | None:
    """
    The real assignment's CURRENT deadline wins over the one frozen into the
    session (it may have been edited since). Exam-prep task ids
    ("exam-<id>[-wN]") aren't task documents, so they keep the stored one.
    """
    if session.get("task_type", "assignment") == "assignment":
        task = await TaskModel.find_by_id(session["task_id"])
        if task and task.get("deadline"):
            return to_local_date(task["deadline"])
    return to_local_date(session.get("deadline_date"))


async def _occupied_with_manual(user_id: str, body: LiveScheduleContext, exclude_id: str) -> dict:
    """The live plan's occupied slots plus every stored session in the window (manual moves included)."""
    occupied = {d: list(slots) for d, slots in body.occupied.items()}
    today = local_today()
    window_end = (today + timedelta(days=14)).isoformat()
    for stored in await StudySessionModel.find_range(user_id, today.isoformat(), window_end):
        if stored["id"] == exclude_id or stored["status"] == "missed":
            continue
        slots = occupied.setdefault(stored["date"], [])
        if stored["time_slot"] not in slots:
            slots.append(stored["time_slot"])
    # Nothing is ever scheduled on an exam day - enforced here too, not only
    # by the frontend, so a missed session can never be moved onto one.
    for exam in await ExamModel.find_by_user(user_id):
        exam_day = to_local_date(exam.get("date"))
        if exam_day and exam_day >= today:
            occupied[exam_day.isoformat()] = ["00:00-23:59"]
    return occupied


def _require_missed_pending(session: dict):
    if session["status"] != "missed":
        raise HTTPException(status_code=409, detail="Only a missed session can be rescheduled or declined.")
    if session.get("reschedule_decision") != "pending":
        raise HTTPException(status_code=409, detail="A decision was already made for this missed session.")


@router.post("/snapshot", response_model=SnapshotResponse)
async def snapshot_sessions(body: SnapshotRequest):
    """Append-only save of past/today sessions - already-stored ones are left untouched."""
    inserted = await StudySessionModel.snapshot(body.user_id, [s.model_dump() for s in body.sessions])
    return {"inserted": inserted}


@router.post("/mark", response_model=SessionResponse)
async def mark_session(body: MarkRequest):
    session = body.session.model_dump()
    if session["date"] > local_today_iso():
        raise HTTPException(status_code=422, detail="A future session can't be marked yet.")

    existing = await StudySessionModel.find_by_key(body.user_id, session)
    if existing and existing.get("rescheduled_to"):
        raise HTTPException(
            status_code=409,
            detail="This missed session was already moved to another slot - mark the new session instead.",
        )

    # Marking missed only records it and asks - it never moves anything.
    decision = "pending" if body.status == "missed" else None
    if existing and body.status == "missed" and existing.get("reschedule_decision") == "declined":
        decision = "declined"
    return await StudySessionModel.upsert_and_set(
        body.user_id,
        session,
        {"status": body.status, "reschedule_decision": decision, "marked_at": local_now().replace(tzinfo=None)},
    )


@router.get("", response_model=list[SessionResponse])
async def session_history(
    user_id: str = Query(...),
    start_date: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    end_date: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
):
    start, end = date.fromisoformat(start_date), date.fromisoformat(end_date)
    if end < start:
        raise HTTPException(status_code=422, detail="end_date must be on/after start_date.")
    if (end - start).days > MAX_HISTORY_DAYS:
        raise HTTPException(status_code=422, detail=f"Date range is limited to {MAX_HISTORY_DAYS} days.")
    return await StudySessionModel.find_range(user_id, start_date, end_date)


@router.get("/pending-decisions", response_model=list[SessionResponse])
async def pending_decisions(user_id: str = Query(...)):
    """Missed sessions the student hasn't decided about yet (closed the popup without choosing)."""
    return await StudySessionModel.find_pending_decisions(user_id)


@router.get("/blocked", response_model=list[BlockedSlotResponse])
async def blocked_slots(user_id: str = Query(...)):
    """Upcoming manually booked sessions - send these as blocked_slots to every schedule generation call."""
    sessions = await StudySessionModel.find_upcoming_manual(user_id, local_today_iso())
    return [{"date": s["date"], "start_time": s["start_time"], "end_time": s["end_time"]} for s in sessions]


@router.get("/stats", response_model=SessionStatsResponse)
async def session_stats(user_id: str = Query(...)):
    counts = await StudySessionModel.status_counts(user_id)
    done = counts.get("done", {"count": 0, "minutes": 0})
    missed = counts.get("missed", {"count": 0, "minutes": 0})
    marked = done["count"] + missed["count"]
    return {
        "done": done,
        "missed": missed,
        "pending": counts.get("pending", {"count": 0, "minutes": 0}),
        "completion_rate": round(done["count"] / marked, 3) if marked else None,
    }


@router.post("/{session_id}/suggest-slots", response_model=SuggestSlotsResponse)
async def suggest_slots(session_id: str, body: LiveScheduleContext):
    session = await _owned_session(session_id, body.user_id)
    _require_missed_pending(session)
    occupied = await _occupied_with_manual(body.user_id, body, exclude_id=session_id)
    return build_suggestions(
        weekly_free_slots=[s.model_dump() for s in body.weekly_free_slots],
        occupied_by_date=occupied,
        which=body.week,
        deadline=await _resolve_deadline(session),
        duration_minutes=session["duration_minutes"],
        today=local_today(),
        now_minutes=_now_minutes(),
    )


@router.post("/{session_id}/reschedule-to", response_model=RescheduleToResponse)
async def reschedule_to(session_id: str, body: RescheduleToRequest):
    """Books the ONE slot the student picked - re-checked first, since the plan may have changed since suggesting."""
    session = await _owned_session(session_id, body.user_id)
    _require_missed_pending(session)
    deadline = await _resolve_deadline(session)
    occupied = await _occupied_with_manual(body.user_id, body, exclude_id=session_id)
    if not is_slot_still_free(
        weekly_free_slots=[s.model_dump() for s in body.weekly_free_slots],
        occupied_by_date=occupied,
        which=body.week,
        deadline=deadline,
        target_date=body.date,
        time_slot=body.time_slot,
        today=local_today(),
        now_minutes=_now_minutes(),
    ):
        raise HTTPException(
            status_code=409,
            detail="That slot is no longer free (or is past the deadline) - please pick another one.",
        )

    start_time, end_time = body.time_slot.split("-")
    start_h, start_m = map(int, start_time.split(":"))
    end_h, end_m = map(int, end_time.split(":"))
    try:
        new_session = await StudySessionModel.create_manual(
            body.user_id,
            {
                "date": body.date,
                "time_slot": body.time_slot,
                "task_id": session["task_id"],
                "module": session["module"],
                "task_type": session.get("task_type", "assignment"),
                "duration_minutes": (end_h * 60 + end_m) - (start_h * 60 + start_m),
                "deadline_date": deadline.isoformat() if deadline else session.get("deadline_date"),
            },
            rescheduled_from=session_id,
        )
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="This task already has a session in that exact slot.")
    await StudySessionModel.update(
        session_id,
        {
            "reschedule_decision": "this_week" if body.week == "this" else "next_week",
            "rescheduled_to": new_session["id"],
            "decided_at": local_now().replace(tzinfo=None),
        },
    )
    return {"missed": await StudySessionModel.find_by_id(session_id), "new_session": new_session}


@router.post("/{session_id}/decline", response_model=SessionResponse)
async def decline_reschedule(session_id: str, body: DeclineRequest):
    """'Don't reschedule' - the session stays missed and the schedule is not touched."""
    session = await _owned_session(session_id, body.user_id)
    _require_missed_pending(session)
    await StudySessionModel.update(
        session_id, {"reschedule_decision": "declined", "decided_at": local_now().replace(tzinfo=None)}
    )
    return await StudySessionModel.find_by_id(session_id)
