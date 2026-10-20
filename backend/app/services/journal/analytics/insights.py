"""Learning Patterns: a read-only statistics view over a user's own
completed daily_sessions. Pure stdlib stats only (see stats.py) - no ML
models, nothing trained, nothing written back to the database."""

from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from app.models.journal.daily_session import DailySessionModel
from app.models.user.user import UserModel
from app.services.journal.gamification import _on_time_dates, _streaks_from_dates
from app.services.time_utils import LOCAL_TZ, local_today, to_local_date

from .stats import (
    MANN_KENDALL_Z_THRESHOLD,
    mad_zscores,
    mann_kendall_test,
    normalized_entropy,
    safe_mean,
    shannon_entropy,
    spearman_corr,
    spearman_p_value,
    theil_sen_slope,
)

ALLOWED_WINDOWS = (14, 30, 60, 90)
ANOMALY_MIN_ACTIVE_DAYS = 10
TREND_MIN_ACTIVE_DAYS = 7
SCATTER_MIN_N_FOR_CORRELATION = 10
SUBJECT_TOP_N = 8
WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
ENGAGEMENT_SCORE = {"low": 1, "medium": 2, "high": 3}
MINUTES_BIN_EDGES = [0, 30, 60, 90, 120, 180, float("inf")]
MINUTES_BIN_LABELS = ["0-30", "30-60", "60-90", "90-120", "120-180", "180+"]


class InvalidWindowError(ValueError):
    pass


def _completed(sessions: List[Dict]) -> List[Dict]:
    return [s for s in (sessions or []) if s and s.get("completed") and to_local_date(s.get("date"))]


def _local_hour(created_at) -> Optional[int]:
    if not isinstance(created_at, datetime):
        return None
    dt = created_at if created_at.tzinfo else created_at.replace(tzinfo=timezone.utc)
    return dt.astimezone(LOCAL_TZ).hour


def _week_start(day) -> str:
    return (day - timedelta(days=day.weekday())).isoformat()


def _timing(session: Dict) -> str:
    is_catchup = session.get("is_catchup")
    if is_catchup is True:
        return "catch_up"
    if is_catchup is False:
        return "on_time"
    return "not_recorded"


_TIMING_PRIORITY = {"on_time": 0, "catch_up": 1, "not_recorded": 2}


def _merge_same_date_sessions(by_date: Dict) -> List[Dict]:
    """Duplicates on one date count once as an active day with summed
    minutes; sessions count still reflects how many raw session docs that
    covers."""
    merged = []
    for day, day_sessions in sorted(by_date.items()):
        minutes = sum(int(s.get("study_duration_minutes") or 0) for s in day_sessions)
        xp = sum(int(s.get("xp_earned") or 0) for s in day_sessions)
        subjects = sorted({s.get("subject_focus") for s in day_sessions if s.get("subject_focus")})
        scores = [ENGAGEMENT_SCORE[s["engagement"]] for s in day_sessions if s.get("engagement") in ENGAGEMENT_SCORE]
        engagement_score = round(sum(scores) / len(scores), 2) if scores else None
        timing = min((_timing(s) for s in day_sessions), key=lambda t: _TIMING_PRIORITY[t])
        merged.append(
            {
                "date": day.isoformat(),
                "study_minutes": minutes,
                "xp": xp,
                "sessions": len(day_sessions),
                "engagement_score": engagement_score,
                "subjects": subjects,
                "timing": timing,
            }
        )
    return merged


def _trend_label(mk: dict, active_days: int) -> str:
    if active_days < TREND_MIN_ACTIVE_DAYS:
        return "insufficient data"
    if mk["z"] > MANN_KENDALL_Z_THRESHOLD:
        return "increasing"
    if mk["z"] < -MANN_KENDALL_Z_THRESHOLD:
        return "decreasing"
    return "no significant trend (not enough evidence)"


def _trend_block(daily: List[Dict], key: str, active_days: int) -> Dict:
    values = [d[key] for d in daily]
    xs = list(range(len(values)))
    slope = theil_sen_slope(xs, values) if len(values) >= 2 else 0.0
    mk = mann_kendall_test(values)
    return {
        "slope_per_day": round(slope, 3),
        "mann_kendall": {**mk, "threshold_z": MANN_KENDALL_Z_THRESHOLD},
        "label": _trend_label(mk, active_days),
        "method": "Theil-Sen median-of-pairwise-slopes; Mann-Kendall S/Z/two-sided-p, |Z|>=1.96 (p<=0.05) = significant",
    }


async def build_learning_patterns(user_id: str, window_days: int = 30) -> Dict:
    if window_days not in ALLOWED_WINDOWS:
        raise InvalidWindowError(f"window must be one of {ALLOWED_WINDOWS}")

    all_sessions = await DailySessionModel.find_user_sessions(user_id)
    today = local_today()
    window_start = today - timedelta(days=window_days - 1)

    user = await UserModel.find_by_id(user_id)
    account_created = to_local_date(user.get("created_at")) if user else None
    account_age_days = (today - account_created).days + 1 if account_created else None
    # Don't let a brand-new account's small window get judged against the full
    # window_days - cap the "days observed" at how long the account has existed.
    effective_window_days = min(window_days, account_age_days) if account_age_days else window_days

    completed = _completed(all_sessions)
    in_window = [s for s in completed if window_start <= to_local_date(s["date"]) <= today]

    by_date: Dict = {}
    for s in in_window:
        by_date.setdefault(to_local_date(s["date"]), []).append(s)
    daily = _merge_same_date_sessions(by_date)

    n_active_days = len(daily)
    n_sessions = len(in_window)

    # --- weekly aggregates ---
    weekly: Dict[str, Dict] = {}
    for d in daily:
        day = to_local_date(d["date"])
        wk = _week_start(day)
        bucket = weekly.setdefault(wk, {"week_start": wk, "total_minutes": 0, "total_xp": 0, "active_days": 0, "journals": 0})
        bucket["total_minutes"] += d["study_minutes"]
        bucket["total_xp"] += d["xp"]
        bucket["active_days"] += 1
        bucket["journals"] += d["sessions"]
    weekly_aggregates = sorted(weekly.values(), key=lambda w: w["week_start"])

    # --- weekday distribution ---
    weekday_journals = [0] * 7
    weekday_minutes = [0] * 7
    for d in daily:
        wd = to_local_date(d["date"]).weekday()
        weekday_journals[wd] += d["sessions"]
        weekday_minutes[wd] += d["study_minutes"]
    weekday_distribution = {
        "labels": WEEKDAY_LABELS,
        "journals": weekday_journals,
        "minutes": weekday_minutes,
        "entropy_bits": shannon_entropy(weekday_journals),
        "normalized_entropy": normalized_entropy(weekday_journals),
    }

    # --- trends ---
    trend_minutes = _trend_block(daily, "study_minutes", n_active_days)
    trend_xp = _trend_block(daily, "xp", n_active_days)

    # --- anomalies (MAD), only with enough active days ---
    anomalies = []
    if n_active_days >= ANOMALY_MIN_ACTIVE_DAYS:
        minutes_values = [d["study_minutes"] for d in daily]
        zscores = mad_zscores(minutes_values)
        anomalies = [
            {"date": d["date"], "study_minutes": d["study_minutes"], "robust_zscore": z}
            for d, z in zip(daily, zscores)
            if abs(z) >= 3.5
        ]

    # --- minutes histogram (days with minutes > 0 only) ---
    recorded_minute_days = [d["study_minutes"] for d in daily if d["study_minutes"] > 0]
    bin_counts = [0] * (len(MINUTES_BIN_EDGES) - 1)
    for v in recorded_minute_days:
        for i in range(len(MINUTES_BIN_EDGES) - 1):
            if MINUTES_BIN_EDGES[i] <= v < MINUTES_BIN_EDGES[i + 1]:
                bin_counts[i] += 1
                break
    minutes_histogram = {
        "bin_labels": MINUTES_BIN_LABELS,
        "counts": bin_counts,
        "n_days_with_minutes": len(recorded_minute_days),
        "method": "fixed bins (minutes): 0-30/30-60/60-90/90-120/120-180/180+, days with 0 recorded minutes excluded",
    }

    # --- engagement distribution ---
    engagement_counts = {"low": 0, "medium": 0, "high": 0}
    for s in in_window:
        eng = s.get("engagement")
        if eng in engagement_counts:
            engagement_counts[eng] += 1
    engagement_per_week: Dict[str, Dict] = {}
    for s in in_window:
        wk = _week_start(to_local_date(s["date"]))
        bucket = engagement_per_week.setdefault(wk, {"week_start": wk, "low": 0, "medium": 0, "high": 0})
        eng = s.get("engagement")
        if eng in ("low", "medium", "high"):
            bucket[eng] += 1
    engagement_distribution = {
        "counts": engagement_counts,
        "per_week": sorted(engagement_per_week.values(), key=lambda w: w["week_start"]),
        "entropy_bits": shannon_entropy(list(engagement_counts.values())),
        "normalized_entropy": normalized_entropy(list(engagement_counts.values())),
        "any_recorded": sum(engagement_counts.values()) > 0,
    }

    # --- subject effort (top 8 + other) ---
    # A session can cover several subjects (e.g. a lecture subject and an
    # assignment subject on the same day) - today_subjects holds all of them,
    # while subject_focus is just whichever one was answered last. Crediting
    # only subject_focus would silently drop every other subject from a
    # multi-subject session.
    subject_minutes: Dict[str, int] = {}
    subject_journals: Dict[str, int] = {}
    for s in in_window:
        subjects = s.get("today_subjects") or ([s["subject_focus"]] if s.get("subject_focus") else [])
        if not subjects:
            continue
        minutes = int(s.get("study_duration_minutes") or 0)
        for subj in subjects:
            if not subj:
                continue
            subject_minutes[subj] = subject_minutes.get(subj, 0) + minutes
            subject_journals[subj] = subject_journals.get(subj, 0) + 1
    minutes_recorded = any(v > 0 for v in subject_minutes.values())
    sort_key = subject_minutes if minutes_recorded else subject_journals
    ordered_subjects = sorted(sort_key.keys(), key=lambda k: sort_key[k], reverse=True)
    top_subjects = ordered_subjects[:SUBJECT_TOP_N]
    other_subjects = ordered_subjects[SUBJECT_TOP_N:]
    subject_rows = [
        {"subject": subj, "minutes": subject_minutes.get(subj, 0), "journals": subject_journals.get(subj, 0)}
        for subj in top_subjects
    ]
    if other_subjects:
        subject_rows.append(
            {
                "subject": "Other",
                "minutes": sum(subject_minutes.get(s, 0) for s in other_subjects),
                "journals": sum(subject_journals.get(s, 0) for s in other_subjects),
            }
        )
    subject_counts_for_entropy = [row["minutes"] if minutes_recorded else row["journals"] for row in subject_rows]
    subject_effort = {
        "sorted_by": "minutes" if minutes_recorded else "journals",
        "rows": subject_rows,
        "entropy_bits": shannon_entropy(subject_counts_for_entropy),
        "normalized_entropy": normalized_entropy(subject_counts_for_entropy),
    }

    # --- scatter: study minutes vs xp, with Spearman ---
    scatter_points = [{"study_minutes": d["study_minutes"], "xp": d["xp"], "date": d["date"]} for d in daily][:200]
    minutes_all = [d["study_minutes"] for d in daily]
    xp_all = [d["xp"] for d in daily]
    rho = spearman_corr(minutes_all, xp_all)
    n_points = len(daily)
    if rho is None:
        reason = "n < 2" if n_points < 2 else "study minutes or XP never varies across the window"
        correlation = {"rho": None, "n": n_points, "p": None, "reason": reason}
    elif n_points < SCATTER_MIN_N_FOR_CORRELATION:
        correlation = {"rho": rho, "n": n_points, "p": None, "reason": f"fewer than {SCATTER_MIN_N_FOR_CORRELATION} active days"}
    else:
        correlation = {"rho": rho, "n": n_points, "p": spearman_p_value(rho, n_points), "reason": None}

    # --- calendar cells + streak (Part 1 canonical function, full history) ---
    calendar_by_date = {d["date"]: d["timing"] for d in daily}
    calendar_cells = []
    cursor = window_start
    while cursor <= today:
        calendar_cells.append({"date": cursor.isoformat(), "status": calendar_by_date.get(cursor.isoformat(), "none")})
        cursor += timedelta(days=1)
    on_time_dates = _on_time_dates(completed)
    current_streak, longest_streak = _streaks_from_dates(on_time_dates, today=today)

    # --- hour-of-day (session start time, created_at) ---
    hours = [0] * 24
    has_timestamps = False
    for s in in_window:
        hour = _local_hour(s.get("created_at"))
        if hour is not None:
            has_timestamps = True
            hours[hour] += 1
    hour_of_day = (
        {
            "counts": hours,
            "timezone": "Asia/Colombo",
            "based_on": "session start time (created_at) - the app has no separate 'completed at' timestamp",
        }
        if has_timestamps
        else None
    )

    # --- recorded-ness ---
    recordedness = {
        "study_minutes_recorded_share": round(sum(1 for s in in_window if (s.get("study_duration_minutes") or 0) > 0) / n_sessions, 3) if n_sessions else 0.0,
        "engagement_recorded_share": round(sum(1 for s in in_window if s.get("engagement")) / n_sessions, 3) if n_sessions else 0.0,
        "subjects_recorded_share": round(sum(1 for s in in_window if s.get("subject_focus")) / n_sessions, 3) if n_sessions else 0.0,
    }

    return {
        "window_days": window_days,
        "daily_series": daily,
        "weekly_aggregates": weekly_aggregates,
        "weekday_distribution": weekday_distribution,
        "trends": {"study_minutes": trend_minutes, "xp": trend_xp},
        "anomalies": {
            "items": anomalies,
            "min_active_days_required": ANOMALY_MIN_ACTIVE_DAYS,
            "eligible": n_active_days >= ANOMALY_MIN_ACTIVE_DAYS,
            "method": "MAD robust z-score, |z| >= 3.5 flagged",
        },
        "minutes_histogram": minutes_histogram,
        "engagement_distribution": engagement_distribution,
        "subject_effort": subject_effort,
        "scatter": {"points": scatter_points, "correlation": correlation, "method": "Spearman rank correlation"},
        "calendar": {"cells": calendar_cells, "current_streak": current_streak, "longest_streak": longest_streak},
        "hour_of_day": hour_of_day,
        "recordedness": recordedness,
        "meta": {
            "n_sessions": n_sessions,
            "n_active_days": n_active_days,
            "window_days": window_days,
            "account_age_days": account_age_days,
            "effective_window_days": effective_window_days,
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "xp_note": "XP values include all rewards recorded for the journal (journal Q&A plus any campus mini-game run), not only the per-journal check-in amount.",
        },
    }
