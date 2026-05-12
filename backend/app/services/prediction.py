"""
ML model loading and inference for the Career Prediction Engine.
Models are loaded once on startup via load_models(); all prediction
calls reuse the cached objects.
"""

import joblib
import numpy as np
import pandas as pd
from sklearn.exceptions import InconsistentVersionWarning
import warnings

from app.config.ml_settings import (
    SAVED_DIR,
    SCALER_FILE,
    FEATURE_COLUMNS_FILE,
    RISK_MODEL_FILE,
    CAREER_MODEL_FILE,
    FEATURE_COLUMNS,
    RISK_LABEL_MAP,
    RISK_SCORE_MAP,
)

# ── Module-level model cache ───────────────────────────────────────────────────
_scaler          = None
_feature_columns = None
_risk_model      = None
_career_model    = None


def _safe_load(path):
    """Load a pickle, converting sklearn version warnings to a caught exception."""
    warnings.filterwarnings("error", category=InconsistentVersionWarning)
    try:
        return joblib.load(path)
    except InconsistentVersionWarning as w:
        warnings.filterwarnings("default", category=InconsistentVersionWarning)
        return joblib.load(path)
    finally:
        warnings.filterwarnings("default", category=InconsistentVersionWarning)


def load_models() -> None:
    """Load all pkl artefacts into module-level cache. Called once on startup."""
    global _scaler, _feature_columns, _risk_model, _career_model

    _scaler          = _safe_load(SAVED_DIR / SCALER_FILE)
    _feature_columns = _safe_load(SAVED_DIR / FEATURE_COLUMNS_FILE)
    _risk_model      = _safe_load(SAVED_DIR / RISK_MODEL_FILE)
    _career_model    = _safe_load(SAVED_DIR / CAREER_MODEL_FILE)

    print(
        f"[ML] Models loaded from {SAVED_DIR}\n"
        f"     risk model  : {type(_risk_model).__name__}\n"
        f"     career model: {type(_career_model).__name__}"
    )


def _career_grade(score: float) -> str:
    if score >= 80:
        return "Excellent"
    if score >= 65:
        return "Good"
    if score >= 50:
        return "Fair"
    return "Poor"


def predict_student(data: dict) -> dict:
    """
    Run full inference for one student dict and return a dict matching
    PredictionOutput schema.
    """
    if _risk_model is None or _career_model is None:
        raise RuntimeError("Models not loaded — call load_models() first.")

    # Build DataFrame in the exact column order used during training
    X = pd.DataFrame([data], columns=_feature_columns)
    X_scaled = _scaler.transform(X)

    # ── Risk model ────────────────────────────────────────────────────────────
    risk_encoded = int(_risk_model.predict(X_scaled)[0])
    risk_proba   = _risk_model.predict_proba(X_scaled)[0]

    risk_level = RISK_LABEL_MAP[risk_encoded]
    risk_score = RISK_SCORE_MAP[risk_encoded]

    # ── Career model ──────────────────────────────────────────────────────────
    career_score_raw = float(_career_model.predict(X_scaled)[0])
    career_score     = round(float(np.clip(career_score_raw, 30.0, 100.0)), 1)

    return {
        "risk_level":   risk_level,
        "risk_score":   risk_score,
        "prob_low":     round(float(risk_proba[0]), 4),
        "prob_medium":  round(float(risk_proba[1]), 4),
        "prob_high":    round(float(risk_proba[2]), 4),
        "career_score": career_score,
        "career_grade": _career_grade(career_score),
    }
