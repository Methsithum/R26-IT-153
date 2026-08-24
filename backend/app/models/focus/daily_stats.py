"""
Persistence model for a single day's focus-session stats. One document per
calendar date -- single-user for now, since there's no auth on this branch
yet (the frontend itself has no accounts either). See
services/focus/tracking.py for how documents are written and aggregated into
daily/weekly reports and the leaderboard.
"""
from pydantic import BaseModel, Field

DISTRACTION_STATES = ["Fatigue", "Anxiety", "Boredom"]


class FocusDailyStats(BaseModel):
    date: str  # YYYY-MM-DD, also the Mongo _id
    focus_minutes: float = 0.0
    points: int = 0
    longest_streak_minutes: int = 0
    distraction_minutes: dict[str, float] = Field(default_factory=lambda: {s: 0.0 for s in DISTRACTION_STATES})
    intervention_counts: dict[str, int] = Field(default_factory=lambda: {s: 0 for s in DISTRACTION_STATES})
    achievements_unlocked: list[str] = Field(default_factory=list)
