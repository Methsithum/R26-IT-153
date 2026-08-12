"""
Focus-state inference service, backed by the models trained in
ml_scripts/focus/train_model.py (best_model.pkl / scaler.pkl /
label_encoder.pkl / feature_extractor.keras).

Models are loaded lazily on first use (not at import time) so importing
this module — e.g. at FastAPI startup — never crashes the whole app if a
model file happens to be missing, and never touches disk/TensorFlow until
a prediction is actually requested.
"""
import json
import threading

import cv2
import numpy as np
import joblib
from pathlib import Path
from tensorflow.keras.models import load_model
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

BASE_DIR    = Path(__file__).resolve().parents[3]
MODELS_PATH = BASE_DIR / "trained-models" / "focus"

IMG_SIZE       = 224
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
            _state["face_cascade"] = cv2.CascadeClassifier(
                cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            )
        except Exception as exc:
            _state.clear()
            raise ModelNotReadyError(f"Focus models unavailable: {exc}") from exc
    return _state


def is_ready() -> bool:
    return bool(_state)


def detect_face(frame):
    st = _load()
    gray  = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = st["face_cascade"].detectMultiScale(
        gray, scaleFactor=1.1, minNeighbors=5, minSize=(80, 80)
    )
    if len(faces) == 0:
        return None, None

    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
    pad    = int(min(w, h) * 0.15)
    fh, fw = frame.shape[:2]
    x1 = max(0, x - pad)
    y1 = max(0, y - pad)
    x2 = min(fw, x + w + pad)
    y2 = min(fh, y + h + pad)
    return frame[y1:y2, x1:x2], (x1, y1, x2, y2)


def extract_features(face_img):
    st  = _load()
    img = cv2.cvtColor(face_img, cv2.COLOR_BGR2RGB)
    img = cv2.resize(img, (IMG_SIZE, IMG_SIZE))
    img = preprocess_input(img.astype(np.float32))
    img = np.expand_dims(img, axis=0)
    return st["extractor"].predict(img, verbose=0)[0]


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
