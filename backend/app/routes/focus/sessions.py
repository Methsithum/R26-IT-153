from datetime import date as date_cls
from datetime import datetime

from fastapi import APIRouter

from app.models.focus.daily_stats import (
    FocusDailyStats,
    compute_scores,
    split_hm,
)
from app.schemas.focus.session import SaveSessionRequest, SaveSessionResponse
from app.services.focus import tracking

router = APIRouter(prefix="/focus", tags=["focus"])


@router.post("/sessions", response_model=SaveSessionResponse)
def save_session(req: SaveSessionRequest):
    """Upserts today's (or the given date's) stats. The frontend already
    keeps a running total client-side, so this is called periodically with
    the latest cumulative snapshot for the day rather than a delta -- each
    call just overwrites that day's stored document.

    Incoming totals are raw minutes; they are split into hours + leftover
    minutes before being written, and distraction is a single overall figure.
    """
    date = req.date or date_cls.today().isoformat()
    existing = tracking.get_daily_stats(date)
    fh, fm = split_hm(req.focus_minutes)
    dh, dm = split_hm(req.distraction_minutes)
    score, goal = compute_scores(req.focus_minutes, req.distraction_minutes, req.today_goal)

    first_hour = existing.first_hour
    has_time = req.focus_minutes > 0 or req.distraction_minutes > 0
    if first_hour is None and has_time:
        first_hour = req.first_hour if req.first_hour is not None else datetime.now().hour

    stats = FocusDailyStats(
        date=date,
        focus_hours=fh,
        focus_minutes=fm,
        distraction_hours=dh,
        distraction_minutes=dm,
        focus_score=score,
        goal_progress=goal,
        longest_streak_minutes=max(req.longest_streak_minutes, existing.longest_streak_minutes),
        calm_quest_count=max(req.calm_quest_count, existing.calm_quest_count),
        first_hour=first_hour,
    )
    all_stats = tracking.all_saved_stats()
    week = tracking.get_weekly_stats()
    stats.achievements_unlocked = tracking.compute_achievements(stats, week, all_stats)
    tracking.save_daily_stats(stats)
    return SaveSessionResponse(
        date=stats.date,
        saved=True,
        focus_hours=stats.focus_hours,
        focus_minutes=stats.focus_minutes,
        distraction_hours=stats.distraction_hours,
        distraction_minutes=stats.distraction_minutes,
        focus_score=stats.focus_score,
        goal_progress=stats.goal_progress,
        achievements_unlocked=stats.achievements_unlocked,
    )
