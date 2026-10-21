"""task_routes.py"""

from fastapi import APIRouter, Depends, HTTPException

from app.services.auth import require_journal_owner
from app.models.journal.task import TaskModel
from app.schemas.study_planner.task_update_schemas import (
    TaskCreateRequest,
    TaskDeadlineUpdate,
    TaskResponse,
    TaskWeightUpdate,
)
from app.services.time_utils import local_today_iso

router = APIRouter(prefix="/study-planner/tasks", tags=["study-planner"], dependencies=[Depends(require_journal_owner)])


async def _owned_task(task_id: str, owner: str) -> dict:
    """These routes only carry a task id, so ownership is checked against the task itself."""
    task = await TaskModel.find_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found.")
    if task.get("user_id") != owner:
        raise HTTPException(status_code=403, detail="You can only change your own tasks.")
    return task


@router.patch("/{task_id}/weight", response_model=TaskResponse)
async def update_task_weight(task_id: str, body: TaskWeightUpdate, owner: str = Depends(require_journal_owner)):
    await _owned_task(task_id, owner)
    await TaskModel.update(task_id, {"weight": body.weight})
    return await TaskModel.find_by_id(task_id)


@router.patch("/{task_id}/deadline", response_model=TaskResponse)
async def update_task_deadline(task_id: str, body: TaskDeadlineUpdate, owner: str = Depends(require_journal_owner)):
    await _owned_task(task_id, owner)
    await TaskModel.update(task_id, {"deadline": body.deadline})
    return await TaskModel.find_by_id(task_id)


@router.patch("/{task_id}/complete", response_model=TaskResponse)
async def complete_task(task_id: str, owner: str = Depends(require_journal_owner)):
    """Real database write for the "Complete" button (Tasks.jsx / TaskDetails.jsx)."""
    await _owned_task(task_id, owner)
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
