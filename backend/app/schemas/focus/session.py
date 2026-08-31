from pydantic import BaseModel, Field


class SaveSessionRequest(BaseModel):
    user_id: str
    focus_minutes: float = 0.0
    distraction_minutes: float = 0.0  # overall off-task minutes, not per-type
    longest_streak_minutes: int = 0
    today_goal: int = Field(default=120, ge=1)
    calm_quest_count: int = 0
    first_hour: int | None = Field(default=None, ge=0, le=23)
    challenges_taken: int = Field(default=0, ge=0)
    focus_boosts: int = Field(default=0, ge=0)
    stress_level: int | None = Field(default=None, ge=0, le=100)
    distraction_score: int | None = Field(default=None, ge=0, le=25)
    mood_stability: int | None = Field(default=None, ge=0, le=100)


class SaveSessionResponse(BaseModel):
    user_id: str
    date: str
    saved: bool
    focus_hours: int
    focus_minutes: int
    distraction_hours: int
    distraction_minutes: int
    focus_score: int
    goal_progress: int
    stress_level: int
    distraction_score: int
    mood_stability: int
    challenges_taken: int
    focus_boosts: int = 0
    challenge_points: int
    achievements_unlocked: list[str]
