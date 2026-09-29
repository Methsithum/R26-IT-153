"""
Read-only journal-feature snapshot, stored alongside each prediction but
NEVER fed to the model - kept for a future richer model trained on real
journal data. Reuses learning_patterns.py / context_utils.py's existing
functions exactly as they are (imported and called, never modified).

LearningPatternModel.find_by_user() is a plain read (no recompute/write), so
building this snapshot has no side effects. If anything here fails for any
reason, an empty dict is returned - this must never break a prediction.
"""

from datetime import timedelta

from app.models.journal.daily_session import DailySessionModel
from app.models.journal.learning_pattern import LearningPatternModel
from app.models.journal.task import TaskModel
from app.services.assessment_prediction.feature_builder import to_date
from app.services.journal.context_utils import compute_derived_context


async def build_journal_snapshot(user_id: str, subject: str, assessment_date: str) -> dict:
    try:
        return await _build(user_id, subject, assessment_date)
    except Exception:
        return {}


async def _build(user_id: str, subject: str, assessment_date: str) -> dict:
    target = to_date(assessment_date)
    if target is None:
        return {}

    sessions = await DailySessionModel.find_user_sessions(user_id)
    tasks = await TaskModel.find_by_user(user_id)

    window_14_start = target - timedelta(days=14)
    window_30_start = target - timedelta(days=30)

    def in_window(session, start):
        d = to_date(session.get("date"))
        return d is not None and start <= d < target

    sessions_14 = [s for s in sessions if in_window(s, window_14_start)]
    sessions_30 = [s for s in sessions if in_window(s, window_30_start)]

    def study_minutes(session_list, subject_only=False):
        total = 0
        for s in session_list:
            if subject_only and s.get("subject_focus") != subject:
                continue
            total += s.get("study_duration_minutes", 0) or 0
        return total

    def engagement_counts(session_list):
        counts = {"high": 0, "medium": 0, "low": 0}
        for s in session_list:
            e = (s.get("engagement") or "").lower()
            if e in counts:
                counts[e] += 1
        return counts

    derived_flags_14 = []
    for s in sessions_14:
        try:
            derived_flags_14.append(await compute_derived_context(s, tasks))
        except Exception:
            continue

    subject_task = next((t for t in tasks if t.get("subject") == subject), None)
    latest_pattern = await LearningPatternModel.find_by_user(user_id)

    return {
        "study_minutes_14d_overall": study_minutes(sessions_14),
        "study_minutes_14d_subject": study_minutes(sessions_14, subject_only=True),
        "study_minutes_30d_overall": study_minutes(sessions_30),
        "study_minutes_30d_subject": study_minutes(sessions_30, subject_only=True),
        "completed_sessions_14d": sum(1 for s in sessions_14 if s.get("completed")),
        "completed_sessions_30d": sum(1 for s in sessions_30 if s.get("completed")),
        "engagement_counts_14d": engagement_counts(sessions_14),
        "engagement_counts_30d": engagement_counts(sessions_30),
        "subject_assignment_progress_stage": subject_task.get("progress_stage") if subject_task else None,
        "deadline_pressure_count_14d": sum(1 for f in derived_flags_14 if f.get("deadline_pressure")),
        "low_study_count_14d": sum(1 for f in derived_flags_14 if f.get("low_study")),
        "overloaded_count_14d": sum(1 for f in derived_flags_14 if f.get("overloaded")),
        "latest_learning_patterns": latest_pattern or {},
    }
