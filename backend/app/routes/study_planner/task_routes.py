"""
task_routes.py

Lets the Study Planner write real assignment weight/deadline back into the
journal's `tasks` collection (via app.models.journal.task.TaskModel), and
create brand-new real assignments from the "Add Academic Data" page.

Why this exists: /predict-priority is only as accurate as the feature row
it's given. The journal doesn't collect an assignment's weight, so the
frontend was sending a fixed placeholder (weight: 20) for every real task,
which the trained model weighs heavily - see PROJECT CONTEXT's honesty
principle: an approximation is fine to fall back to, but the student should
be able to supply the real number when they know it. These endpoints are
the write path for that, reusing TaskModel exactly as the journal's own
/daily routes do, so there's still only one place that touches the `tasks`
collection's shape.
"""

from fastapi import APIRouter, HTTPException

from app.models.journal.task import TaskModel
from app.schemas.study_planner.task_update_schemas import (
    TaskCreateRequest,
    TaskDeadlineUpdate,
    TaskResponse,
    TaskWeightUpdate,
)
from app.services.time_utils import local_today_iso

router = APIRouter(prefix="/study-planner/tasks", tags=["study-planner"])


@router.patch("/{task_id}/weight", response_model=TaskResponse)
async def update_task_weight(task_id: str, body: TaskWeightUpdate):
    existing = await TaskModel.find_by_id(task_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found.")
    await TaskModel.update(task_id, {"weight": body.weight})
    return await TaskModel.find_by_id(task_id)


@router.patch("/{task_id}/deadline", response_model=TaskResponse)
async def update_task_deadline(task_id: str, body: TaskDeadlineUpdate):
    existing = await TaskModel.find_by_id(task_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found.")
    await TaskModel.update(task_id, {"deadline": body.deadline})
    return await TaskModel.find_by_id(task_id)


@router.patch("/{task_id}/complete", response_model=TaskResponse)
async def complete_task(task_id: str):
    """
    Real database write for the "Complete" button (Tasks.jsx / TaskDetails.jsx).
    Previously this button only updated frontend Zustand state - the task's
    real `tasks` collection document was never touched, so the completion
    was invisible to anything else reading real data (syncFromJournal on the
    next login, the journal's own /daily flow, a teammate's dashboard) and
    would appear to silently "un-complete" itself on the next refresh.

    progress_stage="completed" reuses the EXACT value TaskModel.set_mark()
    already writes for a marked assignment (see journal_constants.py's
    ASSIGNMENT_PROGRESS_STAGES and MARK_RECEIVED_STAGES) - not a new field
    or a new status string - so this stays readable by every existing
    consumer of progress_stage without any of them needing to learn a second
    "completed" spelling. completed_at follows the same local-ISO-date-string
    convention already used for last_mark_check/last_deadline_check on this
    same collection (see TaskModel), rather than a raw datetime, so it's
    trivially JSON/Pydantic-serializable through TaskResponse.
    """
    existing = await TaskModel.find_by_id(task_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found.")
    await TaskModel.update(task_id, {"progress_stage": "completed", "completed_at": local_today_iso()})
    return await TaskModel.find_by_id(task_id)


@router.post("", response_model=TaskResponse)
async def create_task(body: TaskCreateRequest):
    created = await TaskModel.create({
        "user_id": body.user_id,
        "title": body.title,
        "subject": body.subject,
        "task_type": "assignment",
        "progress_stage": "in_progress",
        "deadline": body.deadline,
        "weight": body.weight,
        "mark": None,
        "last_mark_check": None,
        "last_deadline_check": None,
    })
    return TaskModel._serialize(created)
