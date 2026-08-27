from pydantic import BaseModel


class DailyReport(BaseModel):
    date: str
    focus_hours: int
    focus_minutes: int
    distraction_hours: int
    distraction_minutes: int
    focus_score: int
    goal_progress: int
    longest_streak_minutes: int
    calm_quest_count: int
    first_hour: int | None
    achievements_unlocked: list[str]


class WeeklyReportDay(BaseModel):
    date: str
    focus_hours: int
    focus_minutes: int
    distraction_hours: int
    distraction_minutes: int
    focus_score: int


class WeeklyReport(BaseModel):
    days: list[WeeklyReportDay]
    total_focus_hours: int
    total_focus_minutes: int
    total_distraction_hours: int
    total_distraction_minutes: int
    most_distracted_day: str | None
    most_distracted_reason: str | None
    insight: str | None
