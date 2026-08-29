"""Per-user emotional-domain features (ML inputs 12–14).

Keyed by user_id — one document per user, overwritten on each session save
so the latest scores are always readable from Mongo.
"""
from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, Field


class FocusEmotionalStats(BaseModel):
    model_config = ConfigDict(extra="ignore")

    user_id: str
    stress_level: int = Field(default=0, ge=0, le=100)
    distraction_score: int = Field(default=0, ge=0, le=25)
    mood_stability: int = Field(default=100, ge=0, le=100)
    updated_at: str | None = None


def compute_emotional(focus_min: float, dist_min: float) -> dict[str, int]:
    """Derive the three scores from today's focus vs distraction minutes."""
    focus = max(0.0, float(focus_min or 0))
    dist = max(0.0, float(dist_min or 0))
    tracked = focus + dist
    if tracked <= 0:
        return {"stress_level": 0, "distraction_score": 0, "mood_stability": 100}
    dist_frac = dist / tracked
    focus_frac = focus / tracked
    stress = int(round(dist_frac * 100))
    distraction = int(round(dist_frac * 25))
    mood = int(round(100 - 2 * min(focus_frac, dist_frac) * 100))
    return {
        "stress_level": max(0, min(100, stress)),
        "distraction_score": max(0, min(25, distraction)),
        "mood_stability": max(0, min(100, mood)),
    }


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
