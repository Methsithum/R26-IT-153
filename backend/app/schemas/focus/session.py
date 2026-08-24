from pydantic import BaseModel, Field


class SaveSessionRequest(BaseModel):
    date: str | None = None  # YYYY-MM-DD; defaults to the server's today if omitted
    focus_minutes: float = 0.0
    points: int = 0
    longest_streak_minutes: int = 0
    distraction_minutes: dict[str, float] = Field(default_factory=dict)
    intervention_counts: dict[str, int] = Field(default_factory=dict)
    achievements_unlocked: list[str] = Field(default_factory=list)


class SaveSessionResponse(BaseModel):
    date: str
    saved: bool
