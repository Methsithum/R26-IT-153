# Converts an activity snapshot into the numeric feature list the ML model uses.

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

FEATURE_LABELS = {
    "study_hours_avg_per_day": "Avg study hours / active day",
    "study_hours_last_14_days": "Total study hours (14d)",
    "total_sessions_last_14_days": "Journal sessions (14d)",
    "active_days_last_14_days": "Active days (14d)",
    "activity_frequency": "Activity frequency",
    "nearest_deadline_days": "Days to nearest deadline",
    "due_within_3_days": "Tasks due within 3 days",
    "due_within_7_days": "Tasks due within 7 days",
    "overdue": "Overdue tasks",
    "total_tasks": "Total tasks",
    "completed_tasks": "Completed tasks",
    "nearest_exam_days": "Days to nearest exam",
    "exams_within_3_days": "Exams within 3 days",
    "exams_within_7_days": "Exams within 7 days",
    "total_upcoming_exams": "Total upcoming exams",
    "engagement_high": "High-engagement days",
    "engagement_medium": "Medium-engagement days",
    "engagement_low": "Low-engagement days",
}


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
