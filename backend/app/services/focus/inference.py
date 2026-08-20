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
import os
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

# Temporary diagnostic, off unless FOCUS_DEBUG_PROBS is set. Dumps the raw
# predict_proba vector *before* the threshold rules below touch anything, so the
# model's actual opinion can be compared against what the API ends up serving.
#   FOCUS_DEBUG_PROBS=1        full block per prediction
#   FOCUS_DEBUG_PROBS=compact  one line per prediction (readable for live webcam)
DEBUG_PROBS = os.getenv("FOCUS_DEBUG_PROBS", "").strip().lower()


def _debug_probs(st, probs, raw_state, raw_conf, served_state, rule):
    """Print the untouched probability vector. Never mutates anything."""
    le  = st["le"]
    # Column order is the model's own, not the display order in CLASSES -- printing
    # it this way is what proves the vector is being indexed correctly.
    cols = [(int(i), str(le.inverse_transform([c])[0]), float(probs[i]))
            for i, c in enumerate(st["model"].classes_)]

    if DEBUG_PROBS == "compact":
        line = " | ".join(f"{name}: {p*100:.1f}%" for _, name, p in cols)
        served = "" if served_state == raw_state else f"  ->served {served_state} [{rule}]"
        print(f"[focus] {line}  raw={raw_state}{served}", flush=True)
        return

    print("\nPrediction:", flush=True)
    for i, name, p in cols:
        print(f"  [col {i}] {name:<8} {p:.4f} ({p*100:.1f}%)", flush=True)
    print(f"\n  Raw predicted class: {raw_state} ({raw_conf*100:.1f}%)", flush=True)
    print(f"  Total probability:   {float(probs.sum()):.3f}", flush=True)
    if served_state == raw_state:
        print("  Served class:        %s (post-processing left it unchanged)" % served_state, flush=True)
    else:
        print(f"  Served class:        {served_state}  <-- CHANGED by {rule}", flush=True)

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

    probs    = st["model"].predict_proba(feat)[0]   # <-- the only predict_proba call in the serving path
    pred_idx = np.argmax(probs)
    state    = st["le"].inverse_transform([pred_idx])[0]
    conf     = float(probs[pred_idx])

    # Captured before the rules below run; `state` is rewritten in place by them.
    raw_state, raw_conf, rule = state, conf, None

    # ---- post-processing (unchanged; the debug dump above is taken before this) ----
    if conf < CONF_THRESHOLD:
        state = "Focused"
        rule  = f"CONF_THRESHOLD ({conf:.3f} < {CONF_THRESHOLD})"
    elif state == "Fatigue" and conf < FATIGUE_THRESH:
        sorted_idx = np.argsort(probs)[::-1]
        for idx in sorted_idx[1:]:
            alt = st["le"].inverse_transform([idx])[0]
            if alt != "Fatigue":
                state = alt
                rule  = f"FATIGUE_THRESH ({conf:.3f} < {FATIGUE_THRESH})"
                break
    # -------------------------------------------------------------------------------

    prob_map = {cls: float(probs[st["le"].transform([cls])[0]]) for cls in CLASSES}

    if DEBUG_PROBS:
        _debug_probs(st, probs, raw_state, raw_conf, state, rule)

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
