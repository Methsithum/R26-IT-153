import cv2
import numpy as np
import joblib
import json
import random
from pathlib import Path
from tensorflow.keras.models import load_model
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
from sklearn.metrics import classification_report, confusion_matrix
import seaborn as sns
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

BASE_DIR     = Path(__file__).resolve().parents[2]
MODELS_PATH  = BASE_DIR / "trained-models" / "focus"
DATASET_PATH = BASE_DIR / "datasets" / "focus" / "Final_dataset_clean" / "test"


IMG_SIZE       = 224
CLASSES        = ["Focused", "Fatigue", "Anxiety", "Boredom"]
CONF_THRESHOLD = 0.60
FATIGUE_THRESH = 0.80
SAMPLE_PER_CLASS = 50    # Class test images (None = all)

STATE_COLORS_BGR = {
    "Focused": (0,   200,   0),
    "Fatigue": (0,   165, 255),
    "Anxiety": (0,     0, 255),
    "Boredom": (255, 165,   0),
}

# ══════════════════════════════════════════════════════
# ① LOAD MODELS
# ══════════════════════════════════════════════════════

print("=" * 55)
print("  Student Focus Monitor — Test Evaluation")
print("=" * 55)
print("\n  Loading models...")

with open(MODELS_PATH / "model_report.json", "r") as f:
    report = json.load(f)

needs_scale = report["needs_scaling"]
best_algo   = report["best_algorithm"]
print(f"  Algorithm : {best_algo}")

model     = joblib.load(MODELS_PATH / "best_model.pkl")
scaler    = joblib.load(MODELS_PATH / "scaler.pkl")
le        = joblib.load(MODELS_PATH / "label_encoder.pkl")
extractor = load_model(str(MODELS_PATH / "feature_extractor.keras"))
print("  Models loaded OK\n")

# ══════════════════════════════════════════════════════
# ② LOAD TEST IMAGES
# ══════════════════════════════════════════════════════

print("  Loading test images...")
test_images, test_labels = [], []

for cls in CLASSES:
    cls_path = DATASET_PATH / cls
    if not cls_path.is_dir():
        print(f"  Missing: {cls_path}")
        continue

    imgs = list(cls_path.rglob("*"))
    imgs = [p for p in imgs
            if p.suffix.lower() in (".jpg", ".jpeg", ".png", ".bmp")]

    if SAMPLE_PER_CLASS and len(imgs) > SAMPLE_PER_CLASS:
        imgs = random.sample(imgs, SAMPLE_PER_CLASS)

    test_images.extend(imgs)
    test_labels.extend([cls] * len(imgs))
    print(f"  {cls}: {len(imgs)} images")

print(f"\n  Total test images: {len(test_images)}")

# ══════════════════════════════════════════════════════
# ③ PREDICT
# ══════════════════════════════════════════════════════

def predict_image(img_path):
    img = cv2.imread(str(img_path))
    if img is None:
        return None, None

    rgb  = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    resized = cv2.resize(rgb, (IMG_SIZE, IMG_SIZE))
    pre  = preprocess_input(resized.astype(np.float32))
    feat = extractor.predict(np.expand_dims(pre, 0), verbose=0)[0]

    f = feat.reshape(1, -1)
    if needs_scale:
        f = scaler.transform(f)

    probs    = model.predict_proba(f)[0]
    pred_idx = np.argmax(probs)
    state    = le.inverse_transform([pred_idx])[0]
    conf     = probs[pred_idx]

    # Confidence threshold
    if conf < CONF_THRESHOLD:
        state = "Focused"
    elif state == "Fatigue" and conf < FATIGUE_THRESH:
        sorted_idx = np.argsort(probs)[::-1]
        for idx in sorted_idx[1:]:
            alt = le.inverse_transform([idx])[0]
            if alt != "Fatigue":
                state = alt
                break

    return state, probs


print("\n  Predicting...")
y_true, y_pred, all_probs, all_paths = [], [], [], []

for i, (img_path, true_label) in enumerate(zip(test_images, test_labels)):
    pred, probs = predict_image(img_path)
    if pred is None:
        continue
    y_true.append(true_label)
    y_pred.append(pred)
    all_probs.append(probs)
    all_paths.append(img_path)

    if (i + 1) % 50 == 0:
        print(f"  {i+1}/{len(test_images)}", end="\r")

print(f"  {len(y_true)}/{len(test_images)} done     ")

# ══════════════════════════════════════════════════════
# ④ RESULTS REPORT
# ══════════════════════════════════════════════════════

print("\n" + "=" * 55)
print("  RESULTS")
print("=" * 55)

overall = sum(t == p for t, p in zip(y_true, y_pred)) / len(y_true)
print(f"\n  Overall Accuracy: {overall*100:.2f}%\n")

print("  Per-Class Accuracy:")
print(f"  {'Class':<12} {'Correct':>8} {'Total':>8} {'Accuracy':>10}")
print("  " + "-" * 42)

for cls in CLASSES:
    cls_true  = [t for t, p in zip(y_true, y_true) if t == cls]
    cls_correct = [1 for t, p in zip(y_true, y_pred) if t == cls and t == p]
    total   = len(cls_true)
    correct = len(cls_correct)
    acc     = correct / total * 100 if total > 0 else 0
    print(f"  {cls:<12} {correct:>8} {total:>8} {acc:>9.1f}%")

print("\n  Classification Report:")
print(classification_report(y_true, y_pred, target_names=CLASSES))

# ══════════════════════════════════════════════════════
# SAVE GRAPHS
# ══════════════════════════════════════════════════════

le_enc = {cls: i for i, cls in enumerate(CLASSES)}
y_true_enc = [le_enc[t] for t in y_true]
y_pred_enc = [le_enc[p] for p in y_pred]

cm  = confusion_matrix(y_true_enc, y_pred_enc)
fig, ax = plt.subplots(figsize=(8, 6))
sns.heatmap(cm, annot=True, fmt="d", cmap="Blues",
            xticklabels=CLASSES, yticklabels=CLASSES, ax=ax)
ax.set_title("Test Confusion Matrix", fontsize=13, fontweight="bold")
ax.set_ylabel("Actual")
ax.set_xlabel("Predicted")
plt.tight_layout()
cm_path = MODELS_PATH / "test_confusion_matrix.png"
plt.savefig(cm_path, dpi=150)
plt.close()
print(f"\n  Confusion matrix saved: {cm_path}")

# ══════════════════════════════════════════════════════
# ⑤ VISUAL WINDOW — Image + Prediction
# ══════════════════════════════════════════════════════

print("\n  Visual mode starting...")
print("  SPACE = next image | Q = quit")
print("  GREEN border = correct | RED border = wrong\n")

THUMB = 300
cols  = 4
rows  = 3
total_show = cols * rows

# Random sample from results
indices = list(range(len(all_paths)))
random.shuffle(indices)
show_indices = indices[:total_show]

def make_grid():
    """Image grid හදනවා"""
    cells = []
    for idx in show_indices:
        img = cv2.imread(str(all_paths[idx]))
        if img is None:
            img = np.zeros((THUMB, THUMB, 3), np.uint8)
        img = cv2.resize(img, (THUMB, THUMB))

        actual = y_true[idx]
        pred   = y_pred[idx]
        correct = actual == pred

        # Border color — correct=green, wrong=red
        border_clr = (0, 200, 0) if correct else (0, 0, 255)
        img = cv2.copyMakeBorder(img, 4, 4, 4, 4,
                                  cv2.BORDER_CONSTANT, value=border_clr)
        img = cv2.resize(img, (THUMB, THUMB))

        # Labels
        pred_clr = STATE_COLORS_BGR.get(pred, (255, 255, 255))
        cv2.rectangle(img, (0, THUMB-50), (THUMB, THUMB), (20, 20, 20), -1)
        cv2.putText(img, f"A: {actual}",
                    (5, THUMB-30), cv2.FONT_HERSHEY_SIMPLEX,
                    0.45, (180, 180, 180), 1)
        cv2.putText(img, f"P: {pred}",
                    (5, THUMB-10), cv2.FONT_HERSHEY_SIMPLEX,
                    0.5, pred_clr, 1)

        cells.append(img)

    # Pad if needed
    while len(cells) < total_show:
        cells.append(np.zeros((THUMB, THUMB, 3), np.uint8))

    rows_list = []
    for r in range(rows):
        row_imgs = cells[r*cols:(r+1)*cols]
        rows_list.append(np.hstack(row_imgs))
    grid = np.vstack(rows_list)

    # Top bar
    bar = np.full((50, grid.shape[1], 3), 20, np.uint8)
    cv2.putText(bar,
                f"Test Evaluation  |  Accuracy: {overall*100:.1f}%  "
                f"|  SPACE=next  Q=quit",
                (10, 33), cv2.FONT_HERSHEY_SIMPLEX,
                0.6, (200, 200, 200), 1)
    return np.vstack([bar, grid])


while True:
    grid = make_grid()
    cv2.imshow("Test Evaluation", grid)

    key = cv2.waitKey(0) & 0xFF
    if key == ord("q") or key == 27:
        break
    elif key == ord(" "):
        random.shuffle(indices)
        show_indices = indices[:total_show]

cv2.destroyAllWindows()
print("\n  Evaluation complete!")