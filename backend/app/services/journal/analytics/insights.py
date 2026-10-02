"""My Study Insights: read-only trend analysis over a user's own completed
journal sessions. Pure stdlib stats only (see stats.py) - no ML models."""

from typing import Dict, List

from app.models.journal.daily_session import DailySessionModel
from app.services.time_utils import to_local_date

from .stats import linear_trend_points, safe_mean, shannon_entropy, spearman_corr


def _completed(sessions: List[Dict]) -> List[Dict]:
    return sorted(
        (s for s in (sessions or []) if s and s.get("completed") and to_local_date(s.get("date"))),
        key=lambda s: to_local_date(s.get("date")),
    )


async def build_study_insights(user_id: str) -> Dict:
    sessions = await DailySessionModel.find_user_sessions(user_id)
    completed = _completed(sessions)

    dated_duration = [
        (to_local_date(s["date"]).isoformat(), float(s.get("study_duration_minutes") or 0)) for s in completed
    ]
    dated_xp = [(to_local_date(s["date"]).isoformat(), float(s.get("xp_earned") or 0)) for s in completed]

    engagement_counts: Dict[str, int] = {}
    subject_counts: Dict[str, int] = {}
    catchup_count = 0
    for s in completed:
        eng = (s.get("engagement") or "unspecified").lower()
        engagement_counts[eng] = engagement_counts.get(eng, 0) + 1
        subj = s.get("subject_focus") or "unspecified"
        subject_counts[subj] = subject_counts.get(subj, 0) + 1
        if s.get("is_catchup"):
            catchup_count += 1

    durations = [d for _, d in dated_duration]
    xps = [x for _, x in dated_xp]

    duration_xp_corr = spearman_corr(durations, xps) if len(durations) >= 2 else 0.0

    return {
        "total_completed_journals": len(completed),
        "on_time_journals": len(completed) - catchup_count,
        "catchup_journals": catchup_count,
        "study_duration": {
            "series": [{"date": d, "minutes": v} for d, v in dated_duration],
            "average_minutes": safe_mean(durations),
            **linear_trend_points(dated_duration),
        },
        "xp_earned": {
            "series": [{"date": d, "xp": v} for d, v in dated_xp],
            "average_xp": safe_mean(xps),
            **linear_trend_points(dated_xp),
        },
        "duration_vs_xp_correlation": duration_xp_corr,
        "engagement_distribution": engagement_counts,
        "engagement_entropy_bits": shannon_entropy(list(engagement_counts.values())),
        "subject_distribution": subject_counts,
        "subject_focus_entropy_bits": shannon_entropy(list(subject_counts.values())),
    }
