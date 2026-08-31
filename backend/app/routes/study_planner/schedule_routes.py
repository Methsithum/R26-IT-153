from fastapi import APIRouter, HTTPException

from app.schemas.study_planner.schedule_schemas import (
    MultiWeekScheduleRequest,
    MultiWeekScheduleResponse,
    RescheduleRequest,
    ScheduleRequest,
    ScheduleResponse,
)
from app.services.study_planner.schedule_service import (
    ScheduleServiceError,
    create_multi_week_schedule,
    create_schedule,
    reschedule,
)
from app.utils.study_planner.error_handling import service_error_to_http

router = APIRouter(prefix="/study-planner", tags=["study-planner"])


@router.post("/schedule", response_model=ScheduleResponse)
def schedule_route(request: ScheduleRequest):
    try:
        result = create_schedule(
            weekly_free_slots=[slot.model_dump() for slot in request.weekly_free_slots],
            tasks=[task.model_dump() for task in request.tasks],
        )
    except ScheduleServiceError as e:
        raise service_error_to_http(e)
    except Exception:
        raise HTTPException(status_code=500, detail="Schedule generation failed unexpectedly.")
    return result


@router.post("/multi-week-schedule", response_model=MultiWeekScheduleResponse)
def multi_week_schedule_route(request: MultiWeekScheduleRequest):
    try:
        result = create_multi_week_schedule(
            weekly_free_slots=[slot.model_dump() for slot in request.weekly_free_slots],
            tasks=[task.model_dump() for task in request.tasks],
            weeks_ahead=request.weeks_ahead,
        )
    except ScheduleServiceError as e:
        raise service_error_to_http(e)
    except Exception:
        raise HTTPException(status_code=500, detail="Multi-week schedule generation failed unexpectedly.")
    return result


@router.post("/reschedule", response_model=ScheduleResponse)
def reschedule_route(request: RescheduleRequest):
    existing_schedule_state = {
        "tasks": {
            task_id: entry.model_dump() for task_id, entry in request.previous_schedule.tasks.items()
        },
        "remaining_free_slots": [slot.model_dump() for slot in request.remaining_free_slots],
    }
    try:
        result = reschedule(
            existing_schedule_state=existing_schedule_state,
            completed_task_ids=request.completed_task_ids,
            new_tasks=[task.model_dump() for task in (request.new_tasks or [])],
        )
    except ScheduleServiceError as e:
        raise service_error_to_http(e)
    except Exception:
        raise HTTPException(status_code=500, detail="Reschedule failed unexpectedly.")
    return result
