"""Loads the trained behaviour-category classifier and predicts a category
from a live activity snapshot. This is the model behavior_analysis.py calls
instead of asking the LLM to pick the category itself.
"""

from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import pandas as pd

from app.services.journal.ml.feature_extraction import FEATURE_LABELS, extract_features

MODEL_PATH = Path(__file__).resolve().parents[4] / "trained-models" / "behavior-analysis" / "behavior_model.joblib"

_cache: Optional[dict] = None


def _load():
    global _cache
    if _cache is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(
                "behavior_model.joblib not found - run "
                "`python -m app.services.journal.ml.train_behavior_model` from backend/ first."
            )
        _cache = joblib.load(MODEL_PATH)
    return _cache


def model_available() -> bool:
    return MODEL_PATH.exists()


def predict_category(snapshot: Dict[str, Any]) -> Dict[str, Any]:
    bundle = _load()
    model = bundle["model"]
    features = pd.DataFrame([extract_features(snapshot)], columns=bundle["feature_names"])

    category = model.predict(features)[0]
    probabilities = model.predict_proba(features)[0]
    confidence = float(max(probabilities))

    return {
        "category": category,
        "confidence": round(confidence, 3),
        "modelName": bundle.get("model_name", "unknown"),
    }


def top_feature_contributions(snapshot: Dict[str, Any], limit: Optional[int] = None) -> List[Dict[str, Any]]:
    """Which of this snapshot's numbers the model leans on most, ranked by
    the trained model's global feature_importances_. This is a global
    ranking (which variables the model relies on overall), not a
    per-prediction explanation (e.g. SHAP) - it's shown next to each
    student's own values so the two together read as "why this verdict"."""
    bundle = _load()
    model = bundle["model"]
    feature_names = bundle["feature_names"]
    values = extract_features(snapshot)
    importances = getattr(model, "feature_importances_", None)
    if importances is None:
        return []

    ranked = sorted(
        zip(feature_names, importances, values), key=lambda row: row[1], reverse=True
    )
    if limit is not None:
        ranked = ranked[:limit]
    total = sum(imp for _, imp, _ in ranked) or 1.0
    return [
        {
            "feature": name,
            "label": FEATURE_LABELS.get(name, name),
            "value": value,
            "importance": round(float(imp), 4),
            "weightShare": round(float(imp) / float(total), 4),
        }
        for name, imp, value in ranked
    ]
