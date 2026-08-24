from datetime import date as date_cls

from fastapi import APIRouter

from app.schemas.focus.report import DailyReport, WeeklyReport, WeeklyReportDay
from app.services.focus import tracking

router = APIRouter(prefix="/focus", tags=["focus"])


@router.get("/reports/daily", response_model=DailyReport)
def daily_report(date: str | None = None):
    stats = tracking.get_daily_stats(date or date_cls.today().isoformat())
    return DailyReport(**stats.model_dump())


@router.get("/reports/weekly", response_model=WeeklyReport)
def weekly_report():
    days = tracking.get_weekly_stats()
    most_day, reason, insight = tracking.compute_weekly_insight(days)
    return WeeklyReport(
        days=[
            WeeklyReportDay(
                date=d.date, focus_minutes=d.focus_minutes, points=d.points, distraction_minutes=d.distraction_minutes
            )
            for d in days
        ],
        total_focus_minutes=sum(d.focus_minutes for d in days),
        total_points=sum(d.points for d in days),
        most_distracted_day=most_day,
        most_distracted_reason=reason,
        insight=insight,
    )
