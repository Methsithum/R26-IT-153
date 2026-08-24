from datetime import date as date_cls

from fastapi import APIRouter

from app.models.focus.daily_stats import DISTRACTION_STATES, FocusDailyStats
from app.schemas.focus.session import SaveSessionRequest, SaveSessionResponse
from app.services.focus import tracking

router = APIRouter(prefix="/focus", tags=["focus"])


@router.post("/sessions", response_model=SaveSessionResponse)
def save_session(req: SaveSessionRequest):
    """Upserts today's (or the given date's) stats. The frontend already
    keeps a running total client-side, so this is called periodically with
    the latest cumulative snapshot for the day rather than a delta -- each
    call just overwrites that day's stored document."""
    stats = FocusDailyStats(
        date=req.date or date_cls.today().isoformat(),
        focus_minutes=req.focus_minutes,
        points=req.points,
        longest_streak_minutes=req.longest_streak_minutes,
        distraction_minutes={**{s: 0.0 for s in DISTRACTION_STATES}, **req.distraction_minutes},
        intervention_counts={**{s: 0 for s in DISTRACTION_STATES}, **req.intervention_counts},
        achievements_unlocked=req.achievements_unlocked,
    )
    tracking.save_daily_stats(stats)
    return SaveSessionResponse(date=stats.date, saved=True)
