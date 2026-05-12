"""
Prediction routes for the Career Prediction Engine API.
All endpoints sit under the /api prefix.
"""

from fastapi import APIRouter, HTTPException

from app.config.ml_settings import FEATURE_DOMAINS
from app.schemas.student import (
    PredictionOutput,
    SimulationInput,
    SimulationOutput,
    StudentInput,
)
from app.services.prediction import predict_student

router = APIRouter(prefix="/api", tags=["Prediction"])


@router.post("/predict", response_model=PredictionOutput)
def predict(student: StudentInput) -> PredictionOutput:
    """Predict academic risk and career readiness for a single student."""
    try:
        result = predict_student(student.model_dump())
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return PredictionOutput(**result)


@router.post("/simulate", response_model=SimulationOutput)
def simulate(payload: SimulationInput) -> SimulationOutput:
    """Compare predictions for two student profiles (what-if scenario)."""
    try:
        orig = predict_student(payload.original.model_dump())
        mod  = predict_student(payload.modified.model_dump())
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return SimulationOutput(
        original_prediction=PredictionOutput(**orig),
        modified_prediction=PredictionOutput(**mod),
        career_change=round(mod["career_score"] - orig["career_score"], 2),
        risk_changed=orig["risk_level"] != mod["risk_level"],
    )


@router.get("/features")
def get_features() -> dict:
    """Return all feature names grouped by domain."""
    return {"domains": FEATURE_DOMAINS}
