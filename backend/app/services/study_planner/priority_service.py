"""
priority_service.py

Loads the trained Priority classifier (XGBoost) and its label encoder ONCE
at module import time, and exposes predict_priority() for the study-planner
API routes to call per request.

Reuses the exact artifacts produced by ml_scripts/study-planner/train_priority_model.py -
this module does not retrain or re-derive anything, it only runs inference.
"""

import logging
import os

import joblib
import pandas as pd

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Paths (relative to this file, so it works regardless of the process cwd)
# ---------------------------------------------------------------------------
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
MODELS_DIR = os.path.join(BACKEND_DIR, "trained-models", "stuyd-planner")  # existing (typo'd) path, kept for consistency

MODEL_PATH = os.path.join(MODELS_DIR, "priority_model.joblib")
LABEL_ENCODERS_PATH = os.path.join(MODELS_DIR, "label_encoders.joblib")
XGB_LABEL_ENCODER_PATH = os.path.join(MODELS_DIR, "xgb_label_encoder.joblib")

# The exact 13 features and order the model was trained on - see
# train_priority_model.py sections 4 & 6 (model_feature_cols). Any caller of
# predict_priority() must supply exactly these keys.
FEATURE_ORDER = [
    "date", "weight", "num_of_prev_attempts", "studied_credits",
    "module_presentation_length", "date_registration", "prior_avg_score",
    "avg_weekly_clicks", "clicks_trend", "active_weeks_ratio", "has_vle_activity",
    "assessment_type_enc", "code_module_enc",
]


class PriorityServiceError(Exception):
    """Raised for validation failures or when the model failed to load at startup."""


# ---------------------------------------------------------------------------
# Load model artifacts once at import time (NOT per-request). A missing file
# is logged clearly here rather than crashing the whole app at import - the
# endpoints instead raise PriorityServiceError on first use, which routes
# turn into a proper 500 with a clear message.
# ---------------------------------------------------------------------------
_model = None
_xgb_label_encoder = None
_label_encoders = None

try:
    _model = joblib.load(MODEL_PATH)
    _label_encoders = joblib.load(LABEL_ENCODERS_PATH)
    if os.path.exists(XGB_LABEL_ENCODER_PATH):
        _xgb_label_encoder = joblib.load(XGB_LABEL_ENCODER_PATH)
    logger.info("priority_service: loaded priority_model.joblib, label_encoders.joblib"
                + (", xgb_label_encoder.joblib" if _xgb_label_encoder is not None else ""))
except FileNotFoundError as e:
    logger.error(
        "priority_service: STARTUP ERROR - missing model artifact: %s. "
        "Run ml_scripts/study-planner/train_priority_model.py to generate it. "
        "predict_priority() will raise PriorityServiceError until this is fixed.",
        e,
    )
except Exception:
    logger.exception("priority_service: STARTUP ERROR - unexpected failure loading model artifacts.")


def validate_and_build_feature_row(task_features: dict) -> pd.DataFrame:
    """Shared validation used by both predict_priority() here and explain_service.explain_task()."""
    if not isinstance(task_features, dict):
        raise PriorityServiceError("task_features must be a dict of feature_name -> value.")

    missing = [f for f in FEATURE_ORDER if f not in task_features]
    if missing:
        raise PriorityServiceError(f"Missing required feature(s): {missing}")

    unknown = [f for f in task_features if f not in FEATURE_ORDER]
    if unknown:
        logger.warning("priority_service: ignoring unexpected feature key(s): %s", unknown)

    row = {}
    for f in FEATURE_ORDER:
        value = task_features[f]
        try:
            row[f] = float(value)
        except (TypeError, ValueError):
            raise PriorityServiceError(f"Feature '{f}' must be numeric, got {value!r}")

    return pd.DataFrame([row])[FEATURE_ORDER]


def predict_priority(task_features: dict) -> dict:
    """
    task_features: dict with exactly the 13 keys in FEATURE_ORDER.
    Returns {"priority_label": "High"/"Medium"/"Low", "confidence": float}
    where confidence is the model's predicted probability for the chosen class.
    """
    if _model is None:
        raise PriorityServiceError("Priority model is not loaded - check server startup logs.")

    row_df = validate_and_build_feature_row(task_features)

    pred_num = _model.predict(row_df)[0]
    proba = _model.predict_proba(row_df)[0]

    if _xgb_label_encoder is not None:
        priority_label = _xgb_label_encoder.inverse_transform([pred_num])[0]
    else:
        priority_label = pred_num

    confidence = float(proba[int(pred_num)])

    return {"priority_label": str(priority_label), "confidence": confidence}
