from datetime import datetime
from typing import Final

from app.services.time_utils import local_today

ALLOWED_ACTIVITIES: Final[set[str]] = {
    "academic_study",
    "assignment_work",
    "exam_preparation",
    "lab_practical",
    "quiz_work",
    "project_development",
    "internship",
    "sports",
    "club_participation",
    "event_participation",
    "other",
}

ASSIGNMENT_PROGRESS_STAGES: Final[set[str]] = {
    "not_started",
    "in_progress",
    "report_completed",
    "viva_pending",
    "completed",
}

# Lane answers from asg-status → stored task progress.
# Submitted is report_completed so the work is no longer at-risk, but a mark can still be logged later.
ASSIGNMENT_STATUS_ANSWERS: Final[dict[str, str]] = {
    "not started": "not_started",
    "in progress": "in_progress",
    "still in progress": "in_progress",
    "yes in progress": "in_progress",
    "almost done": "in_progress",
    "submitted": "report_completed",
    "yes submitted": "report_completed",
}

INTERNSHIP_PROGRESS_STAGES: Final[set[str]] = {
    "not_applied",
    "application_pending",
    "interview_pending",
    "offered",
    "joined",
}

TASK_PROGRESS_STAGES: Final[set[str]] = ASSIGNMENT_PROGRESS_STAGES | INTERNSHIP_PROGRESS_STAGES

MARK_RECEIVED_STAGES: Final[set[str]] = {"completed", "report_completed", "viva_pending"}
EXAM_KINDS: Final[set[str]] = {"mid", "final", "lab", "quiz"}
MARK_CHECK_INTERVAL_DAYS: Final[int] = 7


def is_mark_check_due(last_check, today=None) -> bool:
    if not last_check:
        return True
    today = today or local_today()
    if isinstance(last_check, datetime):
        last = last_check.date()
    else:
        try:
            last = datetime.fromisoformat(str(last_check)[:10]).date()
        except Exception:
            return True
    return (today - last).days >= MARK_CHECK_INTERVAL_DAYS


def normalize_activity(activity: str) -> str:
    return activity.strip().lower().replace(" ", "_")


def filter_allowed_activities(activities: list[str]) -> list[str]:
    normalized = []
    for activity in activities:
        candidate = normalize_activity(activity)
        if candidate in ALLOWED_ACTIVITIES:
            normalized.append(candidate)
    return normalized


def is_valid_task_stage(stage: str | None) -> bool:
    return stage is None or stage in TASK_PROGRESS_STAGES