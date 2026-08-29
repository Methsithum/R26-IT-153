from datetime import date as date_cls

from fastapi import APIRouter

from app.schemas.focus.leaderboard import LeaderboardEntry, ProfileResponse
from app.services.focus import tracking

router = APIRouter(prefix="/focus", tags=["focus"])


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
def leaderboard(user_id: str):
    """Real saved time for the current user. Shaped as a list so adding
    real accounts later doesn't change the response shape — no dummy rows."""
    today = tracking.get_daily_stats(date_cls.today().isoformat(), user_id)
    if today.total_focus_minutes <= 0 and today.total_distraction_minutes <= 0:
        return []
    return [
        LeaderboardEntry(
            name="You",
            rank=1,
            focus_hours=today.focus_hours,
            focus_minutes=today.focus_minutes,
            distraction_hours=today.distraction_hours,
            distraction_minutes=today.distraction_minutes,
            longest_streak_minutes=today.longest_streak_minutes,
            focus_score=today.focus_score,
        )
    ]


@router.get("/profile", response_model=ProfileResponse)
def profile(user_id: str):
    return ProfileResponse(**tracking.build_profile(user_id=user_id))
