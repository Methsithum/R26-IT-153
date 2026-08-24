"""
Persistence and aggregation for daily focus stats (points, focus time,
distraction breakdown, achievements). Single-user for now -- there's no auth
on this branch, so every document is keyed by date alone. Adding real
multi-user auth later just means adding a user id to the key; the
aggregation logic here wouldn't otherwise change.
"""
from datetime import date as date_cls
from datetime import timedelta

from app.config.database import get_db
from app.models.focus.daily_stats import FocusDailyStats

COLLECTION = "focus_daily_stats"

DISTRACTION_TIPS = {
    "Fatigue": "try taking a couple of short breaks earlier in the session",
    "Anxiety": "a few deep-breathing pauses before you start might help",
    "Boredom": "mixing in a short reward or a change of material could help",
}


def _collection():
    return get_db()[COLLECTION]


def save_daily_stats(stats: FocusDailyStats) -> None:
    doc = stats.model_dump()
    doc["_id"] = doc.pop("date")
    _collection().replace_one({"_id": doc["_id"]}, doc, upsert=True)


def get_daily_stats(date_str: str) -> FocusDailyStats:
    doc = _collection().find_one({"_id": date_str})
    if doc is None:
        return FocusDailyStats(date=date_str)
    doc["date"] = doc.pop("_id")
    return FocusDailyStats(**doc)


def get_weekly_stats(end_date_str: str | None = None) -> list[FocusDailyStats]:
    """Last 7 days (inclusive of end_date, default today), oldest first."""
    end = date_cls.fromisoformat(end_date_str) if end_date_str else date_cls.today()
    dates = [(end - timedelta(days=i)).isoformat() for i in range(6, -1, -1)]
    return [get_daily_stats(d) for d in dates]


def compute_weekly_insight(days: list[FocusDailyStats]) -> tuple[str | None, str | None, str | None]:
    """Returns (weekday_name, reason, insight_text) for the day with the most
    total distraction minutes in `days`, or (None, None, None) if the week
    had no distraction at all."""
    scored = [(d, sum(d.distraction_minutes.values())) for d in days]
    scored = [pair for pair in scored if pair[1] > 0]
    if not scored:
        return None, None, None

    worst_day, worst_total = max(scored, key=lambda pair: pair[1])
    dominant_type = max(worst_day.distraction_minutes, key=worst_day.distraction_minutes.get)
    weekday_name = date_cls.fromisoformat(worst_day.date).strftime("%A")
    tip = DISTRACTION_TIPS.get(dominant_type, "")
    reason = f"mostly {dominant_type.lower()} ({worst_day.distraction_minutes[dominant_type]:.0f} min)"
    insight = (
        f"{weekday_name} was your most distracted day this week -- {worst_total:.0f} minutes off-task, "
        f"{reason}. Next {weekday_name}, {tip}."
    )
    return weekday_name, reason, insight


def get_all_time_totals() -> tuple[int, list[str]]:
    """(total points, sorted unique achievement keys) across every saved day."""
    total_points = 0
    achievements: set[str] = set()
    for doc in _collection().find({}, {"points": 1, "achievements_unlocked": 1}):
        total_points += doc.get("points", 0)
        achievements.update(doc.get("achievements_unlocked", []))
    return total_points, sorted(achievements)
