"""Loads the trained behaviour-category classifier and predicts a category
from a live activity snapshot. This is the model behavior_analysis.py calls
instead of asking the LLM to pick the category itself.
"""

from pathlib import Path
from typing import Any, Dict, Optional

import joblib

from app.services.journal.ml.feature_extraction import extract_features

MODEL_PATH = Path(__file__).parent / "behavior_model.joblib"

_cache: Optional[dict] = None


def _load():
    global _cache
    if _cache is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(
                "behavior_model.joblib not found - run "
                "`python -m app.services.journal.ml.train_behavior_model` first."
            )
        _cache = joblib.load(MODEL_PATH)
    return _cache


def model_available() -> bool:
    return MODEL_PATH.exists()


def predict_category(snapshot: Dict[str, Any]) -> Dict[str, Any]:
    bundle = _load()
    model = bundle["model"]
    features = [extract_features(snapshot)]

    category = model.predict(features)[0]
    probabilities = model.predict_proba(features)[0]
    confidence = float(max(probabilities))

    return {"category": category, "confidence": round(confidence, 3)}
