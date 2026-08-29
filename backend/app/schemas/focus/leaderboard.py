from pydantic import BaseModel


class LeaderboardEntry(BaseModel):
    user_id: str
    name: str
    rank: int
    is_you: bool = False
    online: bool = True
    focus_hours: int
    focus_minutes: int
    distraction_hours: int
    distraction_minutes: int
    longest_streak_minutes: int
    focus_score: int
    challenge_points: int = 100


class ProfileResponse(BaseModel):
    total_focus_hours: int
    total_focus_minutes: int
    total_distraction_hours: int
    total_distraction_minutes: int
    longest_streak_minutes: int
    calm_quest_count: int
    days_active: int
    achievements_unlocked: list[str]
