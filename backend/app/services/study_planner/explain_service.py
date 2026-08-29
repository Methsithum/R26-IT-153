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

--- Ordinal monotonic model (PROJECT CONTEXT.md Section 5c) ---
priority_model.joblib is now an OrdinalMonotonicPriorityModel (see
ordinal_monotonic_model.py): two binary XGBClassifiers, model_medium
(P(priority >= Medium)) and model_high (P(priority >= High)), NOT a single
multi-class XGBClassifier. A single shap.TreeExplainer built against the
wrapper itself would fail (shap needs a real tree booster, not a Python
object with a predict_proba method that internally calls two of them) - so
this module builds ONE TreeExplainer per underlying binary model instead, and
picks which one's SHAP values explain the predicted class:
  - predicted Low:    -shap(model_medium)              (didn't clear the Medium bar)
  - predicted High:     shap(model_high)                (cleared the High bar)
  - predicted Medium:   shap(model_medium) - shap(model_high)  (cleared Medium, didn't clear High)
In every case positive = pushed toward the predicted label, preserving the
same contract explain_schemas.ExplainResponse documents.
"""

import logging
import os

import joblib
import pandas as pd

from app.services.study_planner.ordinal_monotonic_model import CLASS_ORDER
from app.services.study_planner.priority_service import FEATURE_ORDER, PriorityServiceError, validate_and_build_feature_row

logger = logging.getLogger(__name__)

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
MODELS_DIR = os.path.join(BACKEND_DIR, "app", "models", "study_planner")

MODEL_PATH = os.path.join(MODELS_DIR, "priority_model.joblib")


class ExplainServiceError(Exception):
    """Raised for validation failures or when the explainer failed to initialize at startup."""


_model = None
_explainer_medium = None
_explainer_high = None

try:
    import shap  # imported here (not at app top-level) so a missing shap install only breaks explain routes

    _model = joblib.load(MODEL_PATH)
    # The wrapper isn't itself a tree model - build one TreeExplainer per
    # underlying binary XGBClassifier instead (see module docstring).
    _explainer_medium = shap.TreeExplainer(_model.model_medium)
    _explainer_high = shap.TreeExplainer(_model.model_high)
    logger.info("explain_service: loaded ordinal model and built two SHAP TreeExplainers (medium/high) at startup.")
except FileNotFoundError as e:
    logger.error(
        "explain_service: STARTUP ERROR - missing model artifact: %s. "
        "Run ml_scripts/study-planner/train_priority_model_monotonic.py first. "
        "explain_task() will raise ExplainServiceError until this is fixed.",
        e,
    )
except ImportError:
    logger.exception(
        "explain_service: STARTUP ERROR - the 'shap' package is not installed. "
        "Run `pip install shap` in the backend venv. explain_task() will raise until this is fixed."
    )
except AttributeError:
    logger.exception(
        "explain_service: STARTUP ERROR - priority_model.joblib is not an OrdinalMonotonicPriorityModel "
        "(no .model_medium/.model_high). Was the wrong artifact deployed?"
    )
except Exception:
    logger.exception("explain_service: STARTUP ERROR - unexpected failure initializing SHAP explainers.")


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
    if _model is None or _explainer_medium is None or _explainer_high is None:
        raise ExplainServiceError("Explainability service is not initialized - check server startup logs.")

    try:
        row_df = validate_and_build_feature_row(task_features)
    except PriorityServiceError as e:
        raise ExplainServiceError(str(e))

    pred_idx = int(_model.predict(row_df)[0])
    predicted_label = CLASS_ORDER[pred_idx]

    # Pick which binary model's SHAP values explain the predicted class - see
    # module docstring. TreeExplainer on a binary XGBClassifier returns a
    # single (n_samples, n_features) array in log-odds space toward the
    # positive class ("priority >= threshold"), not a per-class 3D array like
    # the old single multi:softmax model produced.
    shap_medium = _explainer_medium(row_df).values[0]  # toward ">=Medium"
    shap_high = _explainer_high(row_df).values[0]  # toward ">=High"

    if predicted_label == "Low":
        raw_contrib = -shap_medium
    elif predicted_label == "High":
        raw_contrib = shap_high
    else:  # Medium: cleared the >=Medium bar but not the >=High bar
        raw_contrib = shap_medium - shap_high

    contributions = {
        FEATURE_ORDER[i]: float(raw_contrib[i])
        for i in range(len(FEATURE_ORDER))
    }

    sentence = _sentence_from_contributions(predicted_label, contributions)

    return {
        "predicted_priority": str(predicted_label),
        "feature_contributions": contributions,
        "explanation_sentence": sentence,
    }
