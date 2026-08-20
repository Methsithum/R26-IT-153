from app.models.user.user import UserModel
from app.models.journal.daily_session import DailySessionModel
from app.models.journal.task import TaskModel
from app.services.time_utils import local_today_iso, to_local_date
from datetime import datetime
from typing import Dict, List, Tuple

XP_PER_LEVEL = 500
MAX_SESSION_XP = 2500

BADGES = {
    "first_journal": "First Journal Entry",
    "streak_3": "3-Day Streak",
    "streak_7": "7-Day Streak",
    "streak_30": "30-Day Streak",
    "journal_10": "10 Journals",
    "journal_30": "30 Journals",
    "journal_50": "50 Journals",
    "xp_500": "500 XP",
    "xp_1000": "1000 XP",
    "xp_2500": "2500 XP",
    "tasks_5": "5 Tasks Completed",
    "tasks_10": "10 Tasks Completed",
}

STREAK_MILESTONES = {
    3: "streak_3",
    7: "streak_7",
    30: "streak_30",
}
JOURNAL_MILESTONES = {
    10: "journal_10",
    30: "journal_30",
    50: "journal_50",
}
XP_MILESTONES = {
    500: "xp_500",
    1000: "xp_1000",
    2500: "xp_2500",
}
TASK_MILESTONES = {
    5: "tasks_5",
    10: "tasks_10",
}

COMPLETED_TASK_STAGES = {"completed", "joined"}


def level_from_xp(total_xp: int) -> int:
    return max(1, int(total_xp or 0) // XP_PER_LEVEL + 1)


def xp_into_level(total_xp: int) -> int:
    return int(total_xp or 0) % XP_PER_LEVEL


def progress_from_sessions(sessions: List[Dict]) -> Tuple[int, bool]:
    completed = [s for s in (sessions or []) if s and s.get("completed")]
    completed.sort(key=lambda s: str(s.get("date") or ""))
    today = local_today_iso()

    def _session_date_key(value) -> str | None:
        day = to_local_date(value)
        return day.isoformat() if day else None

    today_done = any(_session_date_key(s.get("date")) == today for s in completed)
    if today_done:
        return max(1, len(completed)), True
    return len(completed) + 1, False


def progress_fields(
    user: Dict,
    *,
    current_day: int = 1,
    daily_completed: bool = False,
    xp_earned: int | None = None,
    new_badges: List[str] | None = None,
) -> Dict:
    total_xp = int(user.get("total_xp") or 0)
    payload = {
        "total_xp": total_xp,
        "level": level_from_xp(total_xp),
        "xp_into_level": xp_into_level(total_xp),
        "xp_per_level": XP_PER_LEVEL,
        "current_streak": int(user.get("current_streak") or 0),
        "longest_streak": int(user.get("longest_streak") or 0),
        "badges": user.get("badges") or [],
        "current_day": current_day,
        "daily_completed": daily_completed,
    }
    if xp_earned is not None:
        payload["xp_earned"] = int(xp_earned)
    if new_badges is not None:
        payload["new_badges"] = new_badges
    return payload


def _calculate_xp(questions_count: int, engagement: str | None, has_at_risk: bool) -> int:
    xp = 30 + (2 * max(0, questions_count))
    if (engagement or "").lower() == "high":
        xp += 10
    if has_at_risk:
        xp += 5
    return min(xp, 120)


def _award_milestone_badges(
    badges: List[str],
    milestones: Dict[int, str],
    current_value: int,
    new_badges: List[str],
) -> None:
    for threshold in sorted(milestones.keys()):
        badge_key = milestones[threshold]
        if current_value >= threshold and badge_key not in badges:
            badges.append(badge_key)
            new_badges.append(BADGES[badge_key])


def _count_completed_journals(sessions: List[Dict]) -> int:
    return sum(1 for s in sessions if s.get("completed"))


def _count_completed_tasks(tasks: List[Dict]) -> int:
    completed = 0
    for task in tasks:
        stage = (task.get("progress_stage") or "").lower()
        if stage in COMPLETED_TASK_STAGES:
            completed += 1
    return completed


async def update_streak_and_xp(
    user_id: str,
    date: datetime,
    questions_count: int = 0,
    engagement: str | None = None,
    has_at_risk: bool = False,
) -> Tuple[int, List[str]]:
    user = await UserModel.find_by_id(user_id)
    if not user:
        return 0, []

    xp_earned = _calculate_xp(questions_count, engagement, has_at_risk)
    new_badges: List[str] = []

    last = user.get("last_journal_date")
    today = date.replace(hour=0, minute=0, second=0, microsecond=0)
    current_streak = user.get("current_streak", 0)
    longest_streak = user.get("longest_streak", 0)

    if last:
        last_date = last.replace(hour=0, minute=0, second=0, microsecond=0)
        day_diff = (today - last_date).days
        if day_diff == 1:
            current_streak += 1
        elif day_diff > 1:
            current_streak = 1
    else:
        current_streak = 1

    if current_streak > longest_streak:
        longest_streak = current_streak

    badges = user.get("badges", [])
    if not last and "first_journal" not in badges:
        badges.append("first_journal")
        new_badges.append(BADGES["first_journal"])

    _award_milestone_badges(badges, STREAK_MILESTONES, current_streak, new_badges)

    sessions = await DailySessionModel.find_user_sessions(user_id)
    completed_journals = _count_completed_journals(sessions)
    _award_milestone_badges(badges, JOURNAL_MILESTONES, completed_journals, new_badges)

    total_xp = user.get("total_xp", 0) + xp_earned
    _award_milestone_badges(badges, XP_MILESTONES, total_xp, new_badges)

    tasks = await TaskModel.find_by_user(user_id)
    completed_tasks = _count_completed_tasks(tasks)
    _award_milestone_badges(badges, TASK_MILESTONES, completed_tasks, new_badges)

    await UserModel.update(user_id, {
        "total_xp": total_xp,
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "badges": badges,
        "last_journal_date": today
    })
    return xp_earned, new_badges


async def apply_run_rewards(user_id: str, session_id: str, xp_earned: int, score: int) -> Dict:
    """Reconcile campus-run XP with the journal award so level-ups persist."""
    user = await UserModel.find_by_id(user_id)
    session = await DailySessionModel.find_by_id(session_id)
    if not user or not session:
        return {}

    sessions = await DailySessionModel.find_user_sessions(user_id)
    current_day, daily_completed = progress_from_sessions(sessions)

    already = int(session.get("xp_earned") or 0)
    if session.get("run_xp_applied"):
        return progress_fields(
            user,
            current_day=current_day,
            daily_completed=daily_completed,
            xp_earned=already,
            new_badges=[],
        )

    awarded = min(MAX_SESSION_XP, max(already, int(xp_earned or 0)))
    delta = awarded - already
    total_xp = max(0, int(user.get("total_xp") or 0) + delta)
    badges = list(user.get("badges") or [])
    new_badges: List[str] = []
    _award_milestone_badges(badges, XP_MILESTONES, total_xp, new_badges)

    await UserModel.update(user_id, {"total_xp": total_xp, "badges": badges})
    await DailySessionModel.update(
        session_id,
        {
            "xp_earned": awarded,
            "score_earned": max(0, int(score or 0)),
            "run_xp_applied": True,
        },
    )
    user = await UserModel.find_by_id(user_id) or {**user, "total_xp": total_xp, "badges": badges}
    return progress_fields(
        user,
        current_day=current_day,
        daily_completed=True,
        xp_earned=awarded,
        new_badges=new_badges,
    )


def _combined_score(user: Dict) -> int:
    return int(user.get("total_xp", 0)) + (int(user.get("current_streak", 0)) * 10)


def _next_badge_progress(
    badges: List[str],
    current_streak: int,
    total_xp: int,
    completed_journals: int,
    completed_tasks: int,
) -> Dict[str, int | str | float] | None:
    candidates: List[Tuple[str, int, int]] = []

    for threshold, key in STREAK_MILESTONES.items():
        if key not in badges:
            candidates.append((key, threshold, current_streak))

    for threshold, key in JOURNAL_MILESTONES.items():
        if key not in badges:
            candidates.append((key, threshold, completed_journals))

    for threshold, key in XP_MILESTONES.items():
        if key not in badges:
            candidates.append((key, threshold, total_xp))

    for threshold, key in TASK_MILESTONES.items():
        if key not in badges:
            candidates.append((key, threshold, completed_tasks))

    if not candidates:
        return None

    closest = min(candidates, key=lambda c: max(0, c[1] - c[2]))
    badge_key, threshold, current_value = closest
    progress = 0.0 if threshold <= 0 else min(1.0, current_value / threshold)
    return {
        "badge": badge_key,
        "label": BADGES.get(badge_key, badge_key),
        "current": current_value,
        "target": threshold,
        "progress": round(progress, 4),
    }


async def get_leaderboard(limit: int = 10) -> List[Dict]:
    users = await UserModel.list_users()
    scored = []
    for user in users:
        scored.append({
            "user_id": user.get("id"),
            "name": user.get("name"),
            "total_xp": user.get("total_xp", 0),
            "level": level_from_xp(user.get("total_xp", 0)),
            "current_streak": user.get("current_streak", 0),
            "combined_score": _combined_score(user),
        })
    scored.sort(key=lambda u: u["combined_score"], reverse=True)
    return scored[:max(1, limit)]


async def get_gamification_summary(user_id: str) -> Dict | None:
    user = await UserModel.find_by_id(user_id)
    if not user:
        return None

    sessions = await DailySessionModel.find_user_sessions(user_id)
    completed_journals = _count_completed_journals(sessions)

    tasks = await TaskModel.find_by_user(user_id)
    completed_tasks = _count_completed_tasks(tasks)

    total_xp = int(user.get("total_xp", 0) or 0)
    current_streak = user.get("current_streak", 0)
    current_day, daily_completed = progress_from_sessions(sessions)

    next_badge = _next_badge_progress(
        badges=user.get("badges", []),
        current_streak=current_streak,
        total_xp=total_xp,
        completed_journals=completed_journals,
        completed_tasks=completed_tasks,
    )

    leaderboard = await get_leaderboard(limit=100)
    rank = None
    for idx, entry in enumerate(leaderboard, start=1):
        if entry.get("user_id") == user.get("id"):
            rank = idx
            break

    return {
        "user_id": user.get("id"),
        "user_name": user.get("name"),
        **progress_fields(user, current_day=current_day, daily_completed=daily_completed),
        "completed_journals": completed_journals,
        "completed_tasks": completed_tasks,
        "combined_score": _combined_score(user),
        "leaderboard_rank": rank,
        "next_badge": next_badge,
    }