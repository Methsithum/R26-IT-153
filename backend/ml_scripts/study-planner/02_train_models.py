"""
=====================================================================
 Academic Study Planner — Step 2: Model Training
=====================================================================
Reads  : datasets/study-planner/train_cleaned.csv
         datasets/study-planner/test_cleaned.csv
         (or falls back to X_train.npy / y_train.npy if CSVs absent)
Trains : Random Forest  (primary model — best for this task)
         Gradient Boosting (GBM)   (secondary model)
         Logistic Regression       (baseline)
Writes : trained-models/study-planner/random_forest_model.pkl
         trained-models/study-planner/gradient_boosting_model.pkl
         trained-models/study-planner/logistic_regression_model.pkl
         trained-models/study-planner/scaler.pkl
         trained-models/study-planner/feature_names.pkl
         trained-models/study-planner/model_comparison.csv
=====================================================================
"""

import os
import sys
import warnings
import pickle
import time
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.ensemble          import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model      import LogisticRegression
from sklearn.preprocessing     import StandardScaler, LabelEncoder
from sklearn.model_selection   import cross_val_score, StratifiedKFold
from sklearn.metrics           import (classification_report, confusion_matrix,
                                        accuracy_score, f1_score,
                                        roc_auc_score, ConfusionMatrixDisplay)
from sklearn.inspection        import permutation_importance

warnings.filterwarnings("ignore")

# ── Paths ──────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR   = os.path.join(BASE_DIR, "datasets",       "study-planner")
MODEL_DIR  = os.path.join(BASE_DIR, "trained-models", "study-planner")
VIZ_DIR    = os.path.join(MODEL_DIR, "visualizations")

os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(VIZ_DIR,   exist_ok=True)

LABEL_COL  = "Priority"
LABEL_MAP  = {0: "Low", 1: "Medium", 2: "High"}
LABEL_NAMES= ["Low", "Medium", "High"]

SEED = 42
np.random.seed(SEED)

# ── 1. Load Data ───────────────────────────────────────────────────
print("=" * 60)
print("  STEP 2 — Model Training")
print("=" * 60)

train_path = os.path.join(DATA_DIR, "train_cleaned.csv")
test_path  = os.path.join(DATA_DIR, "test_cleaned.csv")

if os.path.exists(train_path):
    print("\n[LOAD] Reading cleaned CSVs ...")
    train = pd.read_csv(train_path)
    test  = pd.read_csv(test_path)

    feature_cols = [c for c in train.columns if c != LABEL_COL]
    X_train = train[feature_cols].values
    y_train = train[LABEL_COL].values
    X_test  = test[feature_cols].values
    y_test  = test[LABEL_COL].values
else:
    # Fallback: use pre-split .npy files (already scaled)
    print("\n[LOAD] Cleaned CSVs not found — loading .npy arrays ...")
    X_train = np.load(os.path.join(DATA_DIR, "X_train.npy"))
    X_test  = np.load(os.path.join(DATA_DIR, "X_test.npy"))
    y_train = np.load(os.path.join(DATA_DIR, "y_train.npy"))
    y_test  = np.load(os.path.join(DATA_DIR, "y_test.npy"))
    feature_cols = [f"feature_{i}" for i in range(X_train.shape[1])]

print(f"  X_train : {X_train.shape}   y_train : {y_train.shape}")
print(f"  X_test  : {X_test.shape}   y_test  : {y_test.shape}")
print(f"  Classes : {np.unique(y_train)} → {[LABEL_MAP[k] for k in np.unique(y_train)]}")

# ── 2. Feature Scaling ────────────────────────────────────────────
print("\n[SCALE] Fitting StandardScaler on X_train ...")
scaler  = StandardScaler()
X_train_s = scaler.fit_transform(X_train)
X_test_s  = scaler.transform(X_test)

with open(os.path.join(MODEL_DIR, "scaler.pkl"), "wb") as f:
    pickle.dump(scaler, f)
with open(os.path.join(MODEL_DIR, "feature_names.pkl"), "wb") as f:
    pickle.dump(feature_cols, f)
print("  Scaler saved ✓")

# ── 3. Define Models ──────────────────────────────────────────────
models = {
    "Random Forest": RandomForestClassifier(
        n_estimators   = 300,
        max_depth      = None,
        min_samples_split = 4,
        min_samples_leaf  = 2,
        class_weight   = "balanced",
        random_state   = SEED,
        n_jobs         = -1,
    ),
    "Gradient Boosting": GradientBoostingClassifier(
        n_estimators   = 200,
        learning_rate  = 0.1,
        max_depth      = 5,
        subsample      = 0.8,
        random_state   = SEED,
    ),
    "Logistic Regression": LogisticRegression(
        C              = 1.0,
        max_iter       = 1000,
        class_weight   = "balanced",
        solver         = "lbfgs",
        random_state   = SEED,
    ),
}

MODEL_FILE = {
    "Random Forest":       "random_forest_model.pkl",
    "Gradient Boosting":   "gradient_boosting_model.pkl",
    "Logistic Regression": "logistic_regression_model.pkl",
}

# ── 4. Train & Evaluate ───────────────────────────────────────────
cv       = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
results  = []
trained  = {}

for name, model in models.items():
    print(f"\n{'─'*55}")
    print(f"  Training: {name}")
    print(f"{'─'*55}")

    # Use scaled data for LR; tree models work on raw or scaled
    X_tr = X_train_s if name == "Logistic Regression" else X_train
    X_te = X_test_s  if name == "Logistic Regression" else X_test

    # Cross-validation
    t0 = time.time()
    cv_scores = cross_val_score(model, X_tr, y_train,
                                cv=cv, scoring="f1_weighted", n_jobs=-1)
    cv_time   = time.time() - t0

    # Full train
    model.fit(X_tr, y_train)
    y_pred = model.predict(X_te)
    y_prob = model.predict_proba(X_te)

    acc    = accuracy_score(y_test, y_pred)
    f1_w   = f1_score(y_test, y_pred, average="weighted")
    f1_m   = f1_score(y_test, y_pred, average="macro")
    auc    = roc_auc_score(y_test, y_prob, multi_class="ovr", average="weighted")

    print(f"  CV F1-weighted (5-fold): {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")
    print(f"  Test Accuracy          : {acc:.4f}")
    print(f"  Test F1  (weighted)    : {f1_w:.4f}")
    print(f"  Test F1  (macro)       : {f1_m:.4f}")
    print(f"  Test AUC-OVR           : {auc:.4f}")
    print(f"  Training time          : {cv_time:.1f}s")
    print()
    print(classification_report(y_test, y_pred, target_names=LABEL_NAMES))

    results.append({
        "Model":        name,
        "CV_F1_mean":   round(cv_scores.mean(), 4),
        "CV_F1_std":    round(cv_scores.std(),  4),
        "Test_Accuracy":round(acc,  4),
        "Test_F1_weighted": round(f1_w, 4),
        "Test_F1_macro":    round(f1_m, 4),
        "Test_AUC":     round(auc,  4),
    })
    trained[name] = (model, y_pred, y_prob, X_tr, X_te)

    # Save model
    path = os.path.join(MODEL_DIR, MODEL_FILE[name])
    with open(path, "wb") as f:
        pickle.dump(model, f)
    print(f"  Saved → {path}")

# ── 5. Comparison Table ───────────────────────────────────────────
print(f"\n{'='*60}")
print("  MODEL COMPARISON")
print(f"{'='*60}")
df_res = pd.DataFrame(results).sort_values("Test_F1_weighted", ascending=False)
print(df_res.to_string(index=False))
df_res.to_csv(os.path.join(MODEL_DIR, "model_comparison.csv"), index=False)

best_name = df_res.iloc[0]["Model"]
print(f"\n  🏆  Best model : {best_name}")

# ── 6. Visualizations ─────────────────────────────────────────────
print("\n[VIZ] Generating training visualizations ...")

# 6a. Model comparison bar chart
metrics = ["Test_Accuracy", "Test_F1_weighted", "Test_F1_macro", "Test_AUC"]
fig, axes = plt.subplots(1, 4, figsize=(18, 5))
colors = ["#1565C0", "#E65100", "#2E7D32"]
for i, metric in enumerate(metrics):
    vals  = df_res[metric].values
    names = df_res["Model"].values
    bars  = axes[i].bar(names, vals, color=colors[:len(names)], edgecolor="black", alpha=0.85)
    for bar, v in zip(bars, vals):
        axes[i].text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.002,
                     f"{v:.3f}", ha="center", va="bottom", fontsize=9, fontweight="bold")
    axes[i].set_title(metric.replace("_", " "), fontweight="bold")
    axes[i].set_ylim(0, 1.05)
    axes[i].set_xticklabels(names, rotation=12, ha="right", fontsize=8)
fig.suptitle("Model Performance Comparison", fontsize=14, fontweight="bold")
plt.tight_layout()
plt.savefig(os.path.join(VIZ_DIR, "05_model_comparison.png"), dpi=150)
plt.close()

# 6b. Confusion matrices for all models
fig, axes = plt.subplots(1, 3, figsize=(18, 5))
for ax, (name, (model, y_pred, y_prob, _, _)) in zip(axes, trained.items()):
    cm = confusion_matrix(y_test, y_pred)
    disp = ConfusionMatrixDisplay(cm, display_labels=LABEL_NAMES)
    disp.plot(ax=ax, colorbar=False, cmap="Blues")
    ax.set_title(name, fontweight="bold")
fig.suptitle("Confusion Matrices (Test Set)", fontsize=14, fontweight="bold")
plt.tight_layout()
plt.savefig(os.path.join(VIZ_DIR, "06_confusion_matrices.png"), dpi=150)
plt.close()

# 6c. Feature importance — Random Forest
if "Random Forest" in trained:
    rf_model = trained["Random Forest"][0]
    importances = rf_model.feature_importances_
    feat_imp = pd.Series(importances, index=feature_cols).sort_values(ascending=True)
    top_n = feat_imp.tail(18)

    fig, ax = plt.subplots(figsize=(9, 7))
    colors_bar = ["#E53935" if v > top_n.quantile(0.75) else
                  "#FB8C00" if v > top_n.quantile(0.4) else "#43A047"
                  for v in top_n.values]
    top_n.plot(kind="barh", ax=ax, color=colors_bar, edgecolor="black", alpha=0.85)
    ax.set_title("Random Forest — Feature Importance", fontsize=14, fontweight="bold")
    ax.set_xlabel("Importance Score")
    ax.axvline(importances.mean(), color="navy", linestyle="--", linewidth=1.5,
               label=f"Mean ({importances.mean():.3f})")
    ax.legend()
    plt.tight_layout()
    plt.savefig(os.path.join(VIZ_DIR, "07_feature_importance.png"), dpi=150)
    plt.close()

# 6d. Cross-validation scores per model
fig, ax = plt.subplots(figsize=(9, 5))
for idx, (name, model) in enumerate(models.items()):
    X_tr = X_train_s if name == "Logistic Regression" else X_train
    cv_sc = cross_val_score(model, X_tr, y_train, cv=cv, scoring="f1_weighted", n_jobs=-1)
    ax.plot(range(1, 6), cv_sc, marker="o", label=name, linewidth=2)
ax.set_title("Cross-Validation F1-Weighted per Fold", fontsize=13, fontweight="bold")
ax.set_xlabel("Fold")
ax.set_ylabel("F1 Score (weighted)")
ax.legend()
ax.set_ylim(0, 1.05)
ax.grid(True, alpha=0.3)
plt.tight_layout()
plt.savefig(os.path.join(VIZ_DIR, "08_cv_scores.png"), dpi=150)
plt.close()

print("[VIZ] All plots saved ✓")
print(f"\n✅  Step 2 complete — all models trained and saved.\n")
print(f"    Best model : {best_name}")
print(f"    Models dir : {MODEL_DIR}\n")