"""
=====================================================================
 Academic Study Planner — Step 1: Data Cleaning & Preprocessing
=====================================================================
Reads  : datasets/study-planner/train_data.csv
         datasets/study-planner/test_data.csv
Writes : datasets/study-planner/train_cleaned.csv
         datasets/study-planner/test_cleaned.csv
         datasets/study-planner/preprocessing_report.txt
=====================================================================
"""

import os
import sys
import warnings
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns

warnings.filterwarnings("ignore")

# ── Paths ──────────────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR    = os.path.join(BASE_DIR, "datasets", "study-planner")
VIZ_DIR     = os.path.join(BASE_DIR, "trained-models", "study-planner", "visualizations")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(VIZ_DIR,  exist_ok=True)

TRAIN_RAW  = os.path.join(DATA_DIR, "train_data.csv")
TEST_RAW   = os.path.join(DATA_DIR, "test_data.csv")
TRAIN_OUT  = os.path.join(DATA_DIR, "train_cleaned.csv")
TEST_OUT   = os.path.join(DATA_DIR, "test_cleaned.csv")
REPORT_OUT = os.path.join(DATA_DIR, "preprocessing_report.txt")

LABEL_COL  = "Priority"
LABEL_MAP  = {0: "Low", 1: "Medium", 2: "High"}

# ── 1. Load ────────────────────────────────────────────────────────
print("=" * 60)
print("  STEP 1 — Data Cleaning & Preprocessing")
print("=" * 60)

train = pd.read_csv(TRAIN_RAW)
test  = pd.read_csv(TEST_RAW)

print(f"\n[LOAD]  train shape : {train.shape}")
print(f"[LOAD]  test  shape : {test.shape}")

report_lines = []
def log(msg=""):
    print(msg)
    report_lines.append(msg)

log()
log("=" * 60)
log("  PREPROCESSING REPORT — Academic Study Planner")
log("=" * 60)
log(f"Train rows : {len(train)}   Test rows : {len(test)}")
log(f"Features   : {train.shape[1] - 1}")
log(f"Target     : {LABEL_COL}  (0=Low, 1=Medium, 2=High)")

# ── 2. Basic Info ─────────────────────────────────────────────────
log("\n--- Column Dtypes ---")
log(str(train.dtypes))

# ── 3. Missing Values ─────────────────────────────────────────────
log("\n--- Missing Values (Train) ---")
miss = train.isnull().sum()
log(str(miss[miss > 0]) if miss.any() else "  No missing values found ✓")

log("\n--- Missing Values (Test) ---")
miss_t = test.isnull().sum()
log(str(miss_t[miss_t > 0]) if miss_t.any() else "  No missing values found ✓")

# ── 4. Duplicate Rows ─────────────────────────────────────────────
dup_train = train.duplicated().sum()
dup_test  = test.duplicated().sum()
log(f"\n--- Duplicates ---")
log(f"  Train: {dup_train}  |  Test: {dup_test}")
if dup_train:
    train = train.drop_duplicates()
    log(f"  → Removed {dup_train} duplicate rows from train")

# ── 5. Target Distribution ────────────────────────────────────────
log("\n--- Target Distribution (Train) ---")
dist = train[LABEL_COL].value_counts().sort_index()
for k, v in dist.items():
    bar = "█" * int(v / len(train) * 40)
    log(f"  {LABEL_MAP[k]:6s} ({k}): {v:5d}  {bar}")

# ── 6. Outlier Detection (IQR) ────────────────────────────────────
feature_cols = [c for c in train.columns if c != LABEL_COL]
log("\n--- Outlier Detection (IQR method, train) ---")

outlier_summary = {}
for col in feature_cols:
    Q1  = train[col].quantile(0.25)
    Q3  = train[col].quantile(0.75)
    IQR = Q3 - Q1
    lo  = Q1 - 1.5 * IQR
    hi  = Q3 + 1.5 * IQR
    n   = ((train[col] < lo) | (train[col] > hi)).sum()
    outlier_summary[col] = n
    if n > 0:
        log(f"  {col:30s}: {n} outliers  [{lo:.2f}, {hi:.2f}]")

if not any(v > 0 for v in outlier_summary.values()):
    log("  No extreme outliers detected ✓")

# ── 7. Statistical Summary ────────────────────────────────────────
log("\n--- Statistical Summary (Train) ---")
log(str(train[feature_cols].describe().round(3)))

# ── 8. Feature Range Validation ───────────────────────────────────
log("\n--- Domain Validation ---")
validations = {
    "Attendance (%)":        (50,  100),
    "Midterm_Score":         (40,  100),
    "Final_Score":           (40,  100),
    "Assignments_Avg":       (40,  100),
    "Quizzes_Avg":           (40,  100),
    "Participation_Score":   (40,  100),
    "Projects_Score":        (40,  100),
    "Study_Hours_per_Week":  (0,   80),
    "Stress_Level (1-10)":   (1,   10),
    "Sleep_Hours_per_Night": (3,   12),
    "Extracurricular":       (0,   1),
}
all_ok = True
for col, (lo, hi) in validations.items():
    if col in train.columns:
        bad = ((train[col] < lo) | (train[col] > hi)).sum()
        if bad:
            log(f"  ⚠  {col}: {bad} values outside [{lo}, {hi}]")
            all_ok = False
if all_ok:
    log("  All domain ranges valid ✓")

# ── 9. Class Imbalance Note ───────────────────────────────────────
log("\n--- Class Imbalance Analysis ---")
counts = train[LABEL_COL].value_counts().sort_index()
majority = counts.max()
for k, v in counts.items():
    ratio = majority / v
    log(f"  {LABEL_MAP[k]:6s}: {v}  (imbalance ratio to majority = {ratio:.2f}x)")
log("  Note: class_weight='balanced' will be applied during training")

# ── 10. Save Cleaned Data ─────────────────────────────────────────
train.to_csv(TRAIN_OUT, index=False)
test.to_csv(TEST_OUT,   index=False)
log(f"\n[SAVE]  train_cleaned.csv → {TRAIN_OUT}")
log(f"[SAVE]  test_cleaned.csv  → {TEST_OUT}")

# ── 11. Visualizations ────────────────────────────────────────────
print("\n[VIZ] Generating plots ...")

# 11a. Priority distribution
fig, ax = plt.subplots(figsize=(7, 4))
colors = ["#4CAF50", "#FF9800", "#F44336"]
ax.bar([LABEL_MAP[k] for k in counts.index], counts.values, color=colors, edgecolor="black")
for i, v in enumerate(counts.values):
    ax.text(i, v + 20, str(v), ha="center", fontweight="bold")
ax.set_title("Task Priority Distribution (Train Set)", fontsize=14, fontweight="bold")
ax.set_xlabel("Priority Level")
ax.set_ylabel("Count")
plt.tight_layout()
plt.savefig(os.path.join(VIZ_DIR, "01_priority_distribution.png"), dpi=150)
plt.close()

# 11b. Correlation heatmap
fig, ax = plt.subplots(figsize=(14, 11))
corr = train.corr()
mask = np.triu(np.ones_like(corr, dtype=bool))
sns.heatmap(corr, mask=mask, annot=True, fmt=".2f", cmap="coolwarm",
            center=0, linewidths=0.4, ax=ax, annot_kws={"size": 7})
ax.set_title("Feature Correlation Heatmap", fontsize=14, fontweight="bold")
plt.tight_layout()
plt.savefig(os.path.join(VIZ_DIR, "02_correlation_heatmap.png"), dpi=150)
plt.close()

# 11c. Feature distributions by priority
key_features = ["Overall_Avg_Score", "Avg_Exam_Score", "Final_Score",
                 "Low_Score_Count", "Attendance_Efficiency", "Projects_Score"]
fig, axes = plt.subplots(2, 3, figsize=(15, 8))
axes = axes.flatten()
palette = {0: "#4CAF50", 1: "#FF9800", 2: "#F44336"}
for i, feat in enumerate(key_features):
    for prio, grp in train.groupby(LABEL_COL):
        axes[i].hist(grp[feat], bins=25, alpha=0.6,
                     color=palette[prio], label=LABEL_MAP[prio], edgecolor="none")
    axes[i].set_title(feat, fontweight="bold")
    axes[i].set_xlabel("")
    axes[i].legend(fontsize=8)
fig.suptitle("Feature Distributions by Priority Level", fontsize=15, fontweight="bold")
plt.tight_layout()
plt.savefig(os.path.join(VIZ_DIR, "03_feature_distributions.png"), dpi=150)
plt.close()

# 11d. Box plots for key features vs priority
fig, axes = plt.subplots(2, 3, figsize=(15, 8))
axes = axes.flatten()
for i, feat in enumerate(key_features):
    data_by_class = [train[train[LABEL_COL] == k][feat].values for k in [0, 1, 2]]
    bp = axes[i].boxplot(data_by_class, patch_artist=True,
                         labels=["Low", "Medium", "High"])
    for patch, color in zip(bp["boxes"], ["#4CAF50", "#FF9800", "#F44336"]):
        patch.set_facecolor(color)
        patch.set_alpha(0.7)
    axes[i].set_title(feat, fontweight="bold")
fig.suptitle("Box Plots: Key Features vs Priority", fontsize=15, fontweight="bold")
plt.tight_layout()
plt.savefig(os.path.join(VIZ_DIR, "04_boxplots.png"), dpi=150)
plt.close()

print("[VIZ] All plots saved to:", VIZ_DIR)

# ── 12. Save Report ───────────────────────────────────────────────
with open(REPORT_OUT, "w") as f:
    f.write("\n".join(report_lines))
print(f"\n[REPORT] Saved → {REPORT_OUT}")
print("\n✅  Step 1 complete — data cleaning done.\n")