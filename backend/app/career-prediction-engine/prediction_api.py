"""
Integrated Future & Career Prediction Engine — FastAPI backend.

How to run    : python -m uvicorn prediction_api:app --reload --port 8001
How to test   : python test_api.py
Swagger UI    : http://127.0.0.1:8001/docs
"""

from pathlib import Path

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# =============================================================================
# PATHS
# =============================================================================

BASE_DIR = Path(__file__).resolve().parent
SAVED_DIR = (BASE_DIR / '..' / '..' / 'trained-models'
             / 'career-prediction-engine' / 'saved_objects').resolve()

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

# =============================================================================
# APP SETUP
# =============================================================================

app = FastAPI(title="Career Prediction Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Populated at startup — loaded once, reused across requests.
_artifacts = {}


def _load_pkl(filename):
    path = SAVED_DIR / filename
    if not path.exists():
        raise RuntimeError(
            f"Required file not found: '{filename}' (expected at {path}). "
            "Run the training pipeline in ml_scripts/career-prediction-engine/ first."
        )
    return joblib.load(path)


@app.on_event("startup")
def load_artifacts():
    _artifacts['scaler'] = _load_pkl('scaler.pkl')
    _artifacts['feature_columns'] = _load_pkl('feature_columns.pkl')
    _artifacts['model_A_risk'] = _load_pkl('model_A_risk_xgboost.pkl')
    _artifacts['model_B_career'] = _load_pkl('model_B_career_ridge.pkl')
    _artifacts['model_metadata'] = _load_pkl('model_metadata.pkl')
    _artifacts['student_profiles'] = _load_pkl('student_profiles.pkl')


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
# ROUTE 1 — HEALTH CHECK
# =============================================================================

@app.get("/")
def root():
    return {"status": "running", "component": "Career Prediction Engine"}


# =============================================================================
# ROUTE 2 — PREDICT
# =============================================================================

@app.post("/predict")
def predict(student: StudentFeatures):
    if 'scaler' not in _artifacts:
        raise HTTPException(status_code=503, detail="Models are not loaded yet. Try again shortly.")

    input_dict = student.dict()

    scaler = _artifacts['scaler']
    model_a = _artifacts['model_A_risk']
    model_b = _artifacts['model_B_career']

    try:
        df_input = pd.DataFrame([input_dict])[FEATURE_COLUMNS]
        scaled = scaler.transform(df_input)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to scale input: {exc}")

    try:
        risk_pred = int(model_a.predict(scaled)[0])
        risk_proba = model_a.predict_proba(scaled)[0]
        career_score = float(model_b.predict(scaled)[0])
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


# =============================================================================
# ROUTE 3 — STUDENT PROFILES
# =============================================================================

@app.get("/profiles")
def get_profiles():
    if 'student_profiles' not in _artifacts:
        raise HTTPException(status_code=503, detail="Models are not loaded yet. Try again shortly.")

    df_profiles = _artifacts['student_profiles']
    return df_profiles.head(20).to_dict(orient="records")


# =============================================================================
# ROUTE 4 — MODEL METRICS
# =============================================================================

@app.get("/model-metrics")
def get_model_metrics():
    if 'model_metadata' not in _artifacts:
        raise HTTPException(status_code=503, detail="Models are not loaded yet. Try again shortly.")

    metadata = _artifacts['model_metadata']

    try:
        # Headline winners (kept flat for simple consumers).
        response = {
            "model_A_winner": metadata['model_A_winner'],
            "model_A_accuracy": round(metadata['model_A_xgb_accuracy'], 4),
            "model_A_f1": round(metadata['model_A_xgb_f1'], 4),
            "model_B_winner": metadata['model_B_winner'],
            "model_B_r2": round(metadata['model_B_ridge_r2'], 4),
            "model_B_mae": round(metadata['model_B_ridge_mae'], 4),
        }

        # Per-algorithm rows so the UI can render full comparison tables
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
