"""
STEP 2 - Model Training
========================
File: backend/ml_scripts/focus/train_model.py
"""

import os
import json
import warnings
import numpy as np
import cv2
import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns
warnings.filterwarnings("ignore")

from pathlib import Path
from collections import Counter
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.utils import resample
import xgboost as xgb
import tensorflow as tf
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

# ══════════════════════════════════════════════════════
# SETTINGS
# ══════════════════════════════════════════════════════

BASE_DIR     = Path(__file__).resolve().parents[2]
DATASET_PATH = BASE_DIR / "datasets" / "focus" / "Final_dataset"
OUTPUT_PATH  = BASE_DIR / "trained-models" / "focus"
OUTPUT_PATH.mkdir(parents=True, exist_ok=True)

CLASSES      = ["Focused", "Fatigue", "Anxiety", "Boredom"]
IMG_SIZE     = 224
BATCH_SIZE   = 32
SEED         = 42
BALANCE_SIZE = 10000
np.random.seed(SEED)

print("=" * 60)
print("  Student Focus Monitoring — Model Training")
print("=" * 60)
print(f"  Dataset : {DATASET_PATH}")
print(f"  Output  : {OUTPUT_PATH}")
print(f"  Balance : {BALANCE_SIZE} per class → {BALANCE_SIZE*4} total train")
print("=" * 60)

# ══════════════════════════════════════════════════════
# ① LOAD IMAGE PATHS
# ══════════════════════════════════════════════════════

def load_image_paths(split):
    paths, labels = [], []
    for cls in CLASSES:
        cls_path = DATASET_PATH / split / cls
        if not cls_path.is_dir():
            print(f"  ⚠ Missing: {cls_path}")
            continue
        imgs = [str(p) for p in cls_path.rglob("*")
                if p.suffix.lower() in (".jpg", ".jpeg", ".png", ".bmp")]
        paths.extend(imgs)
        labels.extend([cls] * len(imgs))
    return np.array(paths), np.array(labels)

print("\n① Loading dataset...")
train_paths, train_labels = load_image_paths("train")
val_paths,   val_labels   = load_image_paths("val")
test_paths,  test_labels  = load_image_paths("test")

print(f"   Train : {len(train_paths)}")
print(f"   Val   : {len(val_paths)}")
print(f"   Test  : {len(test_paths)}")

# ══════════════════════════════════════════════════════
# ② BALANCE CHECK
# ══════════════════════════════════════════════════════

print("\n② Balance Check...")
counts = Counter(train_labels)
for cls, cnt in counts.items():
    print(f"   {cls}: {cnt}")

# ══════════════════════════════════════════════════════
# AUGMENTATION FUNCTION
# ══════════════════════════════════════════════════════

def augment_image(img):
    """flip / rotation / brightness / zoom"""
    if np.random.rand() > 0.5:
        img = cv2.flip(img, 1)

    angle = np.random.uniform(-15, 15)
    h, w  = img.shape[:2]
    M     = cv2.getRotationMatrix2D((w/2, h/2), angle, 1.0)
    img   = cv2.warpAffine(img, M, (w, h))

    factor = np.random.uniform(0.7, 1.3)
    img    = np.clip(img.astype(np.float32) * factor, 0, 255).astype(np.uint8)

    if np.random.rand() > 0.5:
        zoom  = np.random.uniform(0.85, 1.0)
        ch, cw = int(h * zoom), int(w * zoom)
        y1    = np.random.randint(0, h - ch)
        x1    = np.random.randint(0, w - cw)
        img   = img[y1:y1+ch, x1:x1+cw]
        img   = cv2.resize(img, (w, h))

    return img

# ══════════════════════════════════════════════════════
# GET BALANCED PATHS (RAM friendly — images load නොකරයි)
# ══════════════════════════════════════════════════════

def get_balanced_paths(paths, labels, target):
    """
    Returns list of (path, do_augment) tuples + label array
    Images RAM ට load නොකරයි
    """
    all_items, all_labels = [], []

    for cls in CLASSES:
        cls_mask  = labels == cls
        cls_paths = paths[cls_mask]
        current   = len(cls_paths)

        if current >= target:
            selected = resample(cls_paths, n_samples=target,
                                replace=False, random_state=SEED)
            for p in selected:
                all_items.append((p, False))
                all_labels.append(cls)
            print(f"   {cls}: {current} → {target} (undersample)")
        else:
            for p in cls_paths:
                all_items.append((p, False))
                all_labels.append(cls)
            needed = target - current
            for i in range(needed):
                src = cls_paths[i % current]
                all_items.append((src, True))
                all_labels.append(cls)
            print(f"   {cls}: {current} → {target} "
                  f"(orig:{current} + aug:{needed})")

    return all_items, np.array(all_labels)

print(f"\n   Balancing to {BALANCE_SIZE} per class...")
train_items, y_train_raw = get_balanced_paths(
    train_paths, train_labels, BALANCE_SIZE)
print(f"   After balance — Train: {len(train_items)} items")

# ══════════════════════════════════════════════════════
# ③④ MOBILENETV2 FEATURE EXTRACTION
# ══════════════════════════════════════════════════════

print("\n③④ Loading MobileNetV2...")
mobilenet = MobileNetV2(weights="imagenet", include_top=False,
                        pooling="avg", input_shape=(IMG_SIZE, IMG_SIZE, 3))
mobilenet.trainable = False
print("   MobileNetV2 ready ✅  (output: 1280 features)")


def extract_balanced_features(items, labels, tag):
    """
    Batch by batch: load → augment (if needed) → extract features
    RAM friendly — never loads all images at once
    """
    features, valid_labels = [], []
    total = len(items)

    idx    = np.random.permutation(total)
    items  = [items[i] for i in idx]
    labels = labels[idx]

    for i in range(0, total, BATCH_SIZE):
        batch_items  = items[i:i + BATCH_SIZE]
        batch_labels = labels[i:i + BATCH_SIZE]
        batch_imgs   = []

        for path, do_aug in batch_items:
            img = cv2.imread(str(path))
            if img is None:
                continue
            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            img = cv2.resize(img, (IMG_SIZE, IMG_SIZE))
            if do_aug:
                img = augment_image(img)
            batch_imgs.append(preprocess_input(img.astype(np.float32)))

        if not batch_imgs:
            continue

        feats = mobilenet.predict(np.array(batch_imgs), verbose=0)
        features.extend(feats)
        valid_labels.extend(batch_labels[:len(feats)])

        done = min(i + BATCH_SIZE, total)
        print(f"   {tag}: {done}/{total}", end="\r")

    print(f"   {tag}: {total}/{total} ✅          ")
    return np.array(features), np.array(valid_labels)


def extract_from_paths(paths, labels, tag):
    """Val/Test paths → features (no augmentation)"""
    features, valid_labels = [], []
    total = len(paths)

    idx    = np.random.permutation(total)
    paths  = paths[idx]
    labels = labels[idx]

    for i in range(0, total, BATCH_SIZE):
        batch_p = paths[i:i + BATCH_SIZE]
        batch_l = labels[i:i + BATCH_SIZE]
        imgs    = []

        for p in batch_p:
            img = cv2.imread(str(p))
            if img is None:
                continue
            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            img = cv2.resize(img, (IMG_SIZE, IMG_SIZE))
            imgs.append(preprocess_input(img.astype(np.float32)))

        if not imgs:
            continue

        feats = mobilenet.predict(np.array(imgs), verbose=0)
        features.extend(feats)
        valid_labels.extend(batch_l[:len(feats)])

        done = min(i + BATCH_SIZE, total)
        print(f"   {tag}: {done}/{total}", end="\r")

    print(f"   {tag}: {total}/{total} ✅          ")
    return np.array(features), np.array(valid_labels)


# Cache check
cache_file = OUTPUT_PATH / "features_cache.npz"
if cache_file.exists():
    print("\n③④ Loading cached features...")
    cache   = np.load(cache_file, allow_pickle=True)
    X_train = cache["X_train"]
    y_train = cache["y_train"]
    X_val   = cache["X_val"]
    y_val   = cache["y_val"]
    X_test  = cache["X_test"]
    y_test  = cache["y_test"]
    print(f"   Train : {X_train.shape} ✅")
    print(f"   Val   : {X_val.shape} ✅")
    print(f"   Test  : {X_test.shape} ✅")
else:
    print("\n   Extracting Train features...")
    X_train, y_train = extract_balanced_features(
        train_items, y_train_raw, "Train")

    print("\n   Extracting Val features...")
    X_val, y_val = extract_from_paths(val_paths, val_labels, "Val  ")

    print("\n   Extracting Test features...")
    X_test, y_test = extract_from_paths(test_paths, test_labels, "Test ")

    print("\n   Saving feature cache...")
    np.savez(cache_file,
             X_train=X_train, y_train=y_train,
             X_val=X_val,     y_val=y_val,
             X_test=X_test,   y_test=y_test)
    print("   Cache saved ✅")

print(f"\n   Shapes — Train:{X_train.shape} | "
      f"Val:{X_val.shape} | Test:{X_test.shape}")

# Encode labels
le = LabelEncoder()
le.fit(CLASSES)
y_tr = le.transform(y_train)
y_v  = le.transform(y_val)
y_te = le.transform(y_test)

# Scale features (SVM ට)
scaler  = StandardScaler()
X_tr_sc = scaler.fit_transform(X_train)
X_v_sc  = scaler.transform(X_val)
X_te_sc = scaler.transform(X_test)

# ══════════════════════════════════════════════════════
# ⑤ TRAIN 3 ALGORITHMS
# ══════════════════════════════════════════════════════

# CLASSES index: Focused=0, Fatigue=1, Anxiety=2, Boredom=3
CLASS_W = {
    0: 10.0,   # Focused
    1: 10.0,   # Fatigue
    2:  0.2,   # Anxiety  ← low (dominate නොකරන්න)
    3: 12.0,   # Boredom
}

results = {}
print("\n⑤ Training...")

# ── Random Forest ──────────────────────────────────────
print("\n   [1/3] Random Forest...")
rf_sw = np.array([CLASS_W[l] for l in y_tr])
rf    = RandomForestClassifier(
    n_estimators=200, max_depth=20, n_jobs=-1, random_state=SEED)
rf.fit(X_train, y_tr, sample_weight=rf_sw)
results["Random Forest"] = {
    "model":    rf,
    "val_acc":  accuracy_score(y_v,  rf.predict(X_val)),
    "test_acc": accuracy_score(y_te, rf.predict(X_test)),
    "scaled":   False
}
print(f"   Val: {results['Random Forest']['val_acc']*100:.2f}%  "
      f"Test: {results['Random Forest']['test_acc']*100:.2f}%")

# ── XGBoost ────────────────────────────────────────────
print("\n   [2/3] XGBoost...")
xgb_sw = np.array([CLASS_W[l] for l in y_tr])
xgb_m  = xgb.XGBClassifier(
    n_estimators=300, max_depth=8, learning_rate=0.05,
    subsample=0.8, colsample_bytree=0.8,
    use_label_encoder=False, eval_metric="mlogloss",
    random_state=SEED, n_jobs=-1)
xgb_m.fit(X_train, y_tr, sample_weight=xgb_sw,
           eval_set=[(X_val, y_v)], verbose=False)
results["XGBoost"] = {
    "model":    xgb_m,
    "val_acc":  accuracy_score(y_v,  xgb_m.predict(X_val)),
    "test_acc": accuracy_score(y_te, xgb_m.predict(X_test)),
    "scaled":   False
}
print(f"   Val: {results['XGBoost']['val_acc']*100:.2f}%  "
      f"Test: {results['XGBoost']['test_acc']*100:.2f}%")

# ── SVM ────────────────────────────────────────────────
print("\n   [3/3] SVM...")
svm_n  = min(15000, len(X_tr_sc))
idx_sv = np.random.choice(len(X_tr_sc), svm_n, replace=False)
X_svm  = X_tr_sc[idx_sv]
y_svm  = y_tr[idx_sv]
w_svm  = np.array([CLASS_W[l] for l in y_svm])
svm    = SVC(kernel="rbf", C=10, gamma="scale",
             probability=True, random_state=SEED)
svm.fit(X_svm, y_svm, sample_weight=w_svm)
results["SVM"] = {
    "model":    svm,
    "val_acc":  accuracy_score(y_v,  svm.predict(X_v_sc)),
    "test_acc": accuracy_score(y_te, svm.predict(X_te_sc)),
    "scaled":   True
}
print(f"   Val: {results['SVM']['val_acc']*100:.2f}%  "
      f"Test: {results['SVM']['test_acc']*100:.2f}%")

# ══════════════════════════════════════════════════════
# ⑥ COMPARE + GRAPHS
# ══════════════════════════════════════════════════════

print("\n⑥ Results:")
print("=" * 52)
print(f"  {'Algorithm':<18} {'Val':>10} {'Test':>10}")
print("-" * 52)

best_name, best_acc = None, 0.0
for name, r in results.items():
    if r["test_acc"] > best_acc:
        best_acc, best_name = r["test_acc"], name

for name, r in results.items():
    tag = " ← BEST 🏆" if name == best_name else ""
    print(f"  {name:<18} {r['val_acc']*100:>9.2f}%  "
          f"{r['test_acc']*100:>9.2f}%{tag}")
print("=" * 52)

# Accuracy comparison chart
names     = list(results.keys())
val_accs  = [r["val_acc"]  * 100 for r in results.values()]
test_accs = [r["test_acc"] * 100 for r in results.values()]
colors    = ["#4CAF50" if n == best_name else "#2196F3" for n in names]

fig, axes = plt.subplots(1, 2, figsize=(13, 5))
fig.suptitle("Algorithm Comparison — Student Focus Monitoring",
             fontsize=13, fontweight="bold")
for ax, accs, title in zip(axes,
                            [val_accs, test_accs],
                            ["Validation Accuracy", "Test Accuracy"]):
    bars = ax.bar(names, accs, color=colors, edgecolor="white", width=0.5)
    ax.set_title(title, fontsize=11)
    ax.set_ylabel("Accuracy (%)")
    ax.set_ylim(0, 105)
    for bar, v in zip(bars, accs):
        ax.text(bar.get_x() + bar.get_width() / 2, v + 1,
                f"{v:.1f}%", ha="center", fontweight="bold", fontsize=10)
plt.tight_layout()
plt.savefig(OUTPUT_PATH / "accuracy_comparison.png", dpi=150)
plt.close()

# Confusion matrix
best_r = results[best_name]
X_te_u = X_te_sc if best_r["scaled"] else X_test
y_pred = best_r["model"].predict(X_te_u)
cm     = confusion_matrix(y_te, y_pred)

fig, ax = plt.subplots(figsize=(8, 6))
sns.heatmap(cm, annot=True, fmt="d", cmap="Blues",
            xticklabels=CLASSES, yticklabels=CLASSES, ax=ax)
ax.set_title(f"Confusion Matrix — {best_name}",
             fontsize=12, fontweight="bold")
ax.set_ylabel("Actual")
ax.set_xlabel("Predicted")
plt.tight_layout()
plt.savefig(OUTPUT_PATH / "confusion_matrix.png", dpi=150)
plt.close()

# Per-class F1 chart
report_dict = {}
for name, r in results.items():
    xu   = X_te_sc if r["scaled"] else X_test
    pred = r["model"].predict(xu)
    rep  = classification_report(y_te, pred,
                                  target_names=CLASSES, output_dict=True)
    report_dict[name] = {cls: rep[cls]["f1-score"] for cls in CLASSES}

fig, ax = plt.subplots(figsize=(10, 5))
x    = np.arange(len(CLASSES))
w    = 0.25
algs = list(results.keys())
clrs = ["#4CAF50", "#2196F3", "#FF9800"]
for i, (alg, clr) in enumerate(zip(algs, clrs)):
    f1s  = [report_dict[alg][cls] * 100 for cls in CLASSES]
    bars = ax.bar(x + i * w, f1s, w, label=alg,
                  color=clr, edgecolor="white")
    for bar, v in zip(bars, f1s):
        ax.text(bar.get_x() + bar.get_width() / 2, v + 0.5,
                f"{v:.0f}%", ha="center", fontsize=8, fontweight="bold")
ax.set_xticks(x + w)
ax.set_xticklabels(CLASSES, fontsize=11)
ax.set_ylabel("F1 Score (%)")
ax.set_ylim(0, 110)
ax.set_title("Per-Class F1 Score Comparison",
             fontsize=13, fontweight="bold")
ax.legend()
ax.axhline(y=75, color="red", linestyle="--", alpha=0.5, label="75% target")
plt.tight_layout()
plt.savefig(OUTPUT_PATH / "f1_comparison.png", dpi=150)
plt.close()

print(f"\n  📊 Graphs saved: {OUTPUT_PATH}")
print(f"\n  Classification Report ({best_name}):")
print(classification_report(y_te, y_pred, target_names=CLASSES))

# ══════════════════════════════════════════════════════
# ⑦ SAVE BEST MODEL
# ══════════════════════════════════════════════════════

print("⑦ Saving...")
joblib.dump(best_r["model"], OUTPUT_PATH / "best_model.pkl")
joblib.dump(scaler,          OUTPUT_PATH / "scaler.pkl")
joblib.dump(le,              OUTPUT_PATH / "label_encoder.pkl")
mobilenet.save(str(OUTPUT_PATH / "feature_extractor.keras"))

report = {
    "best_algorithm": best_name,
    "test_accuracy":  round(best_acc * 100, 2),
    "classes":        CLASSES,
    "needs_scaling":  best_r["scaled"],
    "img_size":       IMG_SIZE,
    "balance_size":   BALANCE_SIZE,
    "all_results": {
        n: {"val":  round(r["val_acc"]  * 100, 2),
            "test": round(r["test_acc"] * 100, 2)}
        for n, r in results.items()
    }
}
with open(OUTPUT_PATH / "model_report.json", "w") as f:
    json.dump(report, f, indent=2)

print(f"   ✅ best_model.pkl")
print(f"   ✅ scaler.pkl")
print(f"   ✅ label_encoder.pkl")
print(f"   ✅ feature_extractor.keras")
print(f"   ✅ model_report.json")
print(f"   ✅ accuracy_comparison.png")
print(f"   ✅ confusion_matrix.png")
print(f"   ✅ f1_comparison.png")

print("\n" + "=" * 60)
print(f"  ✅ Step 2 Complete!")
print(f"  🏆 Best: {best_name} ({best_acc*100:.2f}%)")
print(f"  📁 Saved: {OUTPUT_PATH}")
print("=" * 60)
print("\n  ➡  Next: Step 3 — realtime_detect.py")