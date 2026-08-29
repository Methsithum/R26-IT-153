"""
Persistence model for a single day's focus-session stats. Documents are keyed
by `user_id:date` so each user has their own history. Emotional-domain scores
(stress_level, distraction_score, mood_stability) are stored on the day row
and also upserted onto a per-user document (see models/focus/emotional.py).
"""
from pydantic import BaseModel, ConfigDict, Field


def split_hm(total_minutes: float) -> tuple[int, int]:
    """Round a minute total into (hours, leftover minutes)."""
    total = max(0, int(round(float(total_minutes or 0))))
    return total // 60, total % 60


def combine_hm(hours: int, minutes: int) -> int:
    return int(hours or 0) * 60 + int(minutes or 0)


def compute_scores(focus_min: float, dist_min: float, today_goal: int) -> tuple[int, int]:
    """(focus_score %, goal_progress %) from raw minute totals."""
    tracked = float(focus_min or 0) + float(dist_min or 0)
    score = round((focus_min / tracked) * 100) if tracked > 0 else 0
    goal = round(min((focus_min / today_goal) * 100, 100)) if today_goal else 0
    return int(score), int(goal)


class FocusDailyStats(BaseModel):
    model_config = ConfigDict(extra="ignore")

    date: str  # YYYY-MM-DD
    user_id: str = "anonymous"
    stress_level: int = 0
    distraction_score: int = 0
    mood_stability: int = 100
    focus_hours: int = 0
    focus_minutes: int = 0
    distraction_hours: int = 0
    distraction_minutes: int = 0
    focus_score: int = 0
    goal_progress: int = 0
    longest_streak_minutes: int = 0
    calm_quest_count: int = 0
    first_hour: int | None = None
    achievements_unlocked: list[str] = Field(default_factory=list)

    @property
    def total_focus_minutes(self) -> int:
        return combine_hm(self.focus_hours, self.focus_minutes)

    @property
    def total_distraction_minutes(self) -> int:
        return combine_hm(self.distraction_hours, self.distraction_minutes)
