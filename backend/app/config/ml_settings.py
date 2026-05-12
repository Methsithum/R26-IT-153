"""
ML model paths and feature configuration for the Career Prediction Engine.
Keep this in sync with dataset_preprocessing.py FEATURE_DOMAINS.
"""

from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────────
# ml_settings.py lives at: backend/app/config/ml_settings.py
# Project root is 4 levels up (config → app → backend → project root)
_PROJECT_ROOT = Path(__file__).resolve().parents[3]

SAVED_DIR = (
    _PROJECT_ROOT / "trained-models" / "career-prediction-engine" / "saved_objects"
)

# ── Model filenames ────────────────────────────────────────────────────────────
SCALER_FILE          = "scaler.pkl"
FEATURE_COLUMNS_FILE = "feature_columns.pkl"
RISK_MODEL_FILE      = "model_A_risk_xgboost.pkl"
CAREER_MODEL_FILE    = "model_B_career_ridge.pkl"
METADATA_FILE        = "model_metadata.pkl"

# ── Feature domains (must match dataset_preprocessing.py exactly) ──────────────
FEATURE_DOMAINS: dict[str, list[str]] = {
    "academic": [
        "gpa_cumulative",
        "gpa_trend",
        "assignment_completion_rate",
        "late_submission_rate",
        "resit_count",
        "project_performance",
    ],
    "behavioral": [
        "attendance_rate",
        "weekly_study_hours",
        "sleep_hours_avg",
        "sleep_consistency",
        "part_time_work_hours",
    ],
    "emotional": [
        "stress_level",
        "anxiety_score",
        "mood_stability",
    ],
    "career": [
        "career_clarity_score",
    ],
}

FEATURE_COLUMNS: list[str] = [
    col for cols in FEATURE_DOMAINS.values() for col in cols
]

# ── Risk label map ─────────────────────────────────────────────────────────────
RISK_LABEL_MAP: dict[int, str] = {0: "Low", 1: "Medium", 2: "High"}

# ── Risk → numeric score (for frontend progress bars) ─────────────────────────
RISK_SCORE_MAP: dict[int, int] = {0: 20, 1: 55, 2: 85}
