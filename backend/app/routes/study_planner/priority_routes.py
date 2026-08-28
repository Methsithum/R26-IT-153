from fastapi import APIRouter, HTTPException

from app.schemas.study_planner.priority_schemas import PriorityResponse
from app.schemas.study_planner.task_schemas import TaskFeatures
from app.services.study_planner.priority_service import PriorityServiceError, predict_priority
from app.utils.study_planner.error_handling import service_error_to_http

router = APIRouter(prefix="/study-planner", tags=["study-planner"])


@router.post("/predict-priority", response_model=PriorityResponse)
def predict_priority_route(task_features: TaskFeatures):
    try:
        result = predict_priority(task_features.model_dump())
    except PriorityServiceError as e:
        raise service_error_to_http(e)
    except Exception:
        raise HTTPException(status_code=500, detail="Priority prediction failed unexpectedly.")
    return result
