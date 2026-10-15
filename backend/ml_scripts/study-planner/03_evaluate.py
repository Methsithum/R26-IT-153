"""
=====================================================================
 Academic Study Planner — Step 3: Deep Evaluation & Visualizations
=====================================================================
Loads  : best trained model (random_forest_model.pkl)
         scaler.pkl, feature_names.pkl
Reads  : datasets/study-planner/test_cleaned.csv
Writes : trained-models/study-planner/visualizations/
         trained-models/study-planner/evaluation_report.txt
=====================================================================
"""

import os
import sys
import warnings
import pickle
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.metrics import (
    classification_report, confusion_matrix,
    roc_auc_score, roc_curve, precision_recall_curve,
    average_precision_score, ConfusionMatrixDisplay,
    accuracy_score, f1_score, precision_score, recall_score,
)
from sklearn.preprocessing import label_binarize
from sklearn.model_selection import learning_curve, StratifiedKFold

warnings.filterwarnings("ignore")

# ── Paths ──────────────────────────────────────────────────────────
BASE_DIR  = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR  = os.path.join(BASE_DIR, "datasets",       "study-planner")
MODEL_DIR = os.path.join(BASE_DIR, "trained-models", "study-planner")
VIZ_DIR   = os.path.join(MODEL_DIR, "visualizations")
os.makedirs(VIZ_DIR, exist_ok=True)

LABEL_COL   = "Priority"
LABEL_MAP   = {0: "Low", 1: "Medium", 2: "High"}
LABEL_NAMES = ["Low", "Medium", "High"]
CLASSES     = [0, 1, 2]
SEED        = 42

report_lines = []
def log(msg=""):
    print(msg)
    report_lines.append(str(msg))

# ── 1. Load artifacts ─────────────────────────────────────────────
log("=" * 60)
log("  STEP 3 — Deep Evaluation")
log("=" * 60)

with open(os.path.join(MODEL_DIR, "random_forest_model.pkl"), "rb") as f:
    rf = pickle.load(f)
with open(os.path.join(MODEL_DIR, "scaler.pkl"), "rb") as f:
    scaler = pickle.load(f)
with open(os.path.join(MODEL_DIR, "feature_names.pkl"), "rb") as f:
    feature_cols = pickle.load(f)

log(f"\nLoaded  : Random Forest  ({rf.n_estimators} trees)")
log(f"Features: {len(feature_cols)}")

# ── 2. Load test data ─────────────────────────────────────────────
test_path = os.path.join(DATA_DIR, "test_cleaned.csv")
if os.path.exists(test_path):
    test = pd.read_csv(test_path)
    X_test = test[feature_cols].values
    y_test = test[LABEL_COL].values
else:
    X_test = np.load(os.path.join(DATA_DIR, "X_test.npy"))
    y_test = np.load(os.path.join(DATA_DIR, "y_test.npy"))

train_path = os.path.join(DATA_DIR, "train_cleaned.csv")
if os.path.exists(train_path):
    train = pd.read_csv(train_path)
    X_train = train[feature_cols].values
    y_train = train[LABEL_COL].values
else:
    X_train = np.load(os.path.join(DATA_DIR, "X_train.npy"))
    y_train = np.load(os.path.join(DATA_DIR, "y_train.npy"))

# ── 3. Predict ────────────────────────────────────────────────────
y_pred = rf.predict(X_test)
y_prob = rf.predict_proba(X_test)

# ── 4. Metrics ────────────────────────────────────────────────────
acc  = accuracy_score(y_test, y_pred)
f1_w = f1_score(y_test, y_pred, average="weighted")
f1_m = f1_score(y_test, y_pred, average="macro")
pre  = precision_score(y_test, y_pred, average="weighted")
rec  = recall_score(y_test, y_pred, average="weighted")
auc  = roc_auc_score(y_test, y_prob, multi_class="ovr", average="weighted")

log(f"\n{'─'*40}")
log("  Overall Metrics (Test Set)")
log(f"{'─'*40}")
log(f"  Accuracy         : {acc:.4f}")
log(f"  Precision (wtd)  : {pre:.4f}")
log(f"  Recall    (wtd)  : {rec:.4f}")
log(f"  F1        (wtd)  : {f1_w:.4f}")
log(f"  F1        (macro): {f1_m:.4f}")
log(f"  AUC-ROC   (OVR)  : {auc:.4f}")

log(f"\n--- Per-Class Report ---")
log(classification_report(y_test, y_pred, target_names=LABEL_NAMES))

# ── 5. Confusion Matrix (normalized) ─────────────────────────────
cm     = confusion_matrix(y_test, y_pred)
cm_norm= cm.astype(float) / cm.sum(axis=1, keepdims=True)

fig, axes = plt.subplots(1, 2, figsize=(13, 5))
ConfusionMatrixDisplay(cm,      display_labels=LABEL_NAMES).plot(ax=axes[0], colorbar=False, cmap="Blues")
ConfusionMatrixDisplay(cm_norm, display_labels=LABEL_NAMES).plot(ax=axes[1], colorbar=False, cmap="Greens")
axes[0].set_title("Confusion Matrix — Counts",      fontweight="bold")
axes[1].set_title("Confusion Matrix — Normalized",  fontweight="bold")
plt.tight_layout()
plt.savefig(os.path.join(VIZ_DIR, "09_confusion_matrix_detailed.png"), dpi=150)
plt.close()

# ── 6. ROC Curve (OVR per class) ─────────────────────────────────
y_bin = label_binarize(y_test, classes=CLASSES)
colors_roc = ["#4CAF50", "#FF9800", "#F44336"]

fig, ax = plt.subplots(figsize=(8, 6))
for i, (cls, color) in enumerate(zip(CLASSES, colors_roc)):
    fpr, tpr, _ = roc_curve(y_bin[:, i], y_prob[:, i])
    auc_cls = roc_auc_score(y_bin[:, i], y_prob[:, i])
    ax.plot(fpr, tpr, color=color, linewidth=2,
            label=f"{LABEL_NAMES[i]} (AUC = {auc_cls:.3f})")
ax.plot([0, 1], [0, 1], "k--", linewidth=1, label="Random")
ax.set_xlabel("False Positive Rate")
ax.set_ylabel("True Positive Rate")
ax.set_title("ROC Curves — One-vs-Rest (per class)", fontsize=13, fontweight="bold")
ax.legend(loc="lower right")
ax.grid(True, alpha=0.3)
plt.tight_layout()
plt.savefig(os.path.join(VIZ_DIR, "10_roc_curves.png"), dpi=150)
plt.close()

# ── 7. Precision-Recall Curves ────────────────────────────────────
fig, ax = plt.subplots(figsize=(8, 6))
for i, (cls, color) in enumerate(zip(CLASSES, colors_roc)):
    prec, recall, _ = precision_recall_curve(y_bin[:, i], y_prob[:, i])
    ap = average_precision_score(y_bin[:, i], y_prob[:, i])
    ax.plot(recall, prec, color=color, linewidth=2,
            label=f"{LABEL_NAMES[i]} (AP = {ap:.3f})")
ax.set_xlabel("Recall")
ax.set_ylabel("Precision")
ax.set_title("Precision-Recall Curves (per class)", fontsize=13, fontweight="bold")
ax.legend()
ax.grid(True, alpha=0.3)
plt.tight_layout()
plt.savefig(os.path.join(VIZ_DIR, "11_precision_recall_curves.png"), dpi=150)
plt.close()

# ── 8. Learning Curve ─────────────────────────────────────────────
cv  = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
train_sizes, train_sc, val_sc = learning_curve(
    rf, X_train, y_train, cv=cv,
    scoring="f1_weighted", train_sizes=np.linspace(0.1, 1.0, 10),
    n_jobs=-1
)
train_mean = train_sc.mean(axis=1)
train_std  = train_sc.std(axis=1)
val_mean   = val_sc.mean(axis=1)
val_std    = val_sc.std(axis=1)

fig, ax = plt.subplots(figsize=(9, 5))
ax.plot(train_sizes, train_mean, "b-o", linewidth=2, label="Training score")
ax.fill_between(train_sizes, train_mean - train_std, train_mean + train_std, alpha=0.15, color="blue")
ax.plot(train_sizes, val_mean,   "r-o", linewidth=2, label="CV score")
ax.fill_between(train_sizes, val_mean - val_std,   val_mean + val_std,   alpha=0.15, color="red")
ax.set_xlabel("Training Set Size")
ax.set_ylabel("F1 Score (weighted)")
ax.set_title("Learning Curve — Random Forest", fontsize=13, fontweight="bold")
ax.legend()
ax.grid(True, alpha=0.3)
ax.set_ylim(0, 1.05)
plt.tight_layout()
plt.savefig(os.path.join(VIZ_DIR, "12_learning_curve.png"), dpi=150)
plt.close()

# ── 9. Prediction Confidence Distribution ─────────────────────────
max_conf = y_prob.max(axis=1)
fig, axes = plt.subplots(1, 3, figsize=(15, 4))
for i, (cls, color) in enumerate(zip(CLASSES, colors_roc)):
    mask = y_test == cls
    axes[i].hist(max_conf[mask], bins=20, color=color, alpha=0.8, edgecolor="black")
    axes[i].set_title(f"Confidence — {LABEL_NAMES[i]}", fontweight="bold")
    axes[i].set_xlabel("Max Probability")
    axes[i].set_ylabel("Count")
fig.suptitle("Prediction Confidence Distribution per Class", fontsize=13, fontweight="bold")
plt.tight_layout()
plt.savefig(os.path.join(VIZ_DIR, "13_confidence_distribution.png"), dpi=150)
plt.close()

# ── 10. Feature Importance (detailed) ────────────────────────────
importances = rf.feature_importances_
feat_imp = pd.DataFrame({
    "Feature":    feature_cols,
    "Importance": importances,
    "Std":        np.std([t.feature_importances_ for t in rf.estimators_], axis=0)
}).sort_values("Importance", ascending=False)

log("\n--- Feature Importances (Random Forest) ---")
log(feat_imp.to_string(index=False))

fig, ax = plt.subplots(figsize=(10, 8))
top = feat_imp.head(15).iloc[::-1]
ax.barh(top["Feature"], top["Importance"],
        xerr=top["Std"], color="#1565C0", alpha=0.8,
        edgecolor="black", capsize=4)
ax.set_xlabel("Mean Decrease in Impurity")
ax.set_title("Top 15 Feature Importances with Std Dev", fontsize=13, fontweight="bold")
ax.axvline(importances.mean(), color="red", linestyle="--", linewidth=1.5,
           label=f"Mean ({importances.mean():.4f})")
ax.legend()
plt.tight_layout()
plt.savefig(os.path.join(VIZ_DIR, "14_feature_importance_detailed.png"), dpi=150)
plt.close()

# ── 11. Error Analysis ────────────────────────────────────────────
log("\n--- Error Analysis ---")
errors = y_pred != y_test
error_rate = errors.mean()
log(f"  Total errors : {errors.sum()} / {len(y_test)}  ({error_rate*100:.1f}%)")
log("\n  Error breakdown by true class:")
for cls in CLASSES:
    mask  = y_test == cls
    wrong = (y_pred[mask] != y_test[mask]).sum()
    total = mask.sum()
    log(f"    {LABEL_NAMES[cls]:6s}: {wrong}/{total} errors ({wrong/total*100:.1f}%)")

# ── 12. Save Report ───────────────────────────────────────────────
with open(os.path.join(MODEL_DIR, "evaluation_report.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(report_lines))

print(f"\n✅  Step 3 complete — evaluation done.")
print(f"    Visualizations : {VIZ_DIR}")
print(f"    Report         : {os.path.join(MODEL_DIR, 'evaluation_report.txt')}\n")