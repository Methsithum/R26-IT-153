
from __future__ import annotations

import json
import sys
from pathlib import Path

import cv2
import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

BACKEND_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BACKEND_ROOT))

from app.services.focus import face_crop, inference  # noqa: E402

EYE_ROOT = BACKEND_ROOT / "datasets" / "focusmonitor" / "eye"
CACHE_CSV = Path(__file__).resolve().parent / "cache" / "landmark_features.csv"
OUT_DIR = BACKEND_ROOT / "trained-models" / "focus"
CLASSES = ["Focused", "Fatigue", "Anxiety", "Boredom"]
SPLIT_MAP = {"train": "train", "valid": "val", "val": "val", "test": "test"}
SLEEPY_ON = inference.SLEEPY_ON
SLEEPY_OFF = inference.SLEEPY_OFF
SIZE = 48


def load_eye_split(split_dir: Path):
    X, y = [], []
    for label, name in (("awake", 0), ("sleepy", 1)):
        folder = split_dir / label
        if not folder.exists():
            continue
        for path in folder.glob("*.jpg"):
            img = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
            if img is None:
                continue
            img = cv2.resize(img, (SIZE, SIZE), interpolation=cv2.INTER_AREA)
            img = cv2.equalizeHist(img)
            X.append((img.astype(np.float32) / 255.0).ravel())
            y.append(name)
    return np.asarray(X, np.float32), np.asarray(y)


def sleepy_prob(model, face_bgr):
    left, right = face_crop.extract_eye_patches(face_bgr)
    vecs = []
    for patch in (left, right):
        v = face_crop.eye_vector(patch)
        if v is not None:
            vecs.append(v)
    if not vecs:
        return None
    proba = model.predict_proba(np.stack(vecs))
    sleepy_i = list(model.classes_).index(1) if 1 in list(model.classes_) else 1
    return float(np.mean(proba[:, sleepy_i]))


def fuse(state, probs, sleepy_p):
    if sleepy_p is None:
        return state
    if sleepy_p >= SLEEPY_ON:
        return "Fatigue"
    if state == "Fatigue" and sleepy_p <= SLEEPY_OFF:
        order = np.argsort(probs)[::-1]
        for idx in order:
            name = CLASSES[int(idx)]
            if name != "Fatigue":
                return name
    return state


def plot_cm(cm, path: Path):
    fig, axes = plt.subplots(1, 2, figsize=(12, 5))
    cmn = cm.astype(float)
    rs = cmn.sum(axis=1, keepdims=True)
    rs[rs == 0] = 1
    cmn = cmn / rs
    for ax, data, title, fmt in (
        (axes[0], cm, "Confusion matrix (raw counts)", "d"),
        (axes[1], cmn, "Confusion matrix (row-normalized)", ".1%"),
    ):
        im = ax.imshow(data, cmap="Blues")
        ax.set_xticks(range(4), CLASSES, rotation=30, ha="right")
        ax.set_yticks(range(4), CLASSES)
        ax.set_xlabel("Predicted label")
        ax.set_ylabel("True label")
        ax.set_title(title)
        vmax = data.max() or 1
        for i in range(4):
            for j in range(4):
                val = data[i, j]
                ax.text(
                    j, i, f"{int(val)}" if fmt == "d" else f"{val:.1%}",
                    ha="center", va="center",
                    color="white" if val > 0.55 * vmax else "black", fontsize=10,
                )
        fig.colorbar(im, ax=ax, fraction=0.046)
    fig.tight_layout()
    fig.savefig(path, dpi=140, bbox_inches="tight")
    plt.close(fig)


def main():
    Xtr, ytr = load_eye_split(EYE_ROOT / "train")
    Xva, yva = load_eye_split(EYE_ROOT / "valid")
    Xte, yte = load_eye_split(EYE_ROOT / "test")
    print(f"eye train {len(ytr)} val {len(yva)} test {len(yte)}")

    pipe = Pipeline([
        ("scaler", StandardScaler()),
        ("svm", SVC(C=10, gamma="scale", kernel="rbf", probability=True, random_state=42)),
    ])
    pipe.fit(Xtr, ytr)
    val_acc = accuracy_score(yva, pipe.predict(Xva)) if len(yva) else 0
    test_pred = pipe.predict(Xte) if len(yte) else np.array([])
    test_acc = accuracy_score(yte, test_pred) if len(yte) else 0
    print(f"eye-state val acc {val_acc:.3f}  test acc {test_acc:.3f}")
    if len(yte):
        print(classification_report(yte, test_pred, target_names=["awake", "sleepy"], digits=3))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipe, OUT_DIR / "eye_state_model.joblib")

    # Fused 4-class eval on the landmark test cache (same 341 faces as the panel matrix).
    df = pd.read_csv(CACHE_CSV)
    test = df[df["split"] == "test"].copy()
    drop = {"split", "label", "file"}
    cols = [c for c in test.columns if c not in drop]
    st = inference._load()
    scaler, model = st["scaler"], st["model"]
    X = scaler.transform(test[cols].to_numpy(np.float32))
    raw = model.predict_proba(X)
    idx = {int(c): i for i, c in enumerate(model.classes_)}
    proba = raw[:, [idx[i] for i in range(4)]]

    y_true, y_pred = [], []
    fused_n = 0
    for i, (_, row) in enumerate(test.iterrows()):
        probs = proba[i]
        state = inference._apply_thresholds(
            probs,
            st.get("thresholds") or inference.DEFAULT_THRESHOLDS,
            st.get("anxiety_margin", 0.0),
            st.get("boredom_margin", 0.0),
        )
        path = Path(str(row["file"]))
        img = cv2.imread(str(path)) if path.exists() else None
        sleepy_p = sleepy_prob(pipe, img) if img is not None else None
        if sleepy_p is not None:
            fused_n += 1
        # Offline face photos are not eye-crops: do not use EAR here (it
        # collapses Anxiety/Focused). Live webcam still uses EAR in inference.py.
        if sleepy_p is not None and sleepy_p >= inference.SLEEPY_ON:
            state = "Fatigue"
        y_true.append(row["label"])
        y_pred.append(state)

    y_true, y_pred = np.array(y_true), np.array(y_pred)
    print(f"fused eval n={len(y_true)} (eye signal on {fused_n})")
    print(classification_report(y_true, y_pred, labels=CLASSES, digits=3, zero_division=0))
    cm = confusion_matrix(y_true, y_pred, labels=CLASSES)
    plot_cm(cm, OUT_DIR / "confusion_matrix.png")

    report = classification_report(y_true, y_pred, labels=CLASSES, output_dict=True, zero_division=0)
    (OUT_DIR / "test_classification_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    (OUT_DIR / "test_classification_report.txt").write_text(
        classification_report(y_true, y_pred, labels=CLASSES, digits=3), encoding="utf-8"
    )

    summary_path = OUT_DIR / "results_summary.json"
    summary = json.loads(summary_path.read_text(encoding="utf-8")) if summary_path.exists() else {}
    summary["eye_state"] = {
        "model": "eye_state_model.joblib",
        "val_accuracy": float(val_acc),
        "test_accuracy": float(test_acc),
        "sleepy_on": float(inference.SLEEPY_ON),
        "sleepy_off": float(inference.SLEEPY_OFF),
        "ear_fatigue": float(inference.EAR_FATIGUE),
        "mapping": {"sleepy": "Fatigue", "low_ear": "Fatigue", "awake": "not Fatigue"},
    }
    thresh = {**(summary.get("class_thresholds") or {}), "Fatigue": 0.35}
    summary["class_thresholds"] = thresh
    summary["test_macro_f1"] = float(f1_score(y_true, y_pred, average="macro", labels=CLASSES))
    if "comparison" in summary:
        for row in summary["comparison"]:
            if row.get("model") == "SVM":
                row["test_accuracy"] = summary["test_accuracy"]
                row["test_macro_f1"] = summary["test_macro_f1"]
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print("Wrote", OUT_DIR / "confusion_matrix.png")


if __name__ == "__main__":
    main()
