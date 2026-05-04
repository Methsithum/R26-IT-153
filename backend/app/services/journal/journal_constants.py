from typing import Final

ALLOWED_ACTIVITIES: Final[set[str]] = {
    "academic_study",
    "assignment_work",
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

INTERNSHIP_PROGRESS_STAGES: Final[set[str]] = {
    "not_applied",
    "application_pending",
    "interview_pending",
    "offered",
    "joined",
}

TASK_PROGRESS_STAGES: Final[set[str]] = ASSIGNMENT_PROGRESS_STAGES | INTERNSHIP_PROGRESS_STAGES


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