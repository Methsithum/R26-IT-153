"""
Focus-state inference service, backed by whichever model
ml_scripts/focus/focus_state_model_training.ipynb selected as most accurate
(trained-models/focus/results_summary.json records which one) -- either a
classical model (focus_classical_model.joblib + feature_scaler.joblib) on
MediaPipe landmark/blendshape features, or the MobileNetV2 CNN
(focus_mobilenetv2.keras) on the cropped face image directly.

Face detection, cropping and feature extraction live in face_crop.py, the
same module the training notebook builds its dataset and feature cache with,
so a webcam frame and a training frame go through identical code.

The model is loaded lazily on first use (not at import time), so importing
this module -- e.g. at FastAPI startup -- never crashes the app if a model
file happens to be missing, and never touches disk/TensorFlow until a
prediction is actually requested.
"""
import json
import threading
from pathlib import Path

import joblib
import numpy as np

from . import face_crop

BASE_DIR    = Path(__file__).resolve().parents[3]
MODELS_PATH = BASE_DIR / "trained-models" / "focus"

CLASSES        = ["Focused", "Fatigue", "Anxiety", "Boredom"]
CONF_THRESHOLD = 0.50   # below this, report Focused rather than act on an uncertain guess

_lock  = threading.Lock()
_state = {}


class ModelNotReadyError(RuntimeError):
    pass


def _load():
    if _state:
        return _state
    with _lock:
        if _state:
            return _state
        try:
            with open(MODELS_PATH / "results_summary.json") as f:
                summary = json.load(f)

            if summary["best_model"] == "MobileNetV2 CNN":
                from tensorflow.keras.models import load_model
                _state["kind"]  = "cnn"
                _state["model"] = load_model(str(MODELS_PATH / "focus_mobilenetv2.keras"))
            else:
                _state["kind"]    = "classical"
                _state["model"]   = joblib.load(MODELS_PATH / "focus_classical_model.joblib")
                _state["scaler"]  = joblib.load(MODELS_PATH / "feature_scaler.joblib")
                _state["columns"] = summary["feature_columns"]

            face_crop.get_landmarker()
        except Exception as exc:
            _state.clear()
            raise ModelNotReadyError(f"Focus model unavailable: {exc}") from exc
    return _state


def is_ready() -> bool:
    return bool(_state)


def _predict_classical(st, features: dict):
    vec = np.array([[features[c] for c in st["columns"]]])
    vec = st["scaler"].transform(vec)
    return st["model"].predict_proba(vec)[0]


def _predict_cnn(st, face_bgr):
    import cv2
    from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

    img = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2RGB)
    img = preprocess_input(img.astype(np.float32))
    return st["model"].predict(np.expand_dims(img, axis=0), verbose=0)[0]


def predict_from_frame(frame_bgr):
    """Full pipeline: detect+crop -> features -> state. Returns a dict
    matching the PredictResponse schema."""
    st = _load()

    face = face_crop.detect_and_crop(frame_bgr)
    if face is None:
        return {"face_detected": False, "state": None, "confidence": 0.0, "probs": {}}

    if st["kind"] == "cnn":
        probs = _predict_cnn(st, face)
    else:
        features = face_crop.extract_features(face)
        if features is None:
            return {"face_detected": False, "state": None, "confidence": 0.0, "probs": {}}
        probs = _predict_classical(st, features)

    pred_idx = int(np.argmax(probs))
    state = CLASSES[pred_idx]
    if float(probs[pred_idx]) < CONF_THRESHOLD:
        state = "Focused"

    prob_map = {cls: float(p) for cls, p in zip(CLASSES, probs)}
    return {
        "face_detected": True,
        "state": state,
        "confidence": prob_map[state],
        "probs": prob_map,
    }
