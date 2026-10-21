"""engagement_service.py"""

from collections import defaultdict
from datetime import date, timedelta

from app.services.time_utils import to_local_date

OULAD_MEDIAN_WEEKLY_CLICKS = 46.03
OULAD_P90_WEEKLY_CLICKS = 128.57
OULAD_MEDIAN_CLICKS_TREND = -31.63
CLICKS_TREND_RANGE = (-130.0, 130.0)

# Used when the planner has no allocation for a subject (e.g. nothing due soon)
DEFAULT_PLANNED_WEEKLY_MINUTES = 180
# Long enough to show a real pattern, short enough to reflect recent habits.
MAX_WEEKS_OBSERVED = 8


def _week_start(day: date) -> date:
    return day - timedelta(days=day.weekday())


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def minutes_by_subject_week(sessions: list[dict]) -> dict[str, dict[date, float]]:
    """Study minutes per subject per Monday-week."""
    totals: dict[str, dict[date, float]] = defaultdict(lambda: defaultdict(float))
    for session in sessions:
        minutes = session.get("study_duration_minutes") or 0
        day = to_local_date(session.get("date"))
        if minutes <= 0 or not day:
            continue
        week = _week_start(day)
        focus = session.get("subject_focus")
        subjects = [focus] if focus else [s for s in (session.get("today_subjects") or []) if s]
        for subject in subjects:
            totals[subject][week] += minutes / len(subjects)
    return totals


def compute_engagement_features(
    sessions: list[dict],
    planned_weekly_minutes: dict[str, float],
    today: date,
    semester_start: date | None = None,
) -> dict[str, dict]:
    """{subject"""
    by_subject = minutes_by_subject_week(sessions)
    last_complete_week = _week_start(today) - timedelta(days=7)

    all_weeks = [w for weeks in by_subject.values() for w in weeks]
    if semester_start:
        first_week = _week_start(semester_start)
    elif all_weeks:
        first_week = min(all_weeks)
    else:
        return {}
    first_week = max(first_week, last_complete_week - timedelta(weeks=MAX_WEEKS_OBSERVED - 1))
    if first_week > last_complete_week:
        return {}

    weeks = []
    w = first_week
    while w <= last_complete_week:
        weeks.append(w)
        w += timedelta(days=7)

    features = {}
    for subject, planned in planned_weekly_minutes.items():
        planned = planned if planned and planned > 0 else DEFAULT_PLANNED_WEEKLY_MINUTES
        weekly = [by_subject.get(subject, {}).get(week, 0.0) for week in weeks]
        ratios = [minutes / planned for minutes in weekly]
        mean_ratio = sum(ratios) / len(ratios)
        if len(ratios) >= 2:
            earlier = ratios[:-1]
            trend_delta = ratios[-1] - sum(earlier) / len(earlier)
        else:
            trend_delta = 0.0
        features[subject] = {
            "avg_weekly_clicks": round(_clamp(mean_ratio * OULAD_MEDIAN_WEEKLY_CLICKS, 0.0, OULAD_P90_WEEKLY_CLICKS), 2),
            "clicks_trend": round(
                _clamp(OULAD_MEDIAN_CLICKS_TREND + trend_delta * OULAD_MEDIAN_WEEKLY_CLICKS, *CLICKS_TREND_RANGE), 2
            ),
            "active_weeks_ratio": round(sum(1 for m in weekly if m > 0) / len(weekly), 3),
            "has_vle_activity": 1 if any(by_subject.get(subject, {}).values()) else 0,
            "weeks_observed": len(weeks),
            "minutes_per_week": round(sum(weekly) / len(weekly), 1),
        }
    return features
