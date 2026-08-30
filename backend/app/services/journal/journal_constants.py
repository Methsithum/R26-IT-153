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

# Final exam results are letter grades, not percentages.
LETTER_GRADES: Final[tuple[str, ...]] = (
    "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D",
)
FAIL_LETTER_GRADES: Final[set[str]] = {"C-", "D+", "D", "D-"}
LETTER_GRADE_POINTS: Final[dict[str, float]] = {
    "A+": 4.0,
    "A": 4.0,
    "A-": 3.7,
    "B+": 3.3,
    "B": 3.0,
    "B-": 2.7,
    "C+": 2.3,
    "C": 2.0,
    "C-": 1.7,
    "D+": 1.3,
    "D": 1.0,
    "D-": 0.7,
}


def parse_letter_grade(value) -> str | None:
    text = str(value or "").strip().upper().replace(" ", "")
    return text if text in LETTER_GRADE_POINTS else None


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