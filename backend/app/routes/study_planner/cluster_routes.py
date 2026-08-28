from fastapi import APIRouter, HTTPException

from app.schemas.study_planner.cluster_schemas import BehaviorFeatures, ClusterResponse
from app.services.study_planner.cluster_service import ClusterServiceError, predict_cluster
from app.utils.study_planner.error_handling import service_error_to_http

router = APIRouter(prefix="/study-planner", tags=["study-planner"])


@router.post("/predict-cluster", response_model=ClusterResponse)
def predict_cluster_route(behavior_features: BehaviorFeatures):
    try:
        result = predict_cluster(behavior_features.model_dump())
    except ClusterServiceError as e:
        raise service_error_to_http(e)
    except Exception:
        raise HTTPException(status_code=500, detail="Cluster prediction failed unexpectedly.")
    return result
