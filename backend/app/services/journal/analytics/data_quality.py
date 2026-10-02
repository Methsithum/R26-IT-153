"""My Data Quality: flags gaps, outliers and near-duplicate entries in a
user's own journal history. Entirely descriptive/read-only - fixes nothing."""

from typing import Dict, List

from app.models.journal.daily_session import DailySessionModel
from app.services.journal.gamification import missed_journal_dates
from app.services.time_utils import local_today, to_local_date

from .stats import mad_zscores, tfidf_cosine_similarity

DUPLICATE_SIMILARITY_THRESHOLD = 0.85


def _completed(sessions: List[Dict]) -> List[Dict]:
    return sorted(
        (s for s in (sessions or []) if s and s.get("completed") and to_local_date(s.get("date"))),
        key=lambda s: to_local_date(s.get("date")),
    )


async def build_data_quality_report(user_id: str) -> Dict:
    sessions = await DailySessionModel.find_user_sessions(user_id)
    completed = _completed(sessions)
    today = local_today()

    missed = missed_journal_dates(sessions, today)
    first_date = to_local_date(completed[0]["date"]) if completed else None
    span_days = (today - first_date).days + 1 if first_date else 0
    completeness_ratio = round(len(completed) / span_days, 3) if span_days else 0.0

    durations = [float(s.get("study_duration_minutes") or 0) for s in completed]
    zscores = mad_zscores(durations)
    duration_outliers = [
        {
            "date": to_local_date(s["date"]).isoformat(),
            "minutes": s.get("study_duration_minutes") or 0,
            "robust_zscore": z,
        }
        for s, z in zip(completed, zscores)
        if abs(z) >= 3.5
    ]

    narratives = [(s, s.get("journal_entry") or "") for s in completed if s.get("journal_entry")]
    corpus = [text for _, text in narratives]
    near_duplicates = []
    for i in range(len(narratives)):
        for j in range(i + 1, len(narratives)):
            sim = tfidf_cosine_similarity(narratives[i][1], narratives[j][1], corpus)
            if sim >= DUPLICATE_SIMILARITY_THRESHOLD:
                near_duplicates.append(
                    {
                        "date_a": to_local_date(narratives[i][0]["date"]).isoformat(),
                        "date_b": to_local_date(narratives[j][0]["date"]).isoformat(),
                        "similarity": sim,
                    }
                )

    short_qa_sessions = [
        {
            "date": to_local_date(s["date"]).isoformat(),
            "questions_answered": len(s.get("qa_history") or []),
            "max_questions": s.get("max_questions"),
        }
        for s in completed
        if s.get("max_questions") and len(s.get("qa_history") or []) < s.get("max_questions")
    ]

    return {
        "completeness": {
            "completed_journals": len(completed),
            "calendar_days_since_first_journal": span_days,
            "missed_days": len(missed),
            "missed_dates": [d.isoformat() for d in missed],
            "completeness_ratio": completeness_ratio,
        },
        "study_duration_outliers": duration_outliers,
        "near_duplicate_entries": near_duplicates,
        "incomplete_question_sessions": short_qa_sessions,
    }
