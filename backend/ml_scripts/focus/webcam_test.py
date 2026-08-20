"""
Live webcam test for the focus models.

Runs the *deployed* pipeline — it imports app/services/focus/inference.py rather
than re-implementing it, so what you see here is what the backend would return —
and adds the stage-2 eye model (awake / sleepy) on the upper band of the face
crop, which inference.py does not wire up yet.

One deliberate difference from the backend: the label shown is the argmax of the
probabilities pooled over the last `--smooth` frames (3, as in the notebook), not
inference.predict_state()'s single-frame label with its confidence fallbacks. Use
`--smooth 1` to see the raw per-frame behaviour.

    python backend/ml_scripts/focus/webcam_test.py            # default camera
    python backend/ml_scripts/focus/webcam_test.py --camera 1
    python backend/ml_scripts/focus/webcam_test.py --no-eye --smooth 1
    python backend/ml_scripts/focus/webcam_test.py --models backend/trained-models/focus_v2

Keys:  q / Esc quit   s save a snapshot   r reset the smoothing buffer
"""
import argparse
import csv
import json
import sys
import time
from collections import Counter, deque
from pathlib import Path

import cv2
import joblib
import numpy as np

BASE_DIR    = Path(__file__).resolve().parents[2]          # -> backend/
MODELS_PATH = BASE_DIR / "trained-models" / "focus"
sys.path.insert(0, str(BASE_DIR))

from tensorflow.keras.applications.mobilenet_v2 import preprocess_input  # noqa: E402
from app.services.focus import inference                                  # noqa: E402

IMG_SIZE = 224
CLASSES  = inference.CLASSES

STATE_COLORS_BGR = {
    "Focused": (0, 200, 0),
    "Fatigue": (0, 165, 255),
    "Anxiety": (0, 0, 255),
    "Boredom": (255, 165, 0),
}


# ── stage 2: eye model ────────────────────────────────────────────────────────

def load_eye_model():
    """-> dict or None if the stage-2 artifacts are not on disk."""
    try:
        with open(MODELS_PATH / "eye_model_report.json") as f:
            report = json.load(f)
        return {
            "model":  joblib.load(MODELS_PATH / "eye_model.pkl"),
            "scaler": joblib.load(MODELS_PATH / "eye_scaler.pkl"),
            "le":     joblib.load(MODELS_PATH / "eye_label_encoder.pkl"),
            "scale":  report["needs_scaling"],
            "algo":   report["best_algorithm"],
        }
    except Exception as exc:
        print(f"  eye model unavailable ({exc}) — running stage 1 only")
        return None


def p_sleepy(eye, face_crop):
    """Probability the eye band reads as 'sleepy'. Band = upper-middle of the face."""
    h = face_crop.shape[0]
    band = face_crop[int(h * 0.20):int(h * 0.50), :]
    if band.size == 0:
        return None

    img  = cv2.cvtColor(band, cv2.COLOR_BGR2RGB)
    img  = preprocess_input(cv2.resize(img, (IMG_SIZE, IMG_SIZE)).astype(np.float32))
    feat = inference._load()["extractor"].predict(img[None], verbose=0)
    if eye["scale"]:
        feat = eye["scaler"].transform(feat)
    return float(eye["model"].predict_proba(feat)[0][eye["le"].transform(["sleepy"])[0]])


# ── overlay ───────────────────────────────────────────────────────────────────

def draw(frame, box, state, probs, sleepy, fps, smooth_n):
    if box is not None:
        x1, y1, x2, y2 = box
        colour = STATE_COLORS_BGR.get(state, (200, 200, 200))
        cv2.rectangle(frame, (x1, y1), (x2, y2), colour, 2)
        cv2.putText(frame, f"{state} {probs.get(state, 0):.0%}", (x1, max(24, y1 - 10)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, colour, 2)
    else:
        cv2.putText(frame, "no face", (14, 34),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

    # probability bars
    y = frame.shape[0] - 20 - len(CLASSES) * 24
    for cls in CLASSES:
        p = probs.get(cls, 0.0)
        colour = STATE_COLORS_BGR[cls]
        cv2.putText(frame, f"{cls:<8}", (14, y + 14),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (240, 240, 240), 1)
        cv2.rectangle(frame, (105, y + 2), (105 + int(180 * p), y + 16), colour, -1)
        cv2.rectangle(frame, (105, y + 2), (285, y + 16), (90, 90, 90), 1)
        cv2.putText(frame, f"{p:.2f}", (295, y + 14),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (240, 240, 240), 1)
        y += 24

    hud = f"{fps:.1f} fps | pooled over {smooth_n} frames"
    if sleepy is not None:
        hud += f" | eyes: {'SLEEPY' if sleepy > 0.5 else 'awake'} {sleepy:.2f}"
    cv2.putText(frame, hud, (14, frame.shape[0] - 8),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)
    cv2.putText(frame, "q quit   s snapshot   r reset", (frame.shape[1] - 250, 24),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (170, 170, 170), 1)
    return frame


# ── main loop ─────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="Live webcam test for the focus models")
    ap.add_argument("--camera", type=int, default=0, help="camera index (default 0)")
    ap.add_argument("--smooth", type=int, default=3,
                    help="frames to average probabilities over (notebook uses 3)")
    ap.add_argument("--every", type=int, default=2,
                    help="run the model on every Nth frame (default 2)")
    ap.add_argument("--no-eye", action="store_true", help="skip the stage-2 eye model")
    ap.add_argument("--models", default=None,
                    help="model dir to test (default trained-models/focus, the one the "
                         "backend serves; pass focus_v2 to try a candidate first)")
    ap.add_argument("--log", default=None,
                    help="write per-frame predictions to this CSV, and print a class "
                         "tally on exit -- turns 'Boredom never fires' into a number")
    ap.add_argument("--mirror", action="store_true", default=True,
                    help="mirror the preview (default on)")
    args = ap.parse_args()

    if args.models:
        # inference.py resolves MODELS_PATH at import; pointing both it and the
        # stage-2 loader at another dir is what lets a candidate model be tried
        # on a live webcam before it is promoted over the serving one.
        global MODELS_PATH
        MODELS_PATH = Path(args.models)
        inference.MODELS_PATH = MODELS_PATH
        print(f"  models : {MODELS_PATH}")

    print("  loading models (first load pulls in TensorFlow, give it a moment)...")
    st = inference._load()
    print(f"  stage 1: {st['best_algo']}  scaling={st['needs_scale']}")
    eye = None if args.no_eye else load_eye_model()
    if eye:
        print(f"  stage 2: {eye['algo']} (eye awake/sleepy)")

    cap = cv2.VideoCapture(args.camera, cv2.CAP_DSHOW)
    if not cap.isOpened():
        print(f"  cannot open camera {args.camera} — try --camera 1")
        return 1
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    shots  = Path(__file__).parent / "webcam_shots"
    window = "Focus monitor - webcam test"
    buf    = deque(maxlen=max(1, args.smooth))
    state, probs, sleepy, box = None, {}, None, None
    fps, last, i = 0.0, time.time(), 0
    t_start = time.time()

    # A live session is an impression unless it is written down: "Boredom never
    # fires" and "Boredom fires rarely" look the same from behind the camera.
    log_f = log_w = None
    tally = Counter()
    if args.log:
        log_f = open(args.log, "w", newline="", encoding="utf-8")
        log_w = csv.writer(log_f)
        log_w.writerow(["t", "state", *CLASSES, "p_sleepy"])
        print(f"  logging predictions to {args.log}")

    print("  running. press q to quit.\n")
    while True:
        ok, frame = cap.read()
        if not ok:
            print("  camera read failed")
            break
        if args.mirror:
            frame = cv2.flip(frame, 1)

        if i % max(1, args.every) == 0:
            face, box = inference.detect_face(frame)
            if face is not None and face.size:
                _, p = inference.predict_state(inference.extract_features(face))
                buf.append([p[c] for c in CLASSES])
                mean  = np.mean(buf, axis=0)
                probs = dict(zip(CLASSES, mean.tolist()))
                state = CLASSES[int(np.argmax(mean))]
                sleepy = p_sleepy(eye, face) if eye else None
                tally[state] += 1
                if log_w:
                    log_w.writerow([f"{time.time()-t_start:.2f}", state]
                                   + [f"{probs[c]:.4f}" for c in CLASSES]
                                   + ["" if sleepy is None else f"{sleepy:.4f}"])
            else:
                tally["no face"] += 1
                buf.clear()
                state, probs, sleepy, box = None, {}, None, None

        now = time.time()
        fps = 0.9 * fps + 0.1 / max(now - last, 1e-6)
        last = now
        i += 1

        cv2.imshow(window, draw(frame, box, state, probs, sleepy, fps, len(buf)))
        key = cv2.waitKey(1) & 0xFF
        if key in (ord("q"), 27):
            break
        if key == ord("r"):
            buf.clear()
        if key == ord("s"):
            shots.mkdir(exist_ok=True)
            path = shots / f"shot_{int(time.time())}.jpg"
            cv2.imwrite(str(path), frame)
            print(f"  saved {path}")

    cap.release()
    cv2.destroyAllWindows()
    if log_f:
        log_f.close()

    scored = sum(v for k, v in tally.items() if k != "no face")
    if scored:
        print(f"\n  {scored} scored frames over {time.time()-t_start:.0f}s"
              + (f", {tally['no face']} with no face" if tally["no face"] else ""))
        for cls in CLASSES:
            n = tally[cls]
            bar = "#" * int(30 * n / scored)
            print(f"   {cls:<8}{n:>6}  {100*n/scored:5.1f}%  {bar}")
        missing = [c for c in CLASSES if not tally[c]]
        if missing:
            print(f"   never predicted: {', '.join(missing)}")
    elif tally["no face"]:
        print(f"\n  no face detected in any of {tally['no face']} frames -- "
              "check the camera is showing your whole face, chin included")
    return 0


if __name__ == "__main__":
    sys.exit(main())
