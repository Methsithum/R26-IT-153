from pydantic import BaseModel


class DailyReport(BaseModel):
    date: str
    user_id: str
    focus_hours: int
    focus_minutes: int
    distraction_hours: int
    distraction_minutes: int
    focus_score: int
    goal_progress: int
    stress_level: int
    distraction_score: int
    mood_stability: int
    longest_streak_minutes: int
    calm_quest_count: int
    challenges_taken: int = 0
    focus_boosts: int = 0
    challenge_points: int = 0
    first_hour: int | None
    achievements_unlocked: list[str]


class WeeklyReportDay(BaseModel):
    date: str
    focus_hours: int
    focus_minutes: int
    distraction_hours: int
    distraction_minutes: int
    focus_score: int
    stress_level: int = 0
    distraction_score: int = 0
    mood_stability: int = 100


class EmotionalReport(BaseModel):
    user_id: str
    stress_level: int
    distraction_score: int
    mood_stability: int
    updated_at: str | None = None


class WeeklyReport(BaseModel):
    days: list[WeeklyReportDay]
    total_focus_hours: int
    total_focus_minutes: int
    total_distraction_hours: int
    total_distraction_minutes: int
    most_distracted_day: str | None
    most_distracted_reason: str | None
    insight: str | None
