from fastapi import APIRouter, Depends, HTTPException

from app.services.auth import require_journal_owner
from app.schemas.study_planner.explain_schemas import ExplainResponse
from app.schemas.study_planner.task_schemas import TaskFeatures
from app.services.study_planner.explain_service import ExplainServiceError, explain_task
from app.utils.study_planner.error_handling import service_error_to_http

router = APIRouter(prefix="/study-planner", tags=["study-planner"], dependencies=[Depends(require_journal_owner)])


@router.post("/explain", response_model=ExplainResponse)
def explain_route(task_features: TaskFeatures):
    try:
        result = explain_task(task_features.model_dump())
    except ExplainServiceError as e:
        raise service_error_to_http(e)
    except Exception:
        raise HTTPException(status_code=500, detail="Explanation generation failed unexpectedly.")
    return result
