from pydantic import BaseModel


class LeaderboardEntry(BaseModel):
    name: str
    rank: int
    focus_hours: int
    focus_minutes: int
    distraction_hours: int
    distraction_minutes: int
    longest_streak_minutes: int
    focus_score: int


class ProfileResponse(BaseModel):
    total_focus_hours: int
    total_focus_minutes: int
    total_distraction_hours: int
    total_distraction_minutes: int
    longest_streak_minutes: int
    calm_quest_count: int
    days_active: int
    achievements_unlocked: list[str]
