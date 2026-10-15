"""
=====================================================================
 Academic Study Planner — FastAPI Prediction Service
 File: app/routes/study-planner/priority_routes.py
=====================================================================
Endpoint: POST /api/study-planner/predict-priority
=====================================================================
"""

import os
import pickle
import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, validator
from typing import Literal, List, Optional

# ── Router ─────────────────────────────────────────────────────────
router = APIRouter(
    prefix="/api/study-planner",
    tags=["Study Planner"]
)

# ── Paths ──────────────────────────────────────────────────────────
BASE_DIR  = os.path.dirname(os.path.dirname(os.path.dirname(
            os.path.dirname(os.path.abspath(__file__)))))
MODEL_DIR = os.path.join(BASE_DIR, "trained-models", "study-planner")

# ── Load model artifacts at startup ───────────────────────────────
def _load(filename):
    path = os.path.join(MODEL_DIR, filename)
    if not os.path.exists(path):
        raise FileNotFoundError(f"Artifact not found: {path}")
    with open(path, "rb") as f:
        return pickle.load(f)

try:
    _model         = _load("random_forest_model.pkl")
    _scaler        = _load("scaler.pkl")
    _feature_names = _load("feature_names.pkl")
    _model_loaded  = True
except FileNotFoundError as e:
    print(f"[WARNING] Model not loaded: {e}")
    _model_loaded = False

LABEL_MAP    = {0: "Low", 1: "Medium", 2: "High"}
LABEL_COLOUR = {"Low": "green", "Medium": "orange", "High": "red"}

# ── Pydantic Schemas ───────────────────────────────────────────────
class StudentData(BaseModel):
    """Raw student academic data — matches the original CSV features."""

    attendance_pct:           float = Field(..., ge=0,  le=100,  description="Attendance percentage")
    midterm_score:            float = Field(..., ge=0,  le=100,  description="Midterm exam score")
    final_score:              float = Field(..., ge=0,  le=100,  description="Final exam score")
    assignments_avg:          float = Field(..., ge=0,  le=100,  description="Average assignment score")
    quizzes_avg:              float = Field(..., ge=0,  le=100,  description="Average quiz score")
    participation_score:      float = Field(..., ge=0,  le=100,  description="Class participation score")
    projects_score:           float = Field(..., ge=0,  le=100,  description="Projects score")
    study_hours_per_week:     float = Field(..., ge=0,  le=80,   description="Weekly study hours")
    stress_level:             int   = Field(..., ge=1,  le=10,   description="Stress level 1–10")
    sleep_hours_per_night:    float = Field(..., ge=0,  le=12,   description="Average sleep hours")
    extracurricular:          int   = Field(..., ge=0,  le=1,    description="Extracurricular (0/1)")
    avg_exam_score:           float = Field(..., ge=0,  le=100,  description="Average of exam scores")
    exam_improvement:         float = Field(...,                  description="Final - Midterm score")
    study_sleep_ratio:        float = Field(...,                  description="Study hrs / Sleep hrs")
    low_score_count:          int   = Field(..., ge=0,            description="Count of scores < 60")
    overall_avg_score:        float = Field(..., ge=0,  le=100,  description="Overall average score")
    score_variability:        float = Field(..., ge=0,            description="Std dev of scores")
    attendance_efficiency:    float = Field(...,                  description="Attendance efficiency index")

    class Config:
        schema_extra = {
            "example": {
                "attendance_pct": 85.5,
                "midterm_score": 62.0,
                "final_score": 58.0,
                "assignments_avg": 70.0,
                "quizzes_avg": 65.0,
                "participation_score": 55.0,
                "projects_score": 60.0,
                "study_hours_per_week": 12.0,
                "stress_level": 7,
                "sleep_hours_per_night": 5.5,
                "extracurricular": 0,
                "avg_exam_score": 60.0,
                "exam_improvement": -4.0,
                "study_sleep_ratio": 2.18,
                "low_score_count": 3,
                "overall_avg_score": 62.0,
                "score_variability": 5.2,
                "attendance_efficiency": 72.5,
            }
        }


class PriorityResponse(BaseModel):
    priority_label:     str
    priority_code:      int
    confidence:         float
    probabilities:      dict
    colour:             str
    recommendation:     str
    top_risk_features:  List[str]


# ── Helper: build feature vector ──────────────────────────────────
_FIELD_TO_COL = {
    "attendance_pct":        "Attendance (%)",
    "midterm_score":         "Midterm_Score",
    "final_score":           "Final_Score",
    "assignments_avg":       "Assignments_Avg",
    "quizzes_avg":           "Quizzes_Avg",
    "participation_score":   "Participation_Score",
    "projects_score":        "Projects_Score",
    "study_hours_per_week":  "Study_Hours_per_Week",
    "stress_level":          "Stress_Level (1-10)",
    "sleep_hours_per_night": "Sleep_Hours_per_Night",
    "extracurricular":       "Extracurricular",
    "avg_exam_score":        "Avg_Exam_Score",
    "exam_improvement":      "Exam_Improvement",
    "study_sleep_ratio":     "Study_Sleep_Ratio",
    "low_score_count":       "Low_Score_Count",
    "overall_avg_score":     "Overall_Avg_Score",
    "score_variability":     "Score_Variability",
    "attendance_efficiency": "Attendance_Efficiency",
}

def _build_feature_vector(data: StudentData) -> np.ndarray:
    """Map pydantic fields → ordered numpy array matching training features."""
    col_values = {col: getattr(data, field)
                  for field, col in _FIELD_TO_COL.items()}
    vec = np.array([col_values[col] for col in _feature_names], dtype=float)
    return vec.reshape(1, -1)


def _generate_recommendation(label: str, data: StudentData) -> str:
    recs = {
        "High": (
            f"⚠️  High Priority — Immediate action required. "
            f"Your overall average ({data.overall_avg_score:.1f}) and "
            f"low-score count ({data.low_score_count}) indicate critical risk. "
            f"Focus on exam preparation and assignment completion this week."
        ),
        "Medium": (
            f"⚡ Medium Priority — Stay on track. "
            f"Attendance ({data.attendance_pct:.1f}%) and study hours "
            f"({data.study_hours_per_week:.1f}h/wk) need monitoring. "
            f"Review weaker subjects and maintain consistent study sessions."
        ),
        "Low": (
            f"✅ Low Priority — Good standing. "
            f"Overall average ({data.overall_avg_score:.1f}) looks healthy. "
            f"Keep your current study routine and don't overlook upcoming deadlines."
        ),
    }
    return recs.get(label, "")


def _risk_features(data: StudentData) -> List[str]:
    """Return top risk signals for the student."""
    risks = []
    if data.overall_avg_score < 65:
        risks.append(f"Low overall average ({data.overall_avg_score:.1f})")
    if data.final_score < 60:
        risks.append(f"Low final score ({data.final_score:.1f})")
    if data.low_score_count >= 3:
        risks.append(f"Many low scores ({data.low_score_count} modules below 60)")
    if data.attendance_pct < 70:
        risks.append(f"Poor attendance ({data.attendance_pct:.1f}%)")
    if data.exam_improvement < -5:
        risks.append(f"Score declining ({data.exam_improvement:.1f} pts)")
    if data.study_hours_per_week < 8:
        risks.append(f"Low study hours ({data.study_hours_per_week:.1f}h/wk)")
    if data.stress_level >= 8:
        risks.append(f"High stress level ({data.stress_level}/10)")
    return risks[:5] or ["No critical risk factors detected"]


# ── Endpoints ─────────────────────────────────────────────────────

@router.get("/health")
async def health():
    return {
        "status":       "ok",
        "model_loaded": _model_loaded,
        "model_type":   type(_model).__name__ if _model_loaded else None,
        "features":     len(_feature_names)   if _model_loaded else None,
    }


@router.post("/predict-priority", response_model=PriorityResponse)
async def predict_priority(data: StudentData):
    """
    Predict task priority (Low / Medium / High) for a student.
    Returns predicted label, confidence, probabilities, and recommendations.
    """
    if not _model_loaded:
        raise HTTPException(status_code=503,
                            detail="ML model not loaded. Run training scripts first.")
    try:
        X = _build_feature_vector(data)

        # Tree models don't need scaling; kept here if model changes
        pred_code = int(_model.predict(X)[0])
        proba     = _model.predict_proba(X)[0]
        confidence = float(proba[pred_code])

        label = LABEL_MAP[pred_code]

        return PriorityResponse(
            priority_label    = label,
            priority_code     = pred_code,
            confidence        = round(confidence, 4),
            probabilities     = {LABEL_MAP[i]: round(float(p), 4)
                                 for i, p in enumerate(proba)},
            colour            = LABEL_COLOUR[label],
            recommendation    = _generate_recommendation(label, data),
            top_risk_features = _risk_features(data),
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/predict-batch")
async def predict_batch(students: List[StudentData]):
    """Predict priority for a list of students (batch mode)."""
    if not _model_loaded:
        raise HTTPException(status_code=503, detail="Model not loaded.")
    results = []
    for student in students:
        X     = _build_feature_vector(student)
        code  = int(_model.predict(X)[0])
        proba = _model.predict_proba(X)[0]
        results.append({
            "priority_label": LABEL_MAP[code],
            "priority_code":  code,
            "confidence":     round(float(proba[code]), 4),
        })
    return {"predictions": results, "count": len(results)}