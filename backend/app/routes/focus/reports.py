from datetime import date as date_cls

from fastapi import APIRouter

from app.models.focus.daily_stats import challenge_points_for, split_hm
from app.schemas.focus.report import DailyReport, EmotionalReport, WeeklyReport, WeeklyReportDay
from app.services.focus import tracking

router = APIRouter(prefix="/focus", tags=["focus"])


def _daily_payload(stats) -> DailyReport:
    return DailyReport(
        date=stats.date,
        user_id=stats.user_id,
        focus_hours=stats.focus_hours,
        focus_minutes=stats.focus_minutes,
        distraction_hours=stats.distraction_hours,
        distraction_minutes=stats.distraction_minutes,
        focus_score=stats.focus_score,
        goal_progress=stats.goal_progress,
        stress_level=stats.stress_level,
        distraction_score=stats.distraction_score,
        mood_stability=stats.mood_stability,
        longest_streak_minutes=stats.longest_streak_minutes,
        calm_quest_count=stats.calm_quest_count,
        challenges_taken=stats.challenges_taken,
        focus_boosts=stats.focus_boosts,
        challenge_points=challenge_points_for(stats.challenges_taken, stats.focus_boosts),
        first_hour=stats.first_hour,
        achievements_unlocked=stats.achievements_unlocked,
    )


@router.get("/reports/daily", response_model=DailyReport)
def daily_report(user_id: str, date: str | None = None):
    stats = tracking.get_daily_stats(date or date_cls.today().isoformat(), user_id)
    return _daily_payload(stats)


@router.get("/reports/weekly", response_model=WeeklyReport)
def weekly_report(user_id: str):
    days = tracking.get_weekly_stats(user_id=user_id)
    most_day, reason, insight = tracking.compute_weekly_insight(days)
    total_focus = sum(d.total_focus_minutes for d in days)
    total_dist = sum(d.total_distraction_minutes for d in days)
    tfh, tfm = split_hm(total_focus)
    tdh, tdm = split_hm(total_dist)
    return WeeklyReport(
        days=[
            WeeklyReportDay(
                date=d.date,
                focus_hours=d.focus_hours,
                focus_minutes=d.focus_minutes,
                distraction_hours=d.distraction_hours,
                distraction_minutes=d.distraction_minutes,
                focus_score=d.focus_score,
                stress_level=d.stress_level,
                distraction_score=d.distraction_score,
                mood_stability=d.mood_stability,
            )
            for d in days
        ],
        total_focus_hours=tfh,
        total_focus_minutes=tfm,
        total_distraction_hours=tdh,
        total_distraction_minutes=tdm,
        most_distracted_day=most_day,
        most_distracted_reason=reason,
        insight=insight,
    )


@router.get("/emotional", response_model=EmotionalReport)
def emotional_report(user_id: str):
    """Latest emotional-domain features for a user (Mongo _id = user_id)."""
    stats = tracking.get_emotional_stats(user_id)
    return EmotionalReport(**stats.model_dump())
