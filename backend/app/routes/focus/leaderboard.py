from datetime import date as date_cls

from fastapi import APIRouter

from app.models.focus.daily_stats import challenge_points_for
from app.models.user.user import UserModel
from app.schemas.focus.leaderboard import LeaderboardEntry, ProfileResponse
from app.services.focus import tracking

router = APIRouter(prefix="/focus", tags=["focus"])


@router.post("/presence")
def presence(user_id: str):
    """Mark this user as online (heartbeat while Focus is open)."""
    uid = (user_id or "").strip()
    if not uid or uid == tracking.DEFAULT_USER:
        return {"ok": False}
    UserModel.touch_last_seen(uid)
    return {"ok": True}


@router.post("/presence/leave")
def presence_leave(user_id: str):
    uid = (user_id or "").strip()
    if uid and uid != tracking.DEFAULT_USER:
        UserModel.clear_last_seen(uid)
    return {"ok": True}


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
def leaderboard(user_id: str):
    """Every registered student, ranked by today's focused minutes."""
    viewer = (user_id or "").strip() or tracking.DEFAULT_USER
    if viewer != tracking.DEFAULT_USER:
        UserModel.touch_last_seen(viewer)
    people = UserModel.list_all_students()
    today = date_cls.today().isoformat()
    rows = []
    for person in people:
        stats = tracking.get_daily_stats(today, person["id"])
        rows.append({
            "person": person,
            "stats": stats,
            "focus": stats.total_focus_minutes,
            "xp": challenge_points_for(stats.challenges_taken, stats.focus_boosts),
        })
    rows.sort(key=lambda r: (r["focus"], r["xp"]), reverse=True)
    out = []
    for i, row in enumerate(rows, start=1):
        stats = row["stats"]
        person = row["person"]
        out.append(LeaderboardEntry(
            user_id=person["id"],
            name=person["name"],
            rank=i,
            is_you=person["id"] == viewer,
            online=person["online"] or person["id"] == viewer,
            focus_hours=stats.focus_hours,
            focus_minutes=stats.focus_minutes,
            distraction_hours=stats.distraction_hours,
            distraction_minutes=stats.distraction_minutes,
            longest_streak_minutes=stats.longest_streak_minutes,
            focus_score=stats.focus_score,
            challenge_points=row["xp"],
        ))
    return out


@router.get("/profile", response_model=ProfileResponse)
def profile(user_id: str):
    return ProfileResponse(**tracking.build_profile(user_id=user_id))
