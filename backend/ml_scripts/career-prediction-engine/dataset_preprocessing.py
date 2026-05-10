"""
Preprocessing pipeline for the Integrated Future & Career Prediction Engine.

Reduces the raw student dataset from ~25 columns to 15 curated features,
derives the academic risk label, splits, scales, applies SMOTE, and saves
model-ready objects to trained-models/career-prediction-engine/saved_objects/.

Usage:
    python dataset_preprocessing.py
    (run from ml_scripts/career-prediction-engine/)
"""

import sys
import random
import joblib
import pandas as pd

# Non-interactive backend: plots are written to file, not shown in a window.
# This makes the script safe to run in terminals and headless environments.
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns

from pathlib import Path
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from imblearn.over_sampling import SMOTE


# =============================================================================
# CONFIGURATION — FEATURE DOMAINS & PATHS
# =============================================================================

# Defining features in a dict by domain makes the feature list self-documenting
# and easy for supervisors to review. To add or remove a feature, only edit
# this block — nothing else in the script needs to change.
FEATURE_DOMAINS = {
    'academic'  : [
        'gpa_cumulative', 'gpa_trend', 'assignment_completion_rate',
        'late_submission_rate', 'resit_count', 'project_performance'
    ],
    'behavioral': [
        'attendance_rate', 'weekly_study_hours', 'sleep_hours_avg',
        'sleep_consistency', 'part_time_work_hours'
    ],
    'emotional' : [
        'stress_level', 'anxiety_score', 'mood_stability'
    ],
    'career'    : [
        'career_clarity_score'
    ]
}

# Single authoritative feature list — built once, referenced everywhere below.
FEATURE_COLUMNS = [col for cols in FEATURE_DOMAINS.values() for col in cols]

# Encoding map for the derived classification target.
RISK_MAP   = {'Low': 0, 'Medium': 1, 'High': 2}
RISK_NAMES = {v: k for k, v in RISK_MAP.items()}   # inverse: 0→'Low', etc.

# ── Paths (all relative to this file so the script runs on any machine) ───────
BASE_DIR     = Path(__file__).resolve().parent       # ml_scripts/career-prediction-engine/
DATASET_CSV  = (BASE_DIR / '..' / '..' / 'datasets'
                / 'career-prediction-engine' / 'student_dataset.csv').resolve()
DATASET_XLS  = DATASET_CSV.parent / 'student_dataset.xls'
SAVED_DIR    = (BASE_DIR / '..' / '..' / 'trained-models'
                / 'career-prediction-engine' / 'saved_objects').resolve()
PLOTS_DIR    = (BASE_DIR / '..' / '..' / 'trained-models'
                / 'career-prediction-engine' / 'plots').resolve()
CLEANED_CSV  = DATASET_CSV.parent / 'student_dataset_cleaned.csv'

SAVED_DIR.mkdir(parents=True, exist_ok=True)
PLOTS_DIR.mkdir(parents=True, exist_ok=True)


# =============================================================================
# STEP 1 — LOAD DATASET
# =============================================================================

print("=" * 65)
print("  STEP 1: LOADING DATASET")
print("=" * 65)

# Try CSV first (preferred); fall back to XLS if only that format exists.
if DATASET_CSV.exists():
    raw = pd.read_csv(DATASET_CSV)
    print("  Format loaded : CSV")
    print(f"  Path          : {DATASET_CSV}")
elif DATASET_XLS.exists():
    raw = pd.read_excel(DATASET_XLS, engine='xlrd')
    print("  Format loaded : XLS (CSV not found — using Excel file)")
    print(f"  Path          : {DATASET_XLS}")
else:
    print("\n  ERROR: No dataset found.")
    print(f"    Looked for : {DATASET_CSV}")
    print(f"    Looked for : {DATASET_XLS}")
    print("  Please place student_dataset.csv in the datasets/career-prediction-engine/ folder.")
    sys.exit(1)

print(f"  Raw shape     : {raw.shape}")
print(f"  Columns ({len(raw.columns)}): {raw.columns.tolist()}")


# =============================================================================
# STEP 2 — SELECT 15 FEATURES + REGRESSION TARGET
# =============================================================================

print("\n" + "=" * 65)
print("  STEP 2: SELECTING 15 FEATURES + REGRESSION TARGET")
print("=" * 65)

# Select-not-drop approach: retain only the columns we need.
# Any extra columns in the raw dataset are silently excluded, which makes
# this step robust against future additions to the raw data source.
keep_cols = FEATURE_COLUMNS + ['career_readiness_score']

missing_in_raw = [c for c in keep_cols if c not in raw.columns]
if missing_in_raw:
    print("\n  ERROR: The following required columns are absent from the dataset:")
    for c in missing_in_raw:
        print(f"    ✗  {c}")
    print("\n  Check FEATURE_DOMAINS and verify the column names in the raw CSV.")
    sys.exit(1)

df      = raw[keep_cols].copy()
dropped = [c for c in raw.columns if c not in keep_cols]

print(f"  Features kept : {len(FEATURE_COLUMNS)}")
print("  Target kept   : career_readiness_score")
print(f"  Columns dropped ({len(dropped)}): {dropped}")
print(f"  Working shape : {df.shape}")


# =============================================================================
# STEP 3 — DERIVE ACADEMIC RISK LEVEL (CLASSIFICATION TARGET)
# =============================================================================

print("\n" + "=" * 65)
print("  STEP 3: DERIVING ACADEMIC RISK LEVEL")
print("=" * 65)


random.seed(42)


def derive_academic_risk(row):
    score = 0
    if row['gpa_cumulative'] < 2.5:               score += 3
    elif row['gpa_cumulative'] < 3.0:             score += 2
    elif row['gpa_cumulative'] < 3.3:             score += 1
    if row['gpa_trend'] < -0.3:                   score += 2
    elif row['gpa_trend'] < 0:                    score += 1
    if row['resit_count'] >= 2:                   score += 3
    elif row['resit_count'] == 1:                 score += 1
    if row['attendance_rate'] < 0.6:              score += 2
    elif row['attendance_rate'] < 0.75:           score += 1
    if row['assignment_completion_rate'] < 0.5:   score += 2
    elif row['assignment_completion_rate'] < 0.7: score += 1
    # Inject 12% noise on borderline scores (3–6 range)
    # Simulates real-world uncertainty; breaks perfect rule reconstruction
    if 3 <= score <= 6:
        if random.random() < 0.12:
            score += random.choice([-2, 2])
    if score >= 7:   return 'High'
    elif score >= 4: return 'Medium'
    else:            return 'Low'


df['academic_risk_level'] = df.apply(derive_academic_risk, axis=1)

risk_dist = df['academic_risk_level'].value_counts()
print("  Academic risk distribution (full dataset):")
for label in ['Low', 'Medium', 'High']:
    n   = risk_dist.get(label, 0)
    pct = n / len(df) * 100
    print(f"    {label:6s}: {n:5,}  ({pct:.1f}%)")
print(f"  Dataset shape after derivation: {df.shape}")


# =============================================================================
# STEP 4 — MISSING VALUE CHECK
# =============================================================================

print("\n" + "=" * 65)
print("  STEP 4: MISSING VALUE CHECK")
print("=" * 65)

# Check only feature and target columns — the derived text label can be ignored.
check_cols    = FEATURE_COLUMNS + ['career_readiness_score']
missing_count = df[check_cols].isnull().sum()
missing_cols  = missing_count[missing_count > 0]

if missing_cols.empty:
    print("  No missing values found — dataset is clean.")
else:
    print(f"  Missing values detected in {len(missing_cols)} column(s):")
    for col, cnt in missing_cols.items():
        pct = cnt / len(df) * 100
        if df[col].dtype in ['float64', 'int64']:
            med = df[col].median()
            df[col] = df[col].fillna(med)
            print(f"    {col!r}: {cnt} nulls ({pct:.1f}%) → filled with median ({med:.4f})")
        else:
            print(f"    WARNING: {col!r} is non-numeric with {cnt} nulls — manual review needed.")


# =============================================================================
# STEP 5 — ENCODE ACADEMIC RISK LEVEL
# =============================================================================

print("\n" + "=" * 65)
print("  STEP 5: ENCODING ACADEMIC RISK LEVEL")
print("=" * 65)

# Ordinal encoding (Low=0, Medium=1, High=2) preserves the natural severity
# ordering, which is meaningful context for tree-based classifiers.
df['academic_risk_encoded'] = df['academic_risk_level'].map(RISK_MAP)

print(f"  Encoding applied : {RISK_MAP}")
print("  Sample check (first 4 rows):")
print(df[['academic_risk_level', 'academic_risk_encoded']].head(4).to_string(index=False))


# =============================================================================
# STEP 6 — SEPARATE FEATURES AND TARGETS
# =============================================================================

print("\n" + "=" * 65)
print("  STEP 6: SEPARATING FEATURES AND TARGETS")
print("=" * 65)

# X contains exactly the 15 columns in FEATURE_COLUMNS — no other columns.
X        = df[FEATURE_COLUMNS].copy()
y_risk   = df['academic_risk_encoded']
y_career = df['career_readiness_score']

print(f"  Feature matrix X : {X.shape}")
print(f"  Risk target      : {y_risk.shape}  — classes {sorted(y_risk.unique())}")
career_range = f"[{y_career.min():.2f}, {y_career.max():.2f}]"
print(f"  Career target    : {y_career.shape} — range {career_range}")

# Guard: all features must be numeric before scaling can proceed.
# Catching this here gives a clear, actionable error rather than a cryptic
# StandardScaler exception later.
non_numeric = X.select_dtypes(exclude='number').columns.tolist()
if non_numeric:
    raise ValueError(
        "Non-numeric columns found in feature matrix X — cannot scale.\n"
        f"Columns: {non_numeric}\n"
        "Review FEATURE_DOMAINS or check for string/object values in the raw data."
    )
print("  All 15 feature columns are numeric — safe to scale.")


# =============================================================================
# STEP 7 — CORRELATION ANALYSIS
# =============================================================================

print("\n" + "=" * 65)
print("  STEP 7: CORRELATION ANALYSIS")
print("=" * 65)

corr_matrix = X.corr()

# With 15 features, annotating each cell is still readable (25+ would be cluttered).
fig, ax = plt.subplots(figsize=(13, 10))
sns.heatmap(
    corr_matrix, annot=True, fmt='.2f', cmap='coolwarm',
    center=0, linewidths=0.5, ax=ax, annot_kws={'size': 8}
)
ax.set_title('Feature Correlation Matrix (15 Features)', fontsize=14, pad=14)
plt.tight_layout()
corr_path = PLOTS_DIR / 'correlation_matrix.png'
plt.savefig(corr_path, dpi=150)
plt.close()
print(f"  Heatmap saved : {corr_path}")

# Pairs with |r| > 0.85 are a multicollinearity warning — they can inflate
# coefficient variance in linear models and cause redundant splits in trees.
high_corr = []
cols = corr_matrix.columns.tolist()
for i, col_i in enumerate(cols):
    for col_j in cols[i + 1:]:
        val = abs(corr_matrix.loc[col_i, col_j])
        if val > 0.85:
            high_corr.append((col_i, col_j, round(val, 3)))

if high_corr:
    print("\n  WARNING — Highly correlated pairs (|r| > 0.85):")
    for f1, f2, v in high_corr:
        print(f"    {f1}  <->  {f2}  :  {v}")
else:
    print("  No highly correlated pairs found (all |r| < 0.85).")


# =============================================================================
# STEP 8 — TRAIN/TEST SPLIT + FEATURE SCALING
# =============================================================================

print("\n" + "=" * 65)
print("  STEP 8: TRAIN/TEST SPLIT + FEATURE SCALING")
print("=" * 65)

# ── Risk model split (stratified) ────────────────────────────────────────────
# stratify=y_risk ensures every split has the same Low/Medium/High ratio.
# Without stratification a random split could produce a test set with almost
# no 'High' risk examples, making evaluation misleading.
X_train_r, X_test_r, y_train_r, y_test_r = train_test_split(
    X, y_risk, test_size=0.2, random_state=42, stratify=y_risk
)

# ── Career model split ────────────────────────────────────────────────────────
X_train_c, X_test_c, y_train_c, y_test_c = train_test_split(
    X, y_career, test_size=0.2, random_state=42
)

# ── Feature scaling ───────────────────────────────────────────────────────────
# Fitting the scaler on X_train ONLY prevents data leakage: if we fit on the
# full dataset, test set statistics would indirectly influence the scaler,
# giving an unrealistically optimistic evaluation.
scaler = StandardScaler()
X_train_r_scaled = pd.DataFrame(scaler.fit_transform(X_train_r), columns=FEATURE_COLUMNS)
X_test_r_scaled  = pd.DataFrame(scaler.transform(X_test_r),      columns=FEATURE_COLUMNS)

# The career splits share the same scaler (fitted on X_train_r).
# Both splits originate from the same feature matrix X with the same
# random_state=42, so the training rows are identical.
X_train_c_scaled = pd.DataFrame(scaler.transform(X_train_c), columns=FEATURE_COLUMNS)
X_test_c_scaled  = pd.DataFrame(scaler.transform(X_test_c),  columns=FEATURE_COLUMNS)

print(f"  Risk   — train: {X_train_r_scaled.shape}  |  test: {X_test_r_scaled.shape}")
print(f"  Career — train: {X_train_c_scaled.shape} |  test: {X_test_c_scaled.shape}")


# =============================================================================
# STEP 9 — SMOTE: FIX CLASS IMBALANCE IN RISK TRAINING SET
# =============================================================================

print("\n" + "=" * 65)
print("  STEP 9: SMOTE — BALANCING RISK CLASS DISTRIBUTION")
print("=" * 65)

# SMOTE (Synthetic Minority Over-sampling Technique) generates new synthetic
# samples in feature space by interpolating between existing minority-class
# examples. This avoids the two naive alternatives:
#   Under-sampling → discards real data, reduces training set size.
#   Duplicate over-sampling → causes the model to memorise exact samples.
# Applied ONLY to the training split — the test set must remain untouched
# so evaluation reflects real-world class distributions.
before_counts = pd.Series(y_train_r.values).value_counts().sort_index()
print("  Before SMOTE (risk training set):")
for code, cnt in before_counts.items():
    print(f"    {RISK_NAMES[code]:6s} (class {code}): {cnt:,}")

smote = SMOTE(random_state=42)
X_train_r_balanced, y_train_r_balanced = smote.fit_resample(X_train_r_scaled, y_train_r)

after_counts = pd.Series(y_train_r_balanced).value_counts().sort_index()
print("  After SMOTE (risk training set):")
for code, cnt in after_counts.items():
    print(f"    {RISK_NAMES[code]:6s} (class {code}): {cnt:,}")
print("  All three classes are now balanced.")


# =============================================================================
# STEP 10 — SAVE ALL PREPROCESSED OBJECTS
# =============================================================================

print("\n" + "=" * 65)
print("  STEP 10: SAVING PREPROCESSED OBJECTS")
print("=" * 65)

save_targets = {
    'scaler.pkl'          : scaler,
    'feature_columns.pkl' : FEATURE_COLUMNS,
    'risk_train.pkl'      : (X_train_r_balanced, y_train_r_balanced),
    'risk_test.pkl'       : (X_test_r_scaled,    y_test_r),
    'career_train.pkl'    : (X_train_c_scaled,   y_train_c),
    'career_test.pkl'     : (X_test_c_scaled,    y_test_c),
}

print(f"  Saving to: {SAVED_DIR}\n")
for filename, obj in save_targets.items():
    path = SAVED_DIR / filename
    joblib.dump(obj, path)

    # Immediately reload and verify — confirms the file is not corrupted
    # and that joblib can deserialise it on this machine.
    loaded = joblib.load(path)
    if isinstance(loaded, tuple):
        parts = ', '.join(
            str(o.shape) if hasattr(o, 'shape') else f'len={len(o)}'
            for o in loaded
        )
        print(f"  ✓  {filename:<26} verified  ({parts})")
    elif isinstance(loaded, list):
        print(f"  ✓  {filename:<26} verified  ({len(loaded)} feature names)")
    else:
        print(f"  ✓  {filename:<26} verified  ({type(loaded).__name__})")


# =============================================================================
# SAVE CLEANED DATASET AS CSV
# =============================================================================

print("\n" + "=" * 65)
print("  SAVING CLEANED DATASET AS CSV")
print("=" * 65)

df.to_csv(CLEANED_CSV, index=False)
print(f"  Saved   : {CLEANED_CSV}")
print(f"  Shape   : {df.shape}  ({len(df):,} rows × {df.shape[1]} columns)")
print(f"  Columns : {df.columns.tolist()}")


# =============================================================================
# STEP 11 — FINAL SUMMARY
# =============================================================================

print("\n" + "=" * 65)
print("  PREPROCESSING COMPLETE — SUMMARY")
print("=" * 65)

print(f"\n  FEATURES  (total: {len(FEATURE_COLUMNS)})")
print(f"  {'─' * 58}")
for domain, cols in FEATURE_DOMAINS.items():
    print(f"  {domain.capitalize():10s} ({len(cols)}):  {', '.join(cols)}")

print(f"\n  ACADEMIC RISK DISTRIBUTION  (full dataset: {len(df):,} students)")
print(f"  {'─' * 58}")
for label in ['Low', 'Medium', 'High']:
    n = risk_dist.get(label, 0)
    print(f"    {label:6s}: {n:5,}  ({n / len(df) * 100:.1f}%)")

print("\n  TRAIN / TEST SIZES")
print(f"  {'─' * 58}")
print(f"    Risk model   — train: {len(X_train_r_balanced):,} (post-SMOTE)"
      f"  |  test: {len(X_test_r_scaled):,}")
print(f"    Career model — train: {len(X_train_c_scaled):,}"
      f"                |  test: {len(X_test_c_scaled):,}")

print("\n  SMOTE COMPARISON  (risk training set)")
print(f"  {'─' * 58}")
print(f"    Before: { {RISK_NAMES[k]: v for k, v in before_counts.items()} }")
print(f"    After : { {RISK_NAMES[k]: v for k, v in after_counts.items()} }")

print("\n  SAVED FILES")
print(f"  {'─' * 58}")
for fname in save_targets:
    print(f"    {SAVED_DIR / fname}")
print(f"    {corr_path}")
print(f"    {CLEANED_CSV}")

print("\n" + "=" * 65)
print("  Preprocessing complete. Ready for model_training.py")
print("=" * 65)
