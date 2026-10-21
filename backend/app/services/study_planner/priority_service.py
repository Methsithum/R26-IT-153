"""priority_service.py"""

import logging
import os

import joblib
import pandas as pd

from app.services.study_planner.ordinal_priority_model import CLASS_ORDER

logger = logging.getLogger(__name__)

# Paths (relative to this file, so it works regardless of the process cwd)
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
MODELS_DIR = os.path.join(BACKEND_DIR, "app", "models", "study_planner")

MODEL_PATH = os.path.join(MODELS_DIR, "priority_model.joblib")
LABEL_ENCODERS_PATH = os.path.join(MODELS_DIR, "label_encoders.joblib")

# The exact 13 features and order the model was trained on
FEATURE_ORDER = [
    "date", "weight", "num_of_prev_attempts", "studied_credits",
    "module_presentation_length", "date_registration", "prior_avg_score",
    "avg_weekly_clicks", "clicks_trend", "active_weeks_ratio", "has_vle_activity",
    "assessment_type_enc", "code_module_enc",
]


# code_module_enc sentinel
UNKNOWN_MODULE_ENC = -1
DEFAULT_MODULE_CODE_COUNT = 7


class PriorityServiceError(Exception):
    """Raised for validation failures or when the model failed to load at startup."""


# Load model artifacts once at import time (NOT per-request).
_model = None
_label_encoders = None

try:
    _model = joblib.load(MODEL_PATH)
    _label_encoders = joblib.load(LABEL_ENCODERS_PATH)
    logger.info("priority_service: loaded priority_model.joblib (OrdinalPriorityModel), label_encoders.joblib")
except FileNotFoundError as e:
    logger.error(
        "priority_service: STARTUP ERROR - missing model artifact: %s. "
        "Run ml_scripts/study-planner/train_priority_model_constrained.py to generate it. "
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


def module_code_count() -> int:
    try:
        return len(_label_encoders["code_module"].classes_)
    except Exception:
        return DEFAULT_MODULE_CODE_COUNT


def expand_unknown_module(row_df: pd.DataFrame) -> pd.DataFrame:
    """One row per training module code"""
    if int(row_df.at[0, "code_module_enc"]) != UNKNOWN_MODULE_ENC:
        return row_df
    n = module_code_count()
    rows = pd.concat([row_df] * n, ignore_index=True)
    rows["code_module_enc"] = [float(i) for i in range(n)]
    return rows


def predict_priority(task_features: dict) -> dict:
    """task_features"""
    if _model is None:
        raise PriorityServiceError("Priority model is not loaded - check server startup logs.")

    row_df = expand_unknown_module(validate_and_build_feature_row(task_features))

    # Average class probability over the input rows
    proba = _model.predict_proba(row_df).mean(axis=0)
    pred_idx = int(proba.argmax())

    priority_label = CLASS_ORDER[pred_idx]
    confidence = float(proba[pred_idx])

    return {"priority_label": str(priority_label), "confidence": confidence}
