"""
schedule_service.py

Wraps ml_scripts/study-planner/schedule_engine.py's StudyScheduler for the
study-planner API. The scheduling LOGIC (greedy allocation, reschedule)
stays entirely in that one script - this file only adds the HTTP-facing
concerns: resolving missing priority labels via the trained classifier, and
making the inherently-stateful StudyScheduler usable across stateless
requests (see reschedule() docstring for that design decision).
"""

import logging
import os
import sys

logger = logging.getLogger(__name__)

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
# ml_scripts/study-planner is not a Python package (its dir name has a hyphen,
# and it's a scripts folder, not an importable package tree) - we add it to
# sys.path and import the module by its bare filename instead, same pattern
# the ml_scripts themselves use for cross-script reuse.
ML_SCRIPTS_DIR = os.path.join(BACKEND_DIR, "ml_scripts", "study-planner")
if ML_SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, ML_SCRIPTS_DIR)

StudyScheduler = None
try:
    from schedule_engine import StudyScheduler  # noqa: E402
    logger.info("schedule_service: imported StudyScheduler from ml_scripts/study-planner/schedule_engine.py")
except FileNotFoundError as e:
    logger.error("schedule_service: STARTUP ERROR - could not find schedule_engine.py: %s", e)
except Exception:
    logger.exception("schedule_service: STARTUP ERROR - failed to import StudyScheduler.")

from app.services.study_planner.priority_service import predict_priority, PriorityServiceError


class ScheduleServiceError(Exception):
    """Raised for validation failures or when the scheduling engine failed to load at startup."""


def _ensure_priority_label(task: dict) -> dict:
    """
    Returns a copy of `task` with priority_label filled in.
    If the caller already supplied priority_label, it's used as-is (trusting
    the caller, e.g. a value already predicted client-side or overridden by
    a human). Otherwise task must include a "feature_row" (the 13 model
    features) so we can call predict_priority() ourselves; feature_row is
    stripped from the returned dict since StudyScheduler.add_task() doesn't
    expect it.
    """
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
    task.pop("feature_row", None)
    return task


def create_schedule(weekly_free_slots: list, tasks: list) -> dict:
    """
    Builds a fresh StudyScheduler, adds every task (predicting priority via
    the trained classifier for any task that doesn't already carry one), and
    returns generate_schedule()'s result dict unchanged
    (schedule + overload_warning + tasks registry).
    """
    if StudyScheduler is None:
        raise ScheduleServiceError("Scheduling engine is not available - check server startup logs.")

    scheduler = StudyScheduler(weekly_free_slots)
    for task in tasks:
        resolved_task = _ensure_priority_label(task)
        try:
            scheduler.add_task(resolved_task)
        except ValueError as e:
            raise ScheduleServiceError(str(e))

    return scheduler.generate_schedule()


def reschedule(existing_schedule_state: dict, completed_task_ids: list, new_tasks: list = None) -> dict:
    """
    DESIGN NOTE (statelessness across HTTP requests):
    StudyScheduler is an in-memory Python object - it cannot survive between
    one HTTP request and the next, so we can't just keep calling .reschedule()
    on "the same" scheduler instance the way the ml_scripts demo does. Instead
    we RECONSTRUCT an equivalent scheduler from what the client sends back:

      - existing_schedule_state["tasks"]: the task registry from the previous
        /schedule or /reschedule response. generate_schedule() now includes
        "weight" in that registry (see schedule_engine.py) specifically so
        every entry has everything add_task() requires, letting us round-trip
        each task straight back into a fresh StudyScheduler.
      - existing_schedule_state["remaining_free_slots"]: StudyScheduler trims
        its own weekly_free_slots down to leftover capacity after each
        generate_schedule() call, but that trimmed list is never included in
        the response payload (generate_schedule() only returns schedule /
        overload_warning / tasks). So the caller must track and pass back
        whatever free-slot capacity is still unallocated - typically by
        storing schedule_service's own response between calls (a thin
        session/cache layer, or the frontend simply echoing back what we send
        it) rather than recomputing free time itself.

    Once reconstructed, we add every previously-known task (StudyScheduler's
    own reschedule() then filters out completed_task_ids), resolve priority
    for any brand-new tasks, and call the real StudyScheduler.reschedule() -
    so the actual reschedule LOGIC still lives in exactly one place.
    """
    if StudyScheduler is None:
        raise ScheduleServiceError("Scheduling engine is not available - check server startup logs.")

    remaining_free_slots = existing_schedule_state.get("remaining_free_slots")
    if not remaining_free_slots:
        raise ScheduleServiceError(
            "existing_schedule_state.remaining_free_slots is required to reschedule statelessly - "
            "pass back the free-slot capacity that is still unallocated from the previous response."
        )

    previous_tasks = existing_schedule_state.get("tasks") or {}
    scheduler = StudyScheduler(remaining_free_slots)
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
