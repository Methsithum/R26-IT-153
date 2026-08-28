"""
Persistence and aggregation for daily focus stats (focus / distraction time
split into hours and minutes). Single-user for now -- there's no auth on
this branch, so every document is keyed by date alone. Adding real
multi-user auth later just means adding a user id to the key; the
aggregation logic here wouldn't otherwise change.
"""
from datetime import date as date_cls
from datetime import timedelta

from app.config.database import get_db
from app.models.focus.daily_stats import (
    FocusDailyStats,
    combine_hm,
    compute_scores,
    split_hm,
)

COLLECTION = "focus_daily_stats"

# All-time focused minutes needed to unlock Tree Whisperer (Focus Tree level).
TREE_WHISPERER_MINUTES = 150


def _collection():
    return get_db()[COLLECTION]


def save_daily_stats(stats: FocusDailyStats) -> None:
    doc = stats.model_dump()
    doc["_id"] = doc.pop("date")
    _collection().replace_one({"_id": doc["_id"]}, doc, upsert=True)


def _is_legacy_doc(doc: dict) -> bool:
    """True when a stored document still uses points / per-type minutes."""
    if "focus_hours" not in doc and "distraction_hours" not in doc:
        return True
    if isinstance(doc.get("distraction_minutes"), dict):
        return True
    if "points" in doc or "intervention_counts" in doc:
        return True
    return False


def stats_from_doc(doc: dict) -> FocusDailyStats:
    """Build a FocusDailyStats from a Mongo document, including legacy ones
    that stored a float `focus_minutes` and a per-type `distraction_minutes` dict."""
    data = dict(doc)
    date = data.pop("_id", None) or data.pop("date", None)
    data.pop("date", None)

    if not _is_legacy_doc(doc):
        return FocusDailyStats(date=date, **data)

    raw_focus = data.get("focus_hours")
    if raw_focus is not None:
        fh, fm = int(raw_focus or 0), int(data.get("focus_minutes") or 0)
    else:
        fh, fm = split_hm(data.get("focus_minutes") or 0)

    raw_dist = data.get("distraction_minutes") or 0
    if isinstance(raw_dist, dict):
        total_d = sum(float(v or 0) for v in raw_dist.values())
        dh, dm = split_hm(total_d)
    elif data.get("distraction_hours") is not None:
        dh, dm = int(data.get("distraction_hours") or 0), int(raw_dist or 0)
    else:
        dh, dm = split_hm(float(raw_dist or 0))

    score, goal = compute_scores(combine_hm(fh, fm), combine_hm(dh, dm), 120)
    interventions = data.get("intervention_counts") or {}
    calm = int(data.get("calm_quest_count") or (interventions.get("Anxiety") if isinstance(interventions, dict) else 0) or 0)
    return FocusDailyStats(
        date=date,
        focus_hours=fh,
        focus_minutes=fm,
        distraction_hours=dh,
        distraction_minutes=dm,
        focus_score=int(data.get("focus_score") or score),
        goal_progress=int(data.get("goal_progress") or goal),
        longest_streak_minutes=int(data.get("longest_streak_minutes") or 0),
        calm_quest_count=calm,
        first_hour=data.get("first_hour"),
        achievements_unlocked=list(data.get("achievements_unlocked") or []),
    )


def _rewrite_if_legacy(doc: dict) -> FocusDailyStats:
    stats = stats_from_doc(doc)
    if _is_legacy_doc(doc):
        save_daily_stats(stats)
    return stats


def get_daily_stats(date_str: str) -> FocusDailyStats:
    doc = _collection().find_one({"_id": date_str})
    if doc is None:
        return FocusDailyStats(date=date_str)
    return _rewrite_if_legacy(doc)


def get_weekly_stats(end_date_str: str | None = None) -> list[FocusDailyStats]:
    """Last 7 days (inclusive of end_date, default today), oldest first."""
    end = date_cls.fromisoformat(end_date_str) if end_date_str else date_cls.today()
    dates = [(end - timedelta(days=i)).isoformat() for i in range(6, -1, -1)]
    return [get_daily_stats(d) for d in dates]


def compute_weekly_insight(days: list[FocusDailyStats]) -> tuple[str | None, str | None, str | None]:
    """Returns (weekday_name, reason, insight_text) for the day with the most
    overall distraction minutes in `days`, or (None, None, None) if the week
    had no distraction at all."""
    scored = [(d, d.total_distraction_minutes) for d in days]
    scored = [pair for pair in scored if pair[1] > 0]
    if not scored:
        return None, None, None

    worst_day, worst_total = max(scored, key=lambda pair: pair[1])
    weekday_name = date_cls.fromisoformat(worst_day.date).strftime("%A")
    dh, dm = split_hm(worst_total)
    time_label = f"{dh}h {dm}m" if dh else f"{dm} min"
    reason = f"{time_label} off-task"
    insight = (
        f"{weekday_name} was your most distracted day this week -- {reason}. "
        f"Next {weekday_name}, try shorter focused blocks with a break in between."
    )
    return weekday_name, reason, insight


def all_saved_stats() -> list[FocusDailyStats]:
    return [_rewrite_if_legacy(doc) for doc in _collection().find({})]


def compute_achievements(
    today: FocusDailyStats,
    week: list[FocusDailyStats],
    all_stats: list[FocusDailyStats],
) -> list[str]:
    """Unlock keys from persisted time / streak / intervention history — never guessed."""
    merged = {d.date: d for d in all_stats}
    merged[today.date] = today
    days = list(merged.values())

    total_focus = sum(d.total_focus_minutes for d in days)
    max_streak = max((d.longest_streak_minutes for d in days), default=0)
    calm = sum(d.calm_quest_count for d in days)
    days_with_focus = [d for d in days if d.total_focus_minutes > 0]
    week_live = [today if d.date == today.date else d for d in week]
    week_focus_days = [d for d in week_live if d.total_focus_minutes > 0]
    unbreakable = len(week_live) == 7 and all(d.total_focus_minutes > 0 for d in week_live)

    earned: list[str] = []
    if max_streak >= 25:
        earned.append("sprint25")
    if calm >= 5:
        earned.append("calmQuest5")
    if calm >= 10:
        earned.append("zenMaster")
    if len(week_focus_days) >= 5:
        earned.append("perfectWeek")
    if today.first_hour is not None and today.first_hour < 7:
        earned.append("earlyBird")
    if today.first_hour is not None and today.first_hour >= 21:
        earned.append("nightOwl")
    if days_with_focus:
        earned.append("teamPlayer")
    if total_focus >= TREE_WHISPERER_MINUTES:
        earned.append("treeWhisperer")
    if unbreakable:
        earned.append("unbreakable")
    return earned


def build_profile(today_override: FocusDailyStats | None = None) -> dict:
    all_stats = all_saved_stats()
    week = get_weekly_stats()
    today = today_override or get_daily_stats(date_cls.today().isoformat())
    if today_override:
        all_stats = [s for s in all_stats if s.date != today_override.date] + [today_override]
        week = [today_override if d.date == today_override.date else d for d in week]

    total_focus = sum(s.total_focus_minutes for s in all_stats)
    total_dist = sum(s.total_distraction_minutes for s in all_stats)
    max_streak = max((s.longest_streak_minutes for s in all_stats), default=0)
    calm = sum(s.calm_quest_count for s in all_stats)
    days_active = sum(1 for s in all_stats if s.total_focus_minutes > 0 or s.total_distraction_minutes > 0)
    achievements = compute_achievements(today, week, all_stats)
    tfh, tfm = split_hm(total_focus)
    tdh, tdm = split_hm(total_dist)
    return {
        "total_focus_hours": tfh,
        "total_focus_minutes": tfm,
        "total_distraction_hours": tdh,
        "total_distraction_minutes": tdm,
        "longest_streak_minutes": max_streak,
        "calm_quest_count": calm,
        "days_active": days_active,
        "achievements_unlocked": achievements,
    }


def get_all_time_totals() -> tuple[int, list[str]]:
    """(total focus minutes, achievement keys) across every saved day."""
    profile = build_profile()
    return combine_hm(profile["total_focus_hours"], profile["total_focus_minutes"]), profile["achievements_unlocked"]
