from pydantic import BaseModel, Field


class SaveSessionRequest(BaseModel):
    date: str | None = None  # YYYY-MM-DD; defaults to the server's today if omitted
    focus_minutes: float = 0.0
    distraction_minutes: float = 0.0  # overall off-task minutes, not per-type
    longest_streak_minutes: int = 0
    today_goal: int = Field(default=120, ge=1)
    calm_quest_count: int = 0
    first_hour: int | None = Field(default=None, ge=0, le=23)


class SaveSessionResponse(BaseModel):
    date: str
    saved: bool
    focus_hours: int
    focus_minutes: int
    distraction_hours: int
    distraction_minutes: int
    focus_score: int
    goal_progress: int
    achievements_unlocked: list[str]
