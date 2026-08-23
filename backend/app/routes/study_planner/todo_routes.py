from typing import List

from fastapi import APIRouter, HTTPException

from app.schemas.study_planner.schedule_schemas import ScheduleResponse
from app.schemas.study_planner.todo_schemas import TodoItem
from app.services.study_planner.todo_service import TodoServiceError, get_todo_list
from app.utils.study_planner.error_handling import service_error_to_http

router = APIRouter(prefix="/study-planner", tags=["study-planner"])


@router.post("/todo", response_model=List[TodoItem])
def todo_route(schedule: ScheduleResponse):
    try:
        result = get_todo_list(schedule.model_dump())
    except TodoServiceError as e:
        raise service_error_to_http(e)
    except Exception:
        raise HTTPException(status_code=500, detail="To-do list generation failed unexpectedly.")
    return result
