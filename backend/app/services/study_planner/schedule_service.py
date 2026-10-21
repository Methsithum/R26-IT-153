"""schedule_service.py"""

import logging
import os
import sys

logger = logging.getLogger(__name__)

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
# ml_scripts/study-planner is not a Python package
ML_SCRIPTS_DIR = os.path.join(BACKEND_DIR, "ml_scripts", "study-planner")
if ML_SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, ML_SCRIPTS_DIR)

StudyScheduler = None
generate_rolling_schedule = None
try:
    from schedule_engine import StudyScheduler, generate_rolling_schedule  # noqa: E402
    logger.info("schedule_service: imported StudyScheduler + generate_rolling_schedule from ml_scripts/study-planner/schedule_engine.py")
except FileNotFoundError as e:
    logger.error("schedule_service: STARTUP ERROR - could not find schedule_engine.py: %s", e)
except Exception:
    logger.exception("schedule_service: STARTUP ERROR - failed to import StudyScheduler.")

from app.services.study_planner.priority_service import predict_priority, PriorityServiceError
from app.services.time_utils import local_today, to_local_date

# Urgent floor - same rule as computeFinalPriority() in frontend/src/utils/priorityEngine.js
URGENT_FLOOR_DAYS = {"assignment": 2, "exam": 7}


class ScheduleServiceError(Exception):
    """Raised for validation failures or when the scheduling engine failed to load at startup."""


def _ensure_priority_label(task: dict) -> dict:
    """Returns a copy of `task` with priority_label filled in."""
    task = dict(task)
    if not task.get("priority_label"):
        features = task.get("feature_row")
        if not features:
            raise ScheduleServiceError(
                f"Task {task.get('task_id', '?')} has no priority_label and no feature_row to "
                f"predict one from - provide either a priority_label or the 13 model features "
                f"under 'feature_row'."
            )
        try:
            prediction = predict_priority(features)
        except PriorityServiceError as e:
            raise ScheduleServiceError(str(e))
        task["priority_label"] = prediction["priority_label"]
        if _within_urgent_floor(task):
            task["priority_label"] = "High"
    task.pop("feature_row", None)
    return task


def _within_urgent_floor(task: dict) -> bool:
    deadline = to_local_date(task.get("deadline_date"))
    if deadline is None:
        return False
    days_remaining = (deadline - local_today()).days
    return days_remaining <= URGENT_FLOOR_DAYS.get(task.get("task_type") or "assignment", 2)


def create_schedule(weekly_free_slots: list, tasks: list, blocked_slots: list = None) -> dict:
    """Builds a fresh StudyScheduler, adds every task"""
    if StudyScheduler is None:
        raise ScheduleServiceError("Scheduling engine is not available - check server startup logs.")

    scheduler = StudyScheduler(weekly_free_slots, blocked_slots=blocked_slots)
    for task in tasks:
        resolved_task = _ensure_priority_label(task)
        try:
            scheduler.add_task(resolved_task)
        except ValueError as e:
            raise ScheduleServiceError(str(e))

    return scheduler.generate_schedule()


def create_multi_week_schedule(weekly_free_slots: list, tasks: list, weeks_ahead: int = None, blocked_slots: list = None) -> dict:
    """Same priority-resolution step as create_schedule()"""
    if generate_rolling_schedule is None:
        raise ScheduleServiceError("Scheduling engine is not available - check server startup logs.")

    resolved_tasks = []
    for task in tasks:
        try:
            resolved_tasks.append(_ensure_priority_label(task))
        except ScheduleServiceError:
            raise

    return generate_rolling_schedule(weekly_free_slots, resolved_tasks, weeks_ahead=weeks_ahead, blocked_slots=blocked_slots)


def reschedule(existing_schedule_state: dict, completed_task_ids: list, new_tasks: list = None, blocked_slots: list = None) -> dict:
    """DESIGN NOTE (statelessness across HTTP requests)"""
    if StudyScheduler is None:
        raise ScheduleServiceError("Scheduling engine is not available - check server startup logs.")

    remaining_free_slots = existing_schedule_state.get("remaining_free_slots")
    if not remaining_free_slots:
        raise ScheduleServiceError(
            "existing_schedule_state.remaining_free_slots is required to reschedule statelessly - "
            "pass back the free-slot capacity that is still unallocated from the previous response."
        )

    previous_tasks = existing_schedule_state.get("tasks") or {}
    scheduler = StudyScheduler(remaining_free_slots, blocked_slots=blocked_slots)
    for task_id, info in previous_tasks.items():
        try:
            scheduler.add_task({"task_id": task_id, **info})
        except ValueError as e:
            raise ScheduleServiceError(f"Could not reconstruct task {task_id}: {e}")

    resolved_new_tasks = [_ensure_priority_label(task) for task in (new_tasks or [])]

    return scheduler.reschedule(
        completed_task_ids=completed_task_ids or [],
        new_tasks=resolved_new_tasks,
    )
