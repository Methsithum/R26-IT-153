"""
Career Prediction Engine routes.

Wraps the trained Model A (academic risk, XGBoost) and Model B (career
readiness, Ridge) behind the shared Smart Uni Guide API. All endpoints sit
under the /career prefix.

Models are loaded once on first use and cached for the process lifetime.
"""

from pathlib import Path

import joblib
import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/career", tags=["Career Prediction Engine"])


# =============================================================================
# PATHS & CONSTANTS
# =============================================================================

# app/routes/career_prediction/predict.py -> backend/
BACKEND_DIR = Path(__file__).resolve().parents[3]
SAVED_DIR = (BACKEND_DIR / 'trained-models'
             / 'career-prediction-engine' / 'saved_objects')

FEATURE_COLUMNS = [
    'gpa_cumulative', 'gpa_trend', 'assignment_completion_rate',
    'late_submission_rate', 'resit_count', 'project_performance',
    'attendance_rate', 'weekly_study_hours', 'sleep_hours_avg',
    'sleep_consistency', 'part_time_work_hours',
    'stress_level', 'anxiety_score', 'mood_stability',
    'career_clarity_score',
]

RISK_LABEL_MAP = {0: 'Low', 1: 'Medium', 2: 'High'}
RISK_COLOR_MAP = {'Low': 'green', 'Medium': 'orange', 'High': 'red'}

# Cache for the loaded models/objects.
_artifacts = {}


def _load_pkl(filename):
    """Load one pickle from saved_objects/, with a clear error if it is absent."""
    path = SAVED_DIR / filename
    if not path.exists():
        raise HTTPException(
            status_code=503,
            detail=(
                f"Required model file not found: '{filename}' (expected at {path}). "
                "Run the training pipeline in ml_scripts/career-prediction-engine/ first."
            ),
        )
    return joblib.load(path)


def get_artifacts():
    """Return the cached artifacts, loading them on first call."""
    if not _artifacts:
        _artifacts['scaler'] = _load_pkl('scaler.pkl')
        _artifacts['feature_columns'] = _load_pkl('feature_columns.pkl')
        _artifacts['model_A_risk'] = _load_pkl('model_A_risk_xgboost.pkl')
        _artifacts['model_B_career'] = _load_pkl('model_B_career_ridge.pkl')
        _artifacts['model_metadata'] = _load_pkl('model_metadata.pkl')
        _artifacts['student_profiles'] = _load_pkl('student_profiles.pkl')
    return _artifacts


# =============================================================================
# SCHEMAS
# =============================================================================

class StudentFeatures(BaseModel):
    gpa_cumulative: float
    gpa_trend: float
    assignment_completion_rate: float
    late_submission_rate: float
    resit_count: float
    project_performance: float
    attendance_rate: float
    weekly_study_hours: float
    sleep_hours_avg: float
    sleep_consistency: float
    part_time_work_hours: float
    stress_level: float
    anxiety_score: float
    mood_stability: float
    career_clarity_score: float


# =============================================================================
# ROUTES
# =============================================================================

@router.get("/")
def root():
    """Liveness probe for this component."""
    return {"status": "running", "component": "Career Prediction Engine"}


@router.post("/predict")
def predict(student: StudentFeatures):
    """Predict academic risk class and career readiness score for one student."""
    art = get_artifacts()

    try:
        df_input = pd.DataFrame([student.dict()])[FEATURE_COLUMNS]
        scaled = art['scaler'].transform(df_input)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to scale input: {exc}")

    try:
        risk_pred = int(art['model_A_risk'].predict(scaled)[0])
        risk_proba = art['model_A_risk'].predict_proba(scaled)[0]
        career_score = float(art['model_B_career'].predict(scaled)[0])
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}")

    risk_label = RISK_LABEL_MAP[risk_pred]

    return {
        "academic_risk": risk_label,
        "prob_low": round(float(risk_proba[0]) * 100, 1),
        "prob_medium": round(float(risk_proba[1]) * 100, 1),
        "prob_high": round(float(risk_proba[2]) * 100, 1),
        "career_score": round(career_score, 1),
        "risk_label_color": RISK_COLOR_MAP[risk_label],
    }


@router.get("/profiles")
def get_profiles():
    """Return the first 20 student profiles from the holdout set."""
    art = get_artifacts()
    return art['student_profiles'].head(20).to_dict(orient="records")


@router.get("/model-metrics")
def get_model_metrics():
    """Return winning model names plus per-algorithm evaluation results."""
    metadata = get_artifacts()['model_metadata']

    try:
        response = {
            "model_A_winner": metadata['model_A_winner'],
            "model_A_accuracy": round(metadata['model_A_xgb_accuracy'], 4),
            "model_A_f1": round(metadata['model_A_xgb_f1'], 4),
            "model_B_winner": metadata['model_B_winner'],
            "model_B_r2": round(metadata['model_B_ridge_r2'], 4),
            "model_B_mae": round(metadata['model_B_ridge_mae'], 4),
        }

        # Per-algorithm rows so the UI renders full comparison tables
        # without hard-coding any numbers.
        response["model_A_rows"] = [
            {
                "algorithm": name,
                "accuracy": round(metadata[f'model_A_{p}_accuracy'], 4),
                "f1": round(metadata[f'model_A_{p}_f1'], 4),
                "cv_score": round(metadata[f'model_A_{p}_cv_accuracy'], 4),
                "winner": name == metadata['model_A_winner'],
            }
            for p, name in (('lr', 'Logistic Regression'),
                            ('rf', 'Random Forest'),
                            ('xgb', 'XGBoost'))
        ]

        response["model_B_rows"] = [
            {
                "algorithm": name,
                "mae": round(metadata[f'model_B_{p}_mae'], 4),
                "rmse": round(metadata[f'model_B_{p}_rmse'], 4),
                "r2": round(metadata[f'model_B_{p}_r2'], 4),
                "winner": name == metadata['model_B_winner'],
            }
            for p, name in (('ridge', 'Ridge Regression'),
                            ('rf', 'Random Forest'),
                            ('xgb', 'XGBoost'))
        ]

        return response
    except KeyError as exc:
        raise HTTPException(status_code=500, detail=f"Missing key in model_metadata.pkl: {exc}")
