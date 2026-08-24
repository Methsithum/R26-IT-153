from fastapi import APIRouter

from app.schemas.focus.leaderboard import LeaderboardEntry, ProfileResponse
from app.services.focus import tracking

router = APIRouter(prefix="/focus", tags=["focus"])


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
def leaderboard():
    """Single entry for now (no auth/multi-user yet) -- shaped as a list so
    adding real users later doesn't change the response shape."""
    total_points, _ = tracking.get_all_time_totals()
    return [LeaderboardEntry(name="You", points=total_points, rank=1)]


@router.get("/profile", response_model=ProfileResponse)
def profile():
    total_points, achievements = tracking.get_all_time_totals()
    return ProfileResponse(total_points=total_points, achievements_unlocked=achievements)
