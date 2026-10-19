from datetime import date as date_cls
from datetime import timedelta

from fastapi import APIRouter

from app.models.focus.daily_stats import FocusDailyStats, challenge_points_for, split_hm
from app.models.user.user import UserModel
from app.schemas.focus.leaderboard import LeaderboardEntry, ProfileResponse
from app.services.focus import tracking

router = APIRouter(prefix="/focus", tags=["focus"])


@router.post("/presence")
def presence(user_id: str):
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


def _month_window(month: str | None, now: date_cls) -> tuple[str, str]:
    try:
        first = date_cls.fromisoformat(f"{month}-01") if month else now.replace(day=1)
    except ValueError:
        first = now.replace(day=1)
    if first > now:
        first = now.replace(day=1)
    next_first = (first.replace(day=28) + timedelta(days=4)).replace(day=1)
    last = min(next_first - timedelta(days=1), now)
    return first.isoformat(), last.isoformat()


def _range_totals(days: list, uid: str):
    focus = sum(d.total_focus_minutes for d in days)
    distraction = sum(d.total_distraction_minutes for d in days)
    tracked = focus + distraction
    fh, fm = split_hm(focus)
    dh, dm = split_hm(distraction)
    return FocusDailyStats(
        date=date_cls.today().isoformat(),
        user_id=uid,
        focus_hours=fh,
        focus_minutes=fm,
        distraction_hours=dh,
        distraction_minutes=dm,
        focus_score=round(focus / tracked * 100) if tracked else 0,
        longest_streak_minutes=max((d.longest_streak_minutes for d in days), default=0),
    )


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
def leaderboard(user_id: str, period: str = "daily", month: str | None = None):
    viewer = (user_id or "").strip() or tracking.DEFAULT_USER
    if viewer != tracking.DEFAULT_USER:
        UserModel.touch_last_seen(viewer)
    people = UserModel.list_all_students()
    today = date_cls.today().isoformat()
    now = date_cls.today()
    window = {
        "weekly": ((now - timedelta(days=6)).isoformat(), today),
        "monthly": _month_window(month, now),
    }.get(period)
    start = window[0] if window else None
    ranged = tracking.get_range_stats_by_user(*window) if window else {}
    rows = []
    for person in people:
        if start:
            days = ranged.get(person["id"], [])
            stats = _range_totals(days, person["id"])
            xp = sum(challenge_points_for(d.challenges_taken, d.focus_boosts) for d in days)
            rows.append({
                "person": person,
                "stats": stats,
                "focus": stats.total_focus_minutes,
                "xp": xp,
            })
            continue
        stats = tracking.get_daily_stats(today, person["id"])
        rows.append({
            "person": person,
            "stats": stats,
            "focus": stats.total_focus_minutes,
            "xp": challenge_points_for(stats.challenges_taken, stats.focus_boosts),
        })
    rows.sort(key=lambda r: (r["xp"], r["focus"]), reverse=True)
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
