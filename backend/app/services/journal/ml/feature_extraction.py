"""Turns an activity snapshot (see behavior_analysis.build_activity_snapshot)
into a fixed-order numeric feature vector for the classifier. Shared by the
training script and the live predictor so both read the same snapshot the
same way.
"""

from typing import Any, Dict, List

FEATURE_NAMES = [
    "study_hours_avg_per_day",
    "study_hours_last_14_days",
    "total_sessions_last_14_days",
    "active_days_last_14_days",
    "activity_frequency",
    "nearest_deadline_days",
    "due_within_3_days",
    "due_within_7_days",
    "overdue",
    "total_tasks",
    "completed_tasks",
    "nearest_exam_days",
    "exams_within_3_days",
    "exams_within_7_days",
    "total_upcoming_exams",
    "engagement_high",
    "engagement_medium",
    "engagement_low",
]

# Missing "nearest X days" means nothing is upcoming - treat that as "far away"
# rather than 0, which would read as "due today".
NO_DEADLINE_FALLBACK = 999


def extract_features(snapshot: Dict[str, Any]) -> List[float]:
    deadline = snapshot.get("deadline_proximity", {}) or {}
    tasks = snapshot.get("task_completion_history", {}) or {}
    exam = snapshot.get("exam_proximity", {}) or {}
    engagement = snapshot.get("engagement_distribution", {}) or {}

    return [
        float(snapshot.get("study_hours_avg_per_day") or 0),
        float(snapshot.get("study_hours_last_14_days") or 0),
        float(snapshot.get("total_sessions_last_14_days") or 0),
        float(snapshot.get("active_days_last_14_days") or 0),
        float(snapshot.get("activity_frequency") or 0),
        float(deadline.get("nearest_deadline_days") if deadline.get("nearest_deadline_days") is not None else NO_DEADLINE_FALLBACK),
        float(deadline.get("due_within_3_days") or 0),
        float(deadline.get("due_within_7_days") or 0),
        float(deadline.get("overdue") or 0),
        float(tasks.get("total_tasks") or 0),
        float(tasks.get("completed_tasks") or 0),
        float(exam.get("nearest_exam_days") if exam.get("nearest_exam_days") is not None else NO_DEADLINE_FALLBACK),
        float(exam.get("exams_within_3_days") or 0),
        float(exam.get("exams_within_7_days") or 0),
        float(exam.get("total_upcoming_exams") or 0),
        float(engagement.get("high") or 0),
        float(engagement.get("medium") or 0),
        float(engagement.get("low") or 0),
    ]
