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
from .focus_config import CLASS_CONF_THRESHOLDS, CLASSES, TEMPORAL_FEATURE_NAMES
from .temporal import TemporalFeatureBuffer, apply_temporal_gate

BASE_DIR    = Path(__file__).resolve().parents[3]
MODELS_PATH = BASE_DIR / "trained-models" / "focus"

_lock  = threading.Lock()
_state = {}
_temporal = TemporalFeatureBuffer()


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
                _state["columns"] = []
            else:
                _state["kind"]    = "classical"
                _state["model"]   = joblib.load(MODELS_PATH / "focus_classical_model.joblib")
                _state["scaler"]  = joblib.load(MODELS_PATH / "feature_scaler.joblib")
                _state["columns"] = summary["feature_columns"]

            _state["uses_temporal"] = any(c in TEMPORAL_FEATURE_NAMES for c in _state["columns"])
            face_crop.get_landmarker()
        except Exception as exc:
            _state.clear()
            raise ModelNotReadyError(f"Focus model unavailable: {exc}") from exc
    return _state


def is_ready() -> bool:
    return bool(_state)


def reset_temporal_buffer() -> None:
    with _lock:
        _temporal.clear()


def _predict_classical(st, features: dict):
    vec = np.array([[features.get(c, 0.0) for c in st["columns"]]])
    vec = st["scaler"].transform(vec)
    return st["model"].predict_proba(vec)[0]


def _predict_cnn(st, face_bgr):
    import cv2
    from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

    img = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2RGB)
    img = preprocess_input(img.astype(np.float32))
    return st["model"].predict(np.expand_dims(img, axis=0), verbose=0)[0]


def _apply_class_thresholds(probs: np.ndarray) -> str:
    """Keep argmax only if it clears its own bar; otherwise try runners-up.

    Uncertain distracted guesses become Focused, never Boredom — that was the
    40% precision leak on the test confusion matrix.
    """
    order = np.argsort(probs)[::-1]
    for idx in order:
        cls = CLASSES[int(idx)]
        if float(probs[idx]) >= CLASS_CONF_THRESHOLDS[cls]:
            return cls
    return "Focused"


apply_class_thresholds = _apply_class_thresholds


def predict_from_frame(frame_bgr):
    """Full pipeline: detect+crop -> features -> state. Returns a dict
    matching the PredictResponse schema."""
    st = _load()

    face = face_crop.detect_and_crop(frame_bgr)
    if face is None:
        return {
            "face_detected": False,
            "state": None,
            "confidence": 0.0,
            "probs": {},
            "distracted": False,
            "binary_label": None,
        }

    features = face_crop.extract_features(face)
    with _lock:
        temporal_stats = _temporal.add(features) if features else _temporal.stats()
        n_frames = len(_temporal)

    if features and st.get("uses_temporal"):
        features = {**features, **temporal_stats}

    if st["kind"] == "cnn":
        probs = _predict_cnn(st, face)
    else:
        if features is None:
            return {
                "face_detected": False,
                "state": None,
                "confidence": 0.0,
                "probs": {},
                "distracted": False,
                "binary_label": None,
            }
        probs = _predict_classical(st, features)

    prob_map = {cls: float(p) for cls, p in zip(CLASSES, probs)}
    state = _apply_class_thresholds(probs)
    state = apply_temporal_gate(state, prob_map, temporal_stats, n_frames)

    distracted = state != "Focused"
    return {
        "face_detected": True,
        "state": state,
        "confidence": prob_map.get(state, 0.0),
        "probs": prob_map,
        "distracted": distracted,
        "binary_label": "Distracted" if distracted else "Focused",
    }
