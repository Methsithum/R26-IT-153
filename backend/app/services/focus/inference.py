"""
Focus-state inference service, backed by the models trained in
ml_scripts/focus/train_model.py (best_model.pkl / scaler.pkl /
label_encoder.pkl / feature_extractor.keras).

Face detection, cropping and normalisation live in face_crop.py, which is the
same module ml_scripts/focus/dataset_builder.py runs over the training videos
and images -- a webcam frame and a training frame go through identical code.

Models are loaded lazily on first use (not at import time) so importing
this module — e.g. at FastAPI startup — never crashes the whole app if a
model file happens to be missing, and never touches disk/TensorFlow until
a prediction is actually requested.
"""
import json
import threading

import numpy as np
import joblib
from pathlib import Path
from tensorflow.keras.models import load_model

from . import face_crop

BASE_DIR    = Path(__file__).resolve().parents[3]
MODELS_PATH = BASE_DIR / "trained-models" / "focus"

IMG_SIZE       = face_crop.IMG_SIZE
CLASSES        = ["Focused", "Fatigue", "Anxiety", "Boredom"]
CONF_THRESHOLD = 0.60
FATIGUE_THRESH = 0.80

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
            with open(MODELS_PATH / "model_report.json", "r") as f:
                report = json.load(f)
            _state["needs_scale"] = report["needs_scaling"]
            _state["best_algo"]   = report["best_algorithm"]
            _state["model"]     = joblib.load(MODELS_PATH / "best_model.pkl")
            _state["scaler"]    = joblib.load(MODELS_PATH / "scaler.pkl")
            _state["le"]        = joblib.load(MODELS_PATH / "label_encoder.pkl")
            _state["extractor"] = load_model(str(MODELS_PATH / "feature_extractor.keras"))
            face_crop.get_cascade()
        except Exception as exc:
            _state.clear()
            raise ModelNotReadyError(f"Focus models unavailable: {exc}") from exc
    return _state


def is_ready() -> bool:
    return bool(_state)


def detect_face(frame):
    """Face crop + box, via the shared detector the training set was built with."""
    _load()
    return face_crop.detect_face(frame)


def extract_features(face_img):
    """Face crop -> 1280-d MobileNetV2 embedding, using the same resize and
    normalisation face_crop applied to every training image."""
    st = _load()
    return st["extractor"].predict(face_crop.preprocess(face_img), verbose=0)[0]


def predict_state(features):
    st   = _load()
    feat = features.reshape(1, -1)
    if st["needs_scale"]:
        feat = st["scaler"].transform(feat)

    probs    = st["model"].predict_proba(feat)[0]
    pred_idx = np.argmax(probs)
    state    = st["le"].inverse_transform([pred_idx])[0]
    conf     = float(probs[pred_idx])

    if conf < CONF_THRESHOLD:
        state = "Focused"
    elif state == "Fatigue" and conf < FATIGUE_THRESH:
        sorted_idx = np.argsort(probs)[::-1]
        for idx in sorted_idx[1:]:
            alt = st["le"].inverse_transform([idx])[0]
            if alt != "Fatigue":
                state = alt
                break

    prob_map = {cls: float(probs[st["le"].transform([cls])[0]]) for cls in CLASSES}
    return state, prob_map


def predict_from_frame(frame_bgr):
    """
    Full pipeline: face crop -> features -> state.
    Returns dict with face_detected, state, confidence, probs.
    """
    face_crop, _ = detect_face(frame_bgr)
    if face_crop is None or face_crop.size == 0:
        return {"face_detected": False, "state": None, "confidence": 0.0, "probs": {}}

    features   = extract_features(face_crop)
    state, probs = predict_state(features)
    return {
        "face_detected": True,
        "state": state,
        "confidence": probs.get(state, 0.0),
        "probs": probs,
    }
