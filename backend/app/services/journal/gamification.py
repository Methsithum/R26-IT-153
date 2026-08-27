from app.models.user.user import UserModel
from app.models.journal.daily_session import DailySessionModel
from app.models.journal.task import TaskModel
from app.services.time_utils import local_today, local_today_iso, to_local_date
from datetime import date, datetime, time, timedelta
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


def completed_journal_dates(sessions: List[Dict]) -> List[date]:
    return sorted(
        {
            day
            for session in (sessions or [])
            if session and session.get("completed") and (day := to_local_date(session.get("date")))
        }
    )


def missed_journal_dates(sessions: List[Dict], today: date | None = None) -> List[date]:
    """Calendar gaps after the first completed journal, up to yesterday."""
    today = today or local_today()
    done = completed_journal_dates(sessions)
    if not done:
        return []
    known = set(done)
    missed: List[date] = []
    cursor = done[0]
    while cursor < today:
        if cursor not in known:
            missed.append(cursor)
        cursor += timedelta(days=1)
    return missed


def play_journal_date(sessions: List[Dict], today: date | None = None) -> date | None:
    """Oldest missed day, otherwise today if it is still open."""
    today = today or local_today()
    missed = missed_journal_dates(sessions, today)
    if missed:
        return missed[0]
    if today in set(completed_journal_dates(sessions)):
        return None
    return today


def latest_completed_journal_date(sessions: List[Dict]) -> date | None:
    done = completed_journal_dates(sessions)
    return done[-1] if done else None


def progress_from_sessions(sessions: List[Dict]) -> Tuple[int, bool]:
    completed = [s for s in (sessions or []) if s and s.get("completed")]
    missed = missed_journal_dates(sessions)
    today_done = local_today() in set(completed_journal_dates(sessions))
    if missed:
        return len(completed) + 1, False
    if today_done:
        return max(1, len(completed)), True
    return len(completed) + 1, False


def progress_bundle(sessions: List[Dict]) -> Dict:
    current_day, daily_completed = progress_from_sessions(sessions)
    play = play_journal_date(sessions)
    return {
        "current_day": current_day,
        "daily_completed": daily_completed,
        "missed_dates": [day.isoformat() for day in missed_journal_dates(sessions)],
        "play_date": play.isoformat() if play else None,
    }


def progress_fields(
    user: Dict,
    *,
    current_day: int = 1,
    daily_completed: bool = False,
    missed_dates: List[str] | None = None,
    play_date: str | None = None,
    sessions: List[Dict] | None = None,
    xp_earned: int | None = None,
    new_badges: List[str] | None = None,
) -> Dict:
    if sessions is not None:
        bundle = progress_bundle(sessions)
        current_day = bundle["current_day"]
        daily_completed = bundle["daily_completed"]
        missed_dates = bundle["missed_dates"]
        play_date = bundle["play_date"]
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
        "missed_dates": missed_dates or [],
        "play_date": play_date,
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


def _completed_dates(sessions: List[Dict]) -> List[date]:
    return sorted(
        {
            day
            for session in (sessions or [])
            if session and session.get("completed") and (day := to_local_date(session.get("date")))
        }
    )


def _streaks_from_dates(days: List[date], today: date | None = None) -> Tuple[int, int]:
    if not days:
        return 0, 0
    today = today or date.fromisoformat(local_today_iso())
    longest = 1
    run = 1
    for index in range(1, len(days)):
        gap = (days[index] - days[index - 1]).days
        if gap == 1:
            run += 1
            longest = max(longest, run)
        elif gap > 1:
            run = 1
    current = 0
    if (today - days[-1]).days <= 1:
        current = 1
        for index in range(len(days) - 1, 0, -1):
            if (days[index] - days[index - 1]).days == 1:
                current += 1
            else:
                break
    return current, max(longest, current)


def earned_badge_keys(
    *,
    completed_journals: int,
    current_streak: int,
    longest_streak: int,
    total_xp: int,
    completed_tasks: int,
) -> List[str]:
    badges: List[str] = []
    if completed_journals >= 1:
        badges.append("first_journal")
    streak_best = max(int(current_streak or 0), int(longest_streak or 0))
    for threshold, key in sorted(STREAK_MILESTONES.items()):
        if streak_best >= threshold:
            badges.append(key)
    for threshold, key in sorted(JOURNAL_MILESTONES.items()):
        if completed_journals >= threshold:
            badges.append(key)
    for threshold, key in sorted(XP_MILESTONES.items()):
        if int(total_xp or 0) >= threshold:
            badges.append(key)
    for threshold, key in sorted(TASK_MILESTONES.items()):
        if completed_tasks >= threshold:
            badges.append(key)
    return badges


async def reconcile_user_progress(
    user: Dict,
    sessions: List[Dict],
    *,
    tasks: List[Dict] | None = None,
    total_xp: int | None = None,
    persist: bool = True,
) -> Dict:
    """Rebuild streak, longest streak and badges from remaining journals."""
    if not user:
        return user
    if tasks is None:
        tasks = await TaskModel.find_by_user(user["id"])
    days = _completed_dates(sessions)
    current_streak, longest_streak = _streaks_from_dates(days)
    xp = int(user.get("total_xp") or 0) if total_xp is None else max(0, int(total_xp))
    badges = earned_badge_keys(
        completed_journals=_count_completed_journals(sessions),
        current_streak=current_streak,
        longest_streak=longest_streak,
        total_xp=xp,
        completed_tasks=_count_completed_tasks(tasks),
    )
    last_date = datetime.combine(days[-1], time.min) if days else None
    patch = {
        "total_xp": xp,
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "badges": badges,
        "last_journal_date": last_date,
    }
    previous_badges = list(user.get("badges") or [])
    changed = (
        int(user.get("current_streak") or 0) != current_streak
        or int(user.get("longest_streak") or 0) != longest_streak
        or previous_badges != badges
        or int(user.get("total_xp") or 0) != xp
    )
    if persist and changed:
        await UserModel.update(user["id"], patch)
    user.update(patch)
    return user


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
    sessions = await DailySessionModel.find_user_sessions(user_id)
    tasks = await TaskModel.find_by_user(user_id)
    total_xp = int(user.get("total_xp") or 0) + xp_earned
    previous = set(user.get("badges") or [])
    user = await reconcile_user_progress(
        user,
        sessions,
        tasks=tasks,
        total_xp=total_xp,
        persist=True,
    )
    new_badges = [BADGES[key] for key in user.get("badges") or [] if key not in previous and key in BADGES]
    return xp_earned, new_badges


async def apply_run_rewards(user_id: str, session_id: str, xp_earned: int, score: int) -> Dict:
    """Reconcile campus-run XP with the journal award so level-ups persist."""
    user = await UserModel.find_by_id(user_id)
    session = await DailySessionModel.find_by_id(session_id)
    if not user or not session:
        return {}

    sessions = await DailySessionModel.find_user_sessions(user_id)

    already = int(session.get("xp_earned") or 0)
    if session.get("run_xp_applied"):
        return progress_fields(user, sessions=sessions, xp_earned=already, new_badges=[])

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
    sessions = await DailySessionModel.find_user_sessions(user_id)
    return progress_fields(user, sessions=sessions, xp_earned=awarded, new_badges=new_badges)


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
    tasks = await TaskModel.find_by_user(user_id)
    user = await reconcile_user_progress(user, sessions, tasks=tasks)
    completed_journals = _count_completed_journals(sessions)
    completed_tasks = _count_completed_tasks(tasks)

    total_xp = int(user.get("total_xp", 0) or 0)
    current_streak = user.get("current_streak", 0)

    next_badge = _next_badge_progress(
        badges=user.get("badges", []),
        current_streak=max(current_streak, int(user.get("longest_streak") or 0)),
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
        **progress_fields(user, sessions=sessions),
        "completed_journals": completed_journals,
        "completed_tasks": completed_tasks,
        "combined_score": _combined_score(user),
        "leaderboard_rank": rank,
        "next_badge": next_badge,
    }