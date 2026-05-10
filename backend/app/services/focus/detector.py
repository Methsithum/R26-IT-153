"""
STEP 3 - Real-time Focus Detection
====================================
File: backend/app/services/focus/detector.py
"""

import cv2
import numpy as np
import joblib
import json
import time
from pathlib import Path
from tensorflow.keras.models import load_model
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

# ══════════════════════════════════════════════════════
# PATHS
# ══════════════════════════════════════════════════════

BASE_DIR    = Path(__file__).resolve().parents[3]
MODELS_PATH = BASE_DIR / "trained-models" / "focus"

# ══════════════════════════════════════════════════════
# SETTINGS
# ══════════════════════════════════════════════════════

IMG_SIZE         = 224
CLASSES          = ["Focused", "Fatigue", "Anxiety", "Boredom"]
PREDICT_FPS      = 2
SMOOTH_N         = 10       # Stable predictions
CONF_THRESHOLD   = 0.60     # 60% below → Focused
FATIGUE_THRESH   = 0.80     # Fatigue accept කරන්නේ 80%+ confidence ලදිදී

STATE_COLORS = {
    "Focused": (0,   200,   0),
    "Fatigue": (0,   165, 255),
    "Anxiety": (0,     0, 255),
    "Boredom": (255, 165,   0),
}

STATE_LABEL = {
    "Focused": "FOCUSED",
    "Fatigue": "FATIGUE",
    "Anxiety": "ANXIETY",
    "Boredom": "BOREDOM",
}

# ══════════════════════════════════════════════════════
# ① LOAD MODELS
# ══════════════════════════════════════════════════════

print("=" * 55)
print("  Student Focus Monitor - Real-time Detection")
print("=" * 55)
print("\n  Loading models...")

with open(MODELS_PATH / "model_report.json", "r") as f:
    report = json.load(f)

best_algo   = report["best_algorithm"]
needs_scale = report["needs_scaling"]
print(f"  Best Algorithm : {best_algo}")
print(f"  Needs Scaling  : {needs_scale}")

model     = joblib.load(MODELS_PATH / "best_model.pkl")
scaler    = joblib.load(MODELS_PATH / "scaler.pkl")
le        = joblib.load(MODELS_PATH / "label_encoder.pkl")
extractor = load_model(str(MODELS_PATH / "feature_extractor.keras"))
print("  Models loaded OK")

# ══════════════════════════════════════════════════════
# ② OPENCV FACE DETECTOR
# ══════════════════════════════════════════════════════

print("  Loading face detector...")
face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)
print("  Face detector loaded OK")

# ══════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ══════════════════════════════════════════════════════

def detect_face(frame):
    """OpenCV face detection — largest face return කරනවා"""
    gray  = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(80, 80)
    )
    if len(faces) == 0:
        return None, None

    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
    pad        = int(min(w, h) * 0.15)
    fh, fw     = frame.shape[:2]
    x1 = max(0, x - pad)
    y1 = max(0, y - pad)
    x2 = min(fw, x + w + pad)
    y2 = min(fh, y + h + pad)

    return frame[y1:y2, x1:x2], (x1, y1, x2, y2)


def extract_features(face_img):
    """Face crop → MobileNetV2 1280-dim features"""
    img = cv2.cvtColor(face_img, cv2.COLOR_BGR2RGB)
    img = cv2.resize(img, (IMG_SIZE, IMG_SIZE))
    img = preprocess_input(img.astype(np.float32))
    img = np.expand_dims(img, axis=0)
    return extractor.predict(img, verbose=0)[0]


def predict_state(features):
    """
    Features → state + probabilities
    - Confidence 60% නැත්නම් → Focused
    - Fatigue 80% නැත්නම් → 2nd best state
    """
    feat = features.reshape(1, -1)
    if needs_scale:
        feat = scaler.transform(feat)

    probs    = model.predict_proba(feat)[0]
    pred_idx = np.argmax(probs)
    state    = le.inverse_transform([pred_idx])[0]
    conf     = probs[pred_idx]

    # Low confidence → Focused
    if conf < CONF_THRESHOLD:
        state = "Focused"
        return state, probs

    # Fatigue high threshold
    if state == "Fatigue" and conf < FATIGUE_THRESH:
        sorted_idx = np.argsort(probs)[::-1]
        for idx in sorted_idx[1:]:
            alt = le.inverse_transform([idx])[0]
            if alt != "Fatigue":
                state = alt
                break

    return state, probs


def draw_ui(frame, state, probs, face_box, fps, conf):
    """Results screen draw කරනවා"""
    h, w  = frame.shape[:2]
    color = STATE_COLORS.get(state, (255, 255, 255))

    # Face box
    if face_box:
        x1, y1, x2, y2 = face_box
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        cv2.putText(frame,
                    f"{STATE_LABEL.get(state, state)} {conf*100:.0f}%",
                    (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, color, 2)

    # Top bar
    cv2.rectangle(frame, (0, 0), (w, 65), (20, 20, 20), -1)
    cv2.putText(frame,
                f"Student Focus Monitor  |  FPS: {fps:.1f}",
                (12, 22), cv2.FONT_HERSHEY_SIMPLEX,
                0.6, (160, 160, 160), 1)
    cv2.putText(frame,
                f"State: {STATE_LABEL.get(state, state)}",
                (12, 55), cv2.FONT_HERSHEY_SIMPLEX,
                1.0, color, 2)

    # Probability bars
    bar_w = 160
    bar_h = 18
    sx    = 12
    sy    = h - len(CLASSES) * (bar_h + 10) - 15

    cv2.rectangle(frame, (0, sy - 8),
                  (sx + bar_w + 100, h), (20, 20, 20), -1)

    for i, cls in enumerate(CLASSES):
        try:
            idx  = le.transform([cls])[0]
            prob = float(probs[idx])
        except Exception:
            prob = 0.0

        y   = sy + i * (bar_h + 10)
        bw  = int(prob * bar_w)
        clr = STATE_COLORS.get(cls, (180, 180, 180))

        cv2.rectangle(frame, (sx, y),
                      (sx + bar_w, y + bar_h), (50, 50, 50), -1)
        if bw > 0:
            cv2.rectangle(frame, (sx, y),
                          (sx + bw, y + bar_h), clr, -1)
        cv2.putText(frame,
                    f"{cls}: {prob*100:.0f}%",
                    (sx + bar_w + 8, y + 14),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5,
                    clr if cls == state else (120, 120, 120),
                    2 if cls == state else 1)

    cv2.putText(frame, "Press Q to quit",
                (w - 160, h - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (80, 80, 80), 1)

    return frame


# ══════════════════════════════════════════════════════
# ③ MAIN DETECTION LOOP
# ══════════════════════════════════════════════════════

print("\n  Opening webcam... (Q to quit)")
print("=" * 55)

cap = cv2.VideoCapture(0)
cap.set(cv2.CAP_PROP_FRAME_WIDTH,  1280)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

if not cap.isOpened():
    print("  Webcam open error!")
    exit()

prediction_history = []
current_state      = "Focused"
current_probs      = np.zeros(len(CLASSES))
current_conf       = 0.0
last_predict_time  = 0
face_box           = None
fps_history        = []
prev_time          = time.time()

print("  Detection started!")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    frame = cv2.flip(frame, 1)
    now   = time.time()

    fps_history.append(1.0 / max(now - prev_time, 0.001))
    if len(fps_history) > 30:
        fps_history.pop(0)
    fps       = np.mean(fps_history)
    prev_time = now

    if now - last_predict_time >= 1.0 / PREDICT_FPS:
        face_crop, face_box = detect_face(frame)

        if face_crop is not None and face_crop.size > 0:
            try:
                features      = extract_features(face_crop)
                state, probs  = predict_state(features)

                prediction_history.append(state)
                if len(prediction_history) > SMOOTH_N:
                    prediction_history.pop(0)

                current_state = max(
                    set(prediction_history),
                    key=prediction_history.count
                )
                current_probs = probs

                try:
                    idx          = le.transform([current_state])[0]
                    current_conf = float(probs[idx])
                except Exception:
                    current_conf = 0.0

            except Exception as e:
                print(f"  Predict error: {e}")

        last_predict_time = now

    frame = draw_ui(frame, current_state, current_probs,
                    face_box, fps, current_conf)
    cv2.imshow("Student Focus Monitor", frame)

    key = cv2.waitKey(1) & 0xFF
    if key == ord("q") or key == 27:
        break

cap.release()
cv2.destroyAllWindows()
print("\n  Detection stopped.")