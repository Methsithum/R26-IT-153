"""Gamification Simulator: a stateless what-if projector. It reuses the
exact XP/streak/badge formulas from gamification.py so the simulator can
never drift from the real rules, but it never reads or writes a real user's
data - the caller supplies (or omits) a starting point and a hypothetical
day-by-day plan."""

from datetime import date, timedelta
from typing import Dict, List, Optional

from app.services.journal.gamification import (
    BADGES,
    _calculate_xp,
    _streaks_from_dates,
    earned_badge_keys,
)

MAX_PLAN_DAYS = 90


def simulate_gamification(
    plan: List[Dict],
    *,
    starting_total_xp: int = 0,
    starting_badges: Optional[List[str]] = None,
    starting_completed_journals: int = 0,
    starting_completed_tasks: int = 0,
) -> Dict:
    """
    plan: ordered list of daily entries, one per simulated calendar day:
        {"play": bool, "on_time": bool, "questions_count": int,
         "engagement": "low"|"medium"|"high", "has_at_risk": bool}
    A day with "play": False is a day the journal was skipped entirely
    (breaks the streak, same as a real missed day).
    """
    plan = plan[:MAX_PLAN_DAYS]
    today = date(2000, 1, 1)  # arbitrary anchor; only relative gaps matter
    total_xp = max(0, int(starting_total_xp))
    badges = list(starting_badges or [])
    completed_journals = int(starting_completed_journals)
    on_time_dates: List[date] = []
    timeline = []

    for index, day in enumerate(plan):
        day_date = today + timedelta(days=index)
        xp_earned = 0
        if day.get("play"):
            xp_earned = _calculate_xp(
                int(day.get("questions_count") or 0),
                day.get("engagement"),
                bool(day.get("has_at_risk")),
            )
            total_xp += xp_earned
            completed_journals += 1
            if day.get("on_time", True):
                on_time_dates.append(day_date)

        current_streak, longest_streak = _streaks_from_dates(on_time_dates, today=day_date)
        newly_earned = earned_badge_keys(
            completed_journals=completed_journals,
            current_streak=current_streak,
            longest_streak=longest_streak,
            total_xp=total_xp,
            completed_tasks=starting_completed_tasks,
        )
        kept_streak_badges = [k for k in badges if k.startswith("streak_") and k not in newly_earned]
        badges = newly_earned + kept_streak_badges

        timeline.append(
            {
                "day": index + 1,
                "played": bool(day.get("play")),
                "on_time": bool(day.get("on_time", True)) if day.get("play") else None,
                "xp_earned": xp_earned,
                "total_xp": total_xp,
                "current_streak": current_streak,
                "longest_streak": longest_streak,
                "badges": list(badges),
            }
        )

    return {
        "days_simulated": len(plan),
        "final_total_xp": total_xp,
        "final_current_streak": timeline[-1]["current_streak"] if timeline else 0,
        "final_longest_streak": timeline[-1]["longest_streak"] if timeline else 0,
        "final_badges": [{"key": k, "name": BADGES.get(k, k)} for k in badges],
        "timeline": timeline,
    }
