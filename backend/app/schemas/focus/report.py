from pydantic import BaseModel


class DailyReport(BaseModel):
    date: str
    focus_minutes: float
    points: int
    longest_streak_minutes: int
    distraction_minutes: dict[str, float]
    intervention_counts: dict[str, int]
    achievements_unlocked: list[str]


class WeeklyReportDay(BaseModel):
    date: str
    focus_minutes: float
    points: int
    distraction_minutes: dict[str, float]


class WeeklyReport(BaseModel):
    days: list[WeeklyReportDay]
    total_focus_minutes: float
    total_points: int
    most_distracted_day: str | None
    most_distracted_reason: str | None
    insight: str | None
