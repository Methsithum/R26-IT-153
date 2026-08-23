"""
explain_service.py

Loads the trained Priority classifier and builds a SHAP TreeExplainer ONCE
at module import time (the expensive part), then exposes explain_task() for
cheap per-request single-row explanations.

Adapts explain_single_prediction() / sentence_from_contributions() from
ml_scripts/study-planner/explain_priority_shap.py - same feature-contribution
logic and the same plain-English sentence style, just computed for one row
at a time instead of the whole test set (that script is not imported here,
since importing it would re-run its full batch SHAP computation as a
module-level side effect).
"""

import logging
import os

import joblib
import pandas as pd

from app.services.study_planner.priority_service import FEATURE_ORDER, PriorityServiceError, validate_and_build_feature_row

logger = logging.getLogger(__name__)

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
MODELS_DIR = os.path.join(BACKEND_DIR, "trained-models", "stuyd-planner")

MODEL_PATH = os.path.join(MODELS_DIR, "priority_model.joblib")
XGB_LABEL_ENCODER_PATH = os.path.join(MODELS_DIR, "xgb_label_encoder.joblib")


class ExplainServiceError(Exception):
    """Raised for validation failures or when the explainer failed to initialize at startup."""


_model = None
_xgb_label_encoder = None
_explainer = None
_class_names_by_index = None

try:
    import shap  # imported here (not at app top-level) so a missing shap install only breaks explain routes

    _model = joblib.load(MODEL_PATH)
    _xgb_label_encoder = joblib.load(XGB_LABEL_ENCODER_PATH)
    _explainer = shap.TreeExplainer(_model)
    _class_names_by_index = list(_xgb_label_encoder.classes_)
    logger.info("explain_service: loaded model and built SHAP TreeExplainer at startup.")
except FileNotFoundError as e:
    logger.error(
        "explain_service: STARTUP ERROR - missing model artifact: %s. "
        "Run ml_scripts/study-planner/train_priority_model.py first. "
        "explain_task() will raise ExplainServiceError until this is fixed.",
        e,
    )
except ImportError:
    logger.exception(
        "explain_service: STARTUP ERROR - the 'shap' package is not installed. "
        "Run `pip install shap` in the backend venv. explain_task() will raise until this is fixed."
    )
except Exception:
    logger.exception("explain_service: STARTUP ERROR - unexpected failure initializing SHAP explainer.")


def _sentence_from_contributions(predicted_label, contributions, top_n=2):
    """Identical wording style to explain_priority_shap.py's sentence_from_contributions()."""
    ranked = sorted(contributions.items(), key=lambda kv: abs(kv[1]), reverse=True)[:top_n]
    parts = []
    for feature, value in ranked:
        sign = "+" if value >= 0 else ""
        parts.append(f"{feature} ({sign}{value:.2f} contribution)")
    joined = " and ".join(parts)
    return f"Task flagged {predicted_label} priority mainly because of {joined}."


def explain_task(task_features: dict) -> dict:
    """
    task_features: dict with exactly the 13 keys in FEATURE_ORDER (same shape
    predict_priority() takes).
    Returns {"predicted_priority": str, "feature_contributions": {feature: float, ...},
             "explanation_sentence": str}
    """
    if _model is None or _explainer is None or _xgb_label_encoder is None:
        raise ExplainServiceError("Explainability service is not initialized - check server startup logs.")

    try:
        row_df = validate_and_build_feature_row(task_features)
    except PriorityServiceError as e:
        raise ExplainServiceError(str(e))

    pred_num = _model.predict(row_df)[0]
    predicted_label = _xgb_label_encoder.inverse_transform([pred_num])[0]
    class_idx = _class_names_by_index.index(predicted_label)

    row_shap = _explainer(row_df)
    contributions = {
        FEATURE_ORDER[i]: float(row_shap.values[0, i, class_idx])
        for i in range(len(FEATURE_ORDER))
    }

    sentence = _sentence_from_contributions(predicted_label, contributions)

    return {
        "predicted_priority": str(predicted_label),
        "feature_contributions": contributions,
        "explanation_sentence": sentence,
    }
