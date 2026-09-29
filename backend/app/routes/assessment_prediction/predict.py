"""
Assessment Score Prediction routes.

Serves ONLY assessment_score_journal_compatible.joblib (the research-only
full_oulad bundle is never loaded here). All endpoints sit under the
/assessment-prediction prefix, following the same lazy-load-once pattern as
app/routes/career_prediction/predict.py.

No authentication - this matches every other journal route in this project
(see README.md Limitations: journal routes, including this one, are
unauthenticated project-wide).
"""

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config.assessment_prediction_settings import HISTORY_LIMIT_DEFAULT, HISTORY_LIMIT_MAX
from app.models.assessment_prediction.prediction import AssessmentPredictionModel
from app.services.assessment_prediction import predict_service
from app.services.assessment_prediction.journal_snapshot import build_journal_snapshot
from app.services.assessment_prediction.model_loader import BundleNotFoundError, get_bundle

router = APIRouter(prefix="/assessment-prediction", tags=["Assessment Score Prediction"])


# =============================================================================
# SCHEMAS
# =============================================================================

class PredictRequest(BaseModel):
    user_id: str
    subject: str
    assessment_kind: str  # "exam" | "task"
    exam_type: str | None = None  # required when assessment_kind == "exam": mid | final | lab | quiz
    task_id: str | None = None  # optional when assessment_kind == "task"
    assessment_date: str | None = None  # ISO date; falls back to stored date/deadline, then today


# =============================================================================
# ROUTES
# =============================================================================

@router.post("/predict")
async def predict(payload: PredictRequest):
    """Predict a score for one upcoming assessment, store the prediction, return the result."""
    try:
        result = await predict_service.build_prediction(
            user_id=payload.user_id,
            subject=payload.subject,
            assessment_kind=payload.assessment_kind,
            exam_type=payload.exam_type,
            task_id=payload.task_id,
            assessment_date=payload.assessment_date,
        )
    except predict_service.ValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except predict_service.NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except BundleNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    # journalSnapshot is store-only (never fed to the model) and must never
    # break a prediction - build_journal_snapshot already swallows its own
    # errors and returns {} on any failure.
    journal_snapshot = await build_journal_snapshot(payload.user_id, payload.subject, result["target_date"])

    stored = await AssessmentPredictionModel.upsert(
        user_id=payload.user_id,
        subject=payload.subject,
        assessment_kind=payload.assessment_kind,
        assessment_ref=result["assessment_ref"],
        assessment_date=result["target_date"],
        features=result["features"],
        estimated=result["estimated_mark"],
        low=result["range_low"],
        high=result["range_high"],
        below_pass_mark=result["below_pass_mark"],
        model_version=result["model_version"],
        journal_snapshot=journal_snapshot,
    )

    return {
        "estimated_mark": result["estimated_mark"],
        "range_low": result["range_low"],
        "range_high": result["range_high"],
        "below_pass_mark": result["below_pass_mark"],
        "n_previous_marks": result["n_previous_marks"],
        "warning": result["warning"],
        "model_version": result["model_version"],
        "feature_set": result["feature_set"],
        "assessment_type_used": result["assessment_type_used"],
        "prediction_id": stored["id"],
    }


@router.get("/history/{user_id}")
async def history(user_id: str, limit: int = HISTORY_LIMIT_DEFAULT):
    """A student's stored predictions, newest first, including actualMark once known."""
    try:
        ObjectId(user_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=422, detail=f"'user_id' is not a valid id: {user_id!r}")

    limit = max(1, min(limit, HISTORY_LIMIT_MAX))
    predictions = await AssessmentPredictionModel.find_by_user(user_id, limit=limit)
    return {"user_id": user_id, "predictions": predictions}


@router.get("/health")
def health():
    """Whether the bundle is loaded, feature_set, model_version. No secrets, never 503 (status-check, not the predict path)."""
    try:
        bundle = get_bundle()
    except BundleNotFoundError as exc:
        return {"bundle_loaded": False, "detail": str(exc)}
    return {
        "bundle_loaded": True,
        "feature_set": bundle["feature_set"],
        "model_version": f"{bundle['feature_set']}@{bundle['trained_at']}",
    }
