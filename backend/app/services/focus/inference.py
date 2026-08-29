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
DEFAULT_THRESHOLDS = {"Focused": 0.0, "Fatigue": 0.35, "Anxiety": 0.24, "Boredom": 0.32}
SLEEPY_ON = 0.48
SLEEPY_OFF = 0.22
EAR_FATIGUE = 0.13
ANXIETY_MARGIN = 0.34
BOREDOM_MARGIN = 0.0
FOCUSED_RECLAIM = 0.70

_lock  = threading.Lock()
_state = {}
_loaded_mtime = None


class ModelNotReadyError(RuntimeError):
    pass


def _model_mtime():
    times = []
    for name in ("focus_classical_model.joblib", "eye_state_model.joblib", "focus_vs_rest.joblib"):
        path = MODELS_PATH / name
        if path.exists():
            times.append(path.stat().st_mtime)
    return max(times) if times else 0


def _load():
    global _loaded_mtime
    mtime = _model_mtime()
    if _state and _loaded_mtime == mtime:
        return _state
    with _lock:
        if _state and _loaded_mtime == mtime:
            return _state
        _state.clear()
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

            _state["thresholds"] = {**DEFAULT_THRESHOLDS, **(summary.get("class_thresholds") or {})}
            _state["still_face"] = bool(summary.get("still_face_boredom_veto"))
            _state["anxiety_margin"] = float(summary.get("anxiety_margin", ANXIETY_MARGIN))
            _state["boredom_margin"] = float(summary.get("boredom_margin", BOREDOM_MARGIN))
            reclaim_path = MODELS_PATH / "focus_vs_rest.joblib"
            _state["reclaim_model"] = joblib.load(reclaim_path) if reclaim_path.exists() else None
            _state["reclaim_threshold"] = float(summary.get("focused_reclaim_threshold", FOCUSED_RECLAIM))
            eye_path = MODELS_PATH / "eye_state_model.joblib"
            _state["eye_model"] = joblib.load(eye_path) if eye_path.exists() else None
            _state["sleepy_on"] = float((summary.get("eye_state") or {}).get("sleepy_on", SLEEPY_ON))
            _state["sleepy_off"] = float((summary.get("eye_state") or {}).get("sleepy_off", SLEEPY_OFF))
            _state["ear_fatigue"] = float((summary.get("eye_state") or {}).get("ear_fatigue", EAR_FATIGUE))
            face_crop.get_landmarker()
            _loaded_mtime = mtime
        except Exception as exc:
            _state.clear()
            raise ModelNotReadyError(f"Focus model unavailable: {exc}") from exc
    return _state


def is_ready() -> bool:
    return bool(_state)


def _predict_classical(st, features: dict):
    vec = np.array([[features.get(c, 0.0) for c in st["columns"]]])
    vec = st["scaler"].transform(vec)
    raw = st["model"].predict_proba(vec)[0]
    idx = {int(c): i for i, c in enumerate(st["model"].classes_)}
    return np.array([raw[idx[i]] for i in range(len(CLASSES))], dtype=float)


def _apply_thresholds(probs, thresholds, foc_margin=0.0, bor_margin=0.0):
    """Lift Anxiety and Boredom from Focused. Do not swap them into each other."""
    order = np.argsort(probs)[::-1]
    chosen = "Focused"
    for idx in order:
        name = CLASSES[int(idx)]
        if name == "Focused" or float(probs[idx]) >= float(thresholds.get(name, 0.0)):
            chosen = name
            break
    anx_i, foc_i, bor_i = CLASSES.index("Anxiety"), CLASSES.index("Focused"), CLASSES.index("Boredom")
    ta = float(thresholds.get("Anxiety", 0.28))
    tb = float(thresholds.get("Boredom", 0.35))
    p_anx, p_foc, p_bor = float(probs[anx_i]), float(probs[foc_i]), float(probs[bor_i])
    margin = float(foc_margin)
    if chosen == "Focused":
        if p_anx >= p_bor and p_anx >= ta and p_anx + margin >= p_foc:
            chosen = "Anxiety"
        elif p_bor >= tb and p_bor + margin >= p_foc:
            chosen = "Boredom"
    return chosen


def _reclaim_focused(st, features, state):
    """High-precision Focused-vs-rest gate. Does not touch Fatigue, and only
    overrides Anxiety/Boredom when the binary model is very sure."""
    model = st.get("reclaim_model")
    if model is None or state not in ("Anxiety", "Boredom") or not features:
        return state
    vec = np.array([[features.get(c, 0.0) for c in st["columns"]]])
    vec = st["scaler"].transform(vec)
    score = float(model.predict_proba(vec)[0, 1])
    if score >= float(st.get("reclaim_threshold", FOCUSED_RECLAIM)):
        return "Focused"
    return state


def _gaze_offset(features: dict) -> float:
    return (
        abs(float(features.get("gaze_x_left") or 0))
        + abs(float(features.get("gaze_x_right") or 0))
        + abs(float(features.get("gaze_y_left") or 0))
        + abs(float(features.get("gaze_y_right") or 0))
    )


def _looking_at_camera(features: dict) -> bool:
    """Face toward the webcam/screen — not turned away."""
    if not features:
        return False
    mar = float(features.get("mar") or 0)
    yaw = abs(float(features.get("head_yaw") or 0))
    pitch = abs(float(features.get("head_pitch") or 0))
    return mar <= 0.40 and _gaze_offset(features) <= 0.50 and yaw <= 16 and pitch <= 28


def _bored_pose(features: dict) -> bool:
    """Clear disengagement: head turned, gaze off-camera, or chin-down.

    A blank stare locked on the webcam looks like Focused and must not
    count as Boredom. Hold this pose for a couple of seconds.
    """
    if not features:
        return False
    ear = float(features.get("ear_avg") or 0)
    if ear <= EAR_FATIGUE:
        return False
    yaw = abs(float(features.get("head_yaw") or 0))
    pitch = abs(float(features.get("head_pitch") or 0))
    gaze = _gaze_offset(features)
    return yaw >= 18 or gaze >= 0.55 or pitch >= 30


def _bs(features: dict, name: str) -> float:
    return float(features.get(f"bs_{name}") or 0)


def _anxious_pose(features: dict) -> bool:
    """Worry / tension: inner brows up or knitted, frown, or wide eyes.

    Face can still be toward the camera — unlike Boredom this is an
    expression, not a head-turn.
    """
    if not features:
        return False
    if float(features.get("ear_avg") or 0) <= EAR_FATIGUE:
        return False
    brow_inner = _bs(features, "browInnerUp")
    brow_down = max(_bs(features, "browDownLeft"), _bs(features, "browDownRight"))
    frown = max(_bs(features, "mouthFrownLeft"), _bs(features, "mouthFrownRight"))
    wide = max(_bs(features, "eyeWideLeft"), _bs(features, "eyeWideRight"))
    stretch = max(_bs(features, "mouthStretchLeft"), _bs(features, "mouthStretchRight"))
    return (
        brow_inner >= 0.22
        or brow_down >= 0.18
        or (frown >= 0.18 and brow_inner >= 0.10)
        or wide >= 0.22
        or (stretch >= 0.20 and frown >= 0.10)
    )


def _still_face_boredom_veto(features: dict) -> bool:
    return _looking_at_camera(features) and float(features.get("mar") or 0) <= 0.18


def _sleepy_prob(st, face_bgr):
    model = st.get("eye_model")
    if model is None:
        return None
    left, right = face_crop.extract_eye_patches(face_bgr)
    vecs = []
    for patch in (left, right):
        vec = face_crop.eye_vector(patch)
        if vec is not None:
            vecs.append(vec)
    if not vecs:
        return None
    proba = model.predict_proba(np.stack(vecs))
    classes = list(model.classes_)
    sleepy_i = classes.index(1) if 1 in classes else len(classes) - 1
    return float(np.mean(proba[:, sleepy_i]))


def apply_live_cues(state, probs, features=None, sleepy_p=None, sleepy_on=SLEEPY_ON, sleepy_off=SLEEPY_OFF, ear_fatigue=EAR_FATIGUE):
    """Live webcam poses:
    - eyes closed → Fatigue
    - worried brows / frown (even facing the camera) → Anxiety
    - face toward camera, relaxed → Focused
    - head turned / gaze off / chin down → Boredom
    """
    ear = float((features or {}).get("ear_avg") or 99.0)
    looking = _looking_at_camera(features or {})
    bored = _bored_pose(features or {})
    anxious = _anxious_pose(features or {})
    if sleepy_p is not None:
        eyes_closed = ear <= ear_fatigue and sleepy_p >= sleepy_on
    else:
        eyes_closed = ear <= min(ear_fatigue, 0.10)
    if eyes_closed:
        return "Fatigue"
    if anxious:
        return "Anxiety"
    if looking:
        return "Focused"
    if bored:
        return "Boredom"
    if sleepy_p is not None and sleepy_p >= sleepy_on:
        return "Fatigue"
    if state == "Fatigue" and ear >= 0.22 and (sleepy_p is None or sleepy_p <= sleepy_off):
        order = np.argsort(probs)[::-1]
        for idx in order:
            name = CLASSES[int(idx)]
            if name != "Fatigue":
                return name
    return state


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

    features = None
    if st["kind"] == "cnn":
        probs = _predict_cnn(st, face)
    else:
        features = face_crop.extract_features(face)
        if features is None:
            return {"face_detected": False, "state": None, "confidence": 0.0, "probs": {}}
        probs = _predict_classical(st, features)

    state = _apply_thresholds(
        probs,
        st.get("thresholds") or DEFAULT_THRESHOLDS,
        st.get("anxiety_margin", ANXIETY_MARGIN),
        st.get("boredom_margin", BOREDOM_MARGIN),
    )
    state = _reclaim_focused(st, features, state)
    if state not in ("Anxiety", "Boredom", "Fatigue") and float(probs[CLASSES.index(state)]) < CONF_THRESHOLD:
        state = "Focused"
    sleepy_p = _sleepy_prob(st, face)
    state = apply_live_cues(
        state, probs, features, sleepy_p,
        st.get("sleepy_on", SLEEPY_ON),
        st.get("sleepy_off", SLEEPY_OFF),
        st.get("ear_fatigue", EAR_FATIGUE),
    )
    if (
        st.get("still_face")
        and state == "Boredom"
        and features
        and _still_face_boredom_veto(features)
    ):
        state = "Focused"

    prob_map = {cls: float(p) for cls, p in zip(CLASSES, probs)}
    if state == "Focused" and _looking_at_camera(features or {}):
        prob_map["Focused"] = max(prob_map["Focused"], 0.72)
        for other in ("Fatigue", "Anxiety", "Boredom"):
            if prob_map[other] >= prob_map["Focused"]:
                prob_map[other] = max(prob_map["Focused"] - 0.10, 0.0)
    elif state == "Anxiety" and _anxious_pose(features or {}):
        prob_map["Anxiety"] = max(prob_map["Anxiety"], 0.72)
        for other in ("Focused", "Fatigue", "Boredom"):
            if prob_map[other] >= prob_map["Anxiety"]:
                prob_map[other] = max(prob_map["Anxiety"] - 0.10, 0.0)
    elif state == "Boredom" and _bored_pose(features or {}):
        prob_map["Boredom"] = max(prob_map["Boredom"], 0.72)
        for other in ("Focused", "Fatigue", "Anxiety"):
            if prob_map[other] >= prob_map["Boredom"]:
                prob_map[other] = max(prob_map["Boredom"] - 0.10, 0.0)
    elif state == "Fatigue":
        extra = 0.0
        ear = float((features or {}).get("ear_avg") or 99.0)
        if ear <= EAR_FATIGUE and (sleepy_p is None or sleepy_p >= SLEEPY_ON):
            extra = 0.72
        elif sleepy_p is not None:
            extra = sleepy_p
        if extra:
            prob_map["Fatigue"] = max(prob_map["Fatigue"], extra, 0.60)
    return {
        "face_detected": True,
        "state": state,
        "confidence": prob_map[state],
        "probs": prob_map,
    }
