# Run order:
# 1. dataset_preprocessing.py   ← this file
# 2. model_training.py
# 3. test_inference.py

import sys
import random
import warnings
import joblib
import numpy as np
import pandas as pd

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns

from pathlib import Path
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from imblearn.over_sampling import SMOTE

warnings.filterwarnings('ignore')

# =============================================================================
# CONFIGURATION — FEATURE DOMAINS & PATHS
# =============================================================================

FEATURE_DOMAINS = {
    'academic'  : [
        'gpa_cumulative', 'gpa_trend', 'assignment_completion_rate',
        'late_submission_rate', 'resit_count', 'project_performance'
    ],
    'behavioral': [
        'attendance_rate', 'weekly_study_hours', 'sleep_hours_avg',
        'sleep_consistency', 'part_time_work_hours'
    ],
    'emotional' : ['stress_level', 'anxiety_score', 'mood_stability'],
    'career'    : ['career_clarity_score']
}
FEATURE_COLUMNS = [col for cols in FEATURE_DOMAINS.values() for col in cols]

RISK_MAP   = {'Low': 0, 'Medium': 1, 'High': 2}
RISK_NAMES = {v: k for k, v in RISK_MAP.items()}

BASE_DIR     = Path(__file__).resolve().parent
DATASET_CSV  = (BASE_DIR / '..' / '..' / 'datasets'
                / 'career-prediction-engine' / 'student_dataset.csv').resolve()
SAVED_DIR    = (BASE_DIR / '..' / '..' / 'trained-models'
                / 'career-prediction-engine' / 'saved_objects').resolve()
PLOTS_DIR    = (BASE_DIR / '..' / '..' / 'trained-models'
                / 'career-prediction-engine' / 'plots').resolve()
PROFILES_DIR = (BASE_DIR / '..' / '..' / 'trained-models'
                / 'career-prediction-engine' / 'student_profiles').resolve()

SAVED_DIR.mkdir(parents=True, exist_ok=True)
PLOTS_DIR.mkdir(parents=True, exist_ok=True)
PROFILES_DIR.mkdir(parents=True, exist_ok=True)


# ═══════════════════════════════════════════════════════════════════
# STEP 1 — LOAD DATA
# Why: Verify the dataset exists and has the expected shape before
#      any transformations begin. Fail fast with a clear message.
# ═══════════════════════════════════════════════════════════════════

print("=" * 65)
print("  STEP 1: LOAD DATA")
print("=" * 65)

if not DATASET_CSV.exists():
    print(f"\n  ERROR: Dataset not found at {DATASET_CSV}.")
    print("  Check your file location.")
    sys.exit(1)

df = pd.read_csv(DATASET_CSV)
print(f"  Loaded : {DATASET_CSV}")
print(f"  Shape  : {df.shape}  (expected 9,500 × 27)")
print(f"  Columns ({len(df.columns)}): {df.columns.tolist()}")


# ═══════════════════════════════════════════════════════════════════
# STEP 2 — DROP UNWANTED COLUMNS
# Why: Reduce to the 15 supervisor-approved features only.
#      Selecting by name is more robust than dropping by name —
#      future columns in the raw file are silently ignored.
# ═══════════════════════════════════════════════════════════════════

print("\n" + "=" * 65)
print("  STEP 2: DROP UNWANTED COLUMNS")
print("=" * 65)

missing_in_raw = [c for c in FEATURE_COLUMNS if c not in df.columns]
if missing_in_raw:
    print(f"\n  ERROR: Required columns missing from dataset: {missing_in_raw}")
    sys.exit(1)

dropped = [c for c in df.columns if c not in FEATURE_COLUMNS]
df      = df[FEATURE_COLUMNS].copy()

print(f"  Columns kept    : {len(df.columns)}  {df.columns.tolist()}")
print(f"  Columns dropped : {len(dropped)}  {dropped}")
print(f"  Shape after drop: {df.shape}  (expected 9,500 × 15)")


# ═══════════════════════════════════════════════════════════════════
# STEP 3 — HANDLE MISSING VALUES (MEDIAN IMPUTATION)
# Why: ML models cannot process NaN values. Median imputation is
#      robust to outliers and preserves the column distribution
#      better than mean when data is skewed.
# ═══════════════════════════════════════════════════════════════════

print("\n" + "=" * 65)
print("  STEP 3: HANDLE MISSING VALUES (MEDIAN IMPUTATION)")
print("=" * 65)

missing_counts = df.isnull().sum()
missing_cols   = missing_counts[missing_counts > 0]

if missing_cols.empty:
    print("  No missing values found — dataset is already clean.")
else:
    print(f"  {'Column':<34} {'Missing':>8} {'Median Used':>12}")
    print(f"  {'─' * 56}")
    for col, cnt in missing_cols.items():
        med = df[col].median()
        df[col] = df[col].fillna(med)
        print(f"  {col:<34} {cnt:>8,} {med:>12.4f}")

total_remaining = df.isnull().sum().sum()
print(f"\n  Total nulls remaining: {total_remaining}")
print("  All missing values resolved.")


# ═══════════════════════════════════════════════════════════════════
# STEP 4 — CREATE TARGET 1: career_readiness_score  (Regression)
# Why: The raw dataset has no readiness score. We derive it from
#      domain-weighted feature contributions with small Gaussian
#      noise to simulate real-world measurement variability.
# ═══════════════════════════════════════════════════════════════════

print("\n" + "=" * 65)
print("  STEP 4: CREATE TARGET 1 — career_readiness_score")
print("=" * 65)


def derive_career_readiness(row):
    score = 0
    # Academic (40 %)
    score += (row['gpa_cumulative'] / 4.0)                   * 20
    score += (row['project_performance'] / 100)              * 15
    score += row['assignment_completion_rate']                * 5
    # Behavioral (30 %)
    score += row['attendance_rate']                          * 10
    score += (min(row['weekly_study_hours'], 40) / 40)       * 10
    score += (1 - min(row['part_time_work_hours'], 30) / 30) * 5
    score += (row['sleep_hours_avg'] / 10)                   * 5
    # Emotional (15 %)
    score += (1 - row['stress_level'] / 100)                 * 5
    score += (row['mood_stability'] / 100)                   * 5
    score += (1 - row['anxiety_score'] / 25)                 * 5
    # Career (15 %)
    score += (row['career_clarity_score'] / 100)             * 15
    noise  = np.random.normal(0, 1.5)
    return round(float(np.clip(score + noise, 30, 100)), 1)


np.random.seed(42)
df['career_readiness_score'] = df.apply(derive_career_readiness, axis=1)

desc = df['career_readiness_score'].describe()
print("  career_readiness_score statistics:")
for stat in ['min', 'max', 'mean', 'std']:
    print(f"    {stat:<6}: {desc[stat]:.4f}")
print(f"  All values in [30, 100]: "
      f"{(df['career_readiness_score'] >= 30).all() and (df['career_readiness_score'] <= 100).all()}")


# ═══════════════════════════════════════════════════════════════════
# STEP 5 — CREATE TARGET 2: academic_risk_level  (Classification)
# Why: Rule-based scoring with 12 % borderline noise prevents
#      circular label leakage — the model cannot perfectly
#      reverse-engineer the rules from the features.
# ═══════════════════════════════════════════════════════════════════

print("\n" + "=" * 65)
print("  STEP 5: CREATE TARGET 2 — academic_risk_level")
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

    # ── CHANGE THIS SECTION ──────────────────────────────
    # OLD: 12% noise on borderline only (score 3-6)
    # NEW: 30% noise on ALL cases, wider score range
    
    noise_chance = random.random()
    
    if score <= 3:                    # clear Low — small noise
        if noise_chance < 0.15:
            score += random.choice([1, 2])
            
    elif 4 <= score <= 6:             # borderline — heavy noise  
        if noise_chance < 0.30:
            score += random.choice([-3, -2, 2, 3])
            
    elif score >= 7:                  # clear High — small noise
        if noise_chance < 0.15:
            score += random.choice([-2, -1])
    # ─────────────────────────────────────────────────────

    score = max(0, score)             # prevent negative scores

    if score >= 7:   return 'High'
    elif score >= 4: return 'Medium'
    else:            return 'Low'


df['academic_risk_level']   = df.apply(derive_academic_risk, axis=1)
df['academic_risk_encoded'] = df['academic_risk_level'].map(RISK_MAP)

risk_dist = df['academic_risk_level'].value_counts()
print("  Academic risk distribution:")
for label in ['Low', 'Medium', 'High']:
    n   = risk_dist.get(label, 0)
    pct = n / len(df) * 100
    print(f"    {label:6s}: {n:5,}  ({pct:.1f}%)")
print(f"\n  Encoding: {RISK_MAP}")
print(df[['academic_risk_level', 'academic_risk_encoded']].head(4).to_string(index=False))


# ═══════════════════════════════════════════════════════════════════
# STEP 6 — VERIFY CLEAN DATASET
# Why: Confirm all feature columns are numeric before attempting
#      scaling. A non-numeric column here would crash StandardScaler
#      with a cryptic error; catching it here gives a clear message.
# ═══════════════════════════════════════════════════════════════════

print("\n" + "=" * 65)
print("  STEP 6: VERIFY CLEAN DATASET")
print("=" * 65)

print(f"  df.shape : {df.shape}")
print(f"  Columns  : {df.columns.tolist()}")
print(f"\n  Feature dtypes:")
for col, dtype in df[FEATURE_COLUMNS].dtypes.items():
    print(f"    {col:<34} {dtype}")

non_numeric = df[FEATURE_COLUMNS].select_dtypes(exclude='number').columns.tolist()
if non_numeric:
    raise ValueError(f"Non-numeric columns found: {non_numeric}")
print("\n  All 15 feature columns are numeric — safe to scale.")


# ═══════════════════════════════════════════════════════════════════
# STEP 7 — CORRELATION ANALYSIS
# Why: Identify highly correlated feature pairs that could cause
#      multicollinearity in linear models. Features are retained
#      regardless — this is informational only.
# ═══════════════════════════════════════════════════════════════════

print("\n" + "=" * 65)
print("  STEP 7: CORRELATION ANALYSIS")
print("=" * 65)

corr_matrix = df[FEATURE_COLUMNS].corr()

fig, ax = plt.subplots(figsize=(16, 12))
sns.heatmap(
    corr_matrix, annot=False, cmap='coolwarm',
    center=0, linewidths=0.5, ax=ax
)
ax.set_title('Feature Correlation Matrix (15 Features)', fontsize=14, pad=14)
plt.tight_layout()
corr_path = PLOTS_DIR / 'correlation_matrix.png'
plt.savefig(corr_path, dpi=150)
plt.close()
print(f"  Heatmap saved : {corr_path}")

cols      = corr_matrix.columns.tolist()
high_corr = []
for i, col_i in enumerate(cols):
    for col_j in cols[i + 1:]:
        val = abs(corr_matrix.loc[col_i, col_j])
        if val > 0.80:
            high_corr.append((col_i, col_j, round(val, 3)))

if high_corr:
    print(f"\n  WARNING — {len(high_corr)} pair(s) with |r| > 0.80 (features retained):")
    for f1, f2, v in high_corr:
        print(f"    {f1}  <->  {f2}  :  {v}")
else:
    print("  No highly correlated pairs found (all |r| < 0.80).")


# ═══════════════════════════════════════════════════════════════════
# STEP 8 — EXTRACT STUDENT PROFILE HOLDOUT SET (200 ROWS)
# Why: Saved as ground-truth examples for post-training validation.
#      Must be removed before any split so the model never sees
#      these students during training or test evaluation.
# ═══════════════════════════════════════════════════════════════════

print("\n" + "=" * 65)
print("  STEP 8: EXTRACT STUDENT PROFILE HOLDOUT SET")
print("=" * 65)

df_profiles, df_main = train_test_split(
    df, train_size=200, random_state=99, stratify=df['academic_risk_encoded']
)
df_profiles = df_profiles.reset_index(drop=True)
df_main     = df_main.reset_index(drop=True)

profile_dist = df_profiles['academic_risk_level'].value_counts()
print(f"  Profile holdout  : {len(df_profiles):,} rows  (random_state=99, stratified)")
print(f"  Remaining for ML : {len(df_main):,} rows  (expected 9,300)")
print("  Profile class distribution:")
for label in ['Low', 'Medium', 'High']:
    n = profile_dist.get(label, 0)
    print(f"    {label:6s} → {n:3} rows")

profile_csv_path = PROFILES_DIR / 'student_profiles.csv'
df_profiles.to_csv(profile_csv_path, index=False)
print(f"\n  ✓  CSV saved : {profile_csv_path}  {df_profiles.shape}")

profile_pkl_path = SAVED_DIR / 'student_profiles.pkl'
joblib.dump(df_profiles, profile_pkl_path)
loaded_chk = joblib.load(profile_pkl_path)
print(f"  ✓  PKL saved : {profile_pkl_path}  verified {loaded_chk.shape}")


# ═══════════════════════════════════════════════════════════════════
# STEP 9 — SEPARATE FEATURES AND TARGETS
# Why: Isolate the 15-column feature matrix and two target vectors
#      so train/test split can be applied independently per task.
# ═══════════════════════════════════════════════════════════════════

print("\n" + "=" * 65)
print("  STEP 9: SEPARATE FEATURES AND TARGETS")
print("=" * 65)

X        = df_main[FEATURE_COLUMNS].copy()
y_risk   = df_main['academic_risk_encoded']
y_career = df_main['career_readiness_score']

print(f"  X (features) : {X.shape}")
print(f"  y_risk       : {y_risk.shape}  classes {sorted(y_risk.unique())}")
print(f"  y_career     : {y_career.shape}  "
      f"range [{y_career.min():.1f}, {y_career.max():.1f}]")


# ═══════════════════════════════════════════════════════════════════
# STEP 10 — TRAIN/TEST SPLIT
# Why: Stratified split on y_risk ensures each split contains the
#      same proportion of Low/Medium/High, preventing evaluation
#      bias from a skewed test set.
# ═══════════════════════════════════════════════════════════════════

print("\n" + "=" * 65)
print("  STEP 10: TRAIN/TEST SPLIT")
print("=" * 65)

X_train_r, X_test_r, y_train_r, y_test_r = train_test_split(
    X, y_risk, test_size=0.2, random_state=42, stratify=y_risk
)
X_train_c, X_test_c, y_train_c, y_test_c = train_test_split(
    X, y_career, test_size=0.2, random_state=42
)

print(f"  Risk   — Train: {X_train_r.shape}  | Test: {X_test_r.shape}")
print(f"  Career — Train: {X_train_c.shape}  | Test: {X_test_c.shape}")
print(f"  (expected ~7,440 train / ~1,860 test)")


# ═══════════════════════════════════════════════════════════════════
# STEP 11 — SCALE FEATURES
# Why: StandardScaler normalises each feature to mean=0, std=1.
#      Fitted on training data ONLY to prevent test-set statistics
#      from leaking into the scaler's mean/std parameters.
# ═══════════════════════════════════════════════════════════════════

print("\n" + "=" * 65)
print("  STEP 11: SCALE FEATURES")
print("=" * 65)

scaler = StandardScaler()
X_train_r_scaled = pd.DataFrame(
    scaler.fit_transform(X_train_r), columns=FEATURE_COLUMNS
)
X_test_r_scaled  = pd.DataFrame(
    scaler.transform(X_test_r), columns=FEATURE_COLUMNS
)
X_train_c_scaled = pd.DataFrame(
    scaler.transform(X_train_c), columns=FEATURE_COLUMNS
)
X_test_c_scaled  = pd.DataFrame(
    scaler.transform(X_test_c), columns=FEATURE_COLUMNS
)

print(f"  Scaler fitted on X_train_r only ({X_train_r.shape})")
print(f"  Risk   scaled — train: {X_train_r_scaled.shape}  | test: {X_test_r_scaled.shape}")
print(f"  Career scaled — train: {X_train_c_scaled.shape}  | test: {X_test_c_scaled.shape}")

# ═══════════════════════════════════════════════════════════════════
# STEP 3B — ADD FEATURE NOISE (simulate real-world measurement error)
# Why: Synthetic data is mathematically perfect. Real student data
#      has survey errors, recording mistakes, and natural variation.
#      Adding controlled noise prevents models from finding perfect
#      decision boundaries and forces more realistic accuracy.
# ═══════════════════════════════════════════════════════════════════

print("\n" + "=" * 65)
print("  STEP 3B: ADDING FEATURE-LEVEL NOISE")
print("=" * 65)

np.random.seed(123)

# Noise levels per feature (as % of each feature's std deviation)
# Higher = more noise = harder for model to find clean boundaries
NOISE_LEVELS = {
    'gpa_cumulative'            : 0.05,  # 5% std noise
    'gpa_trend'                 : 0.10,
    'assignment_completion_rate': 0.08,
    'late_submission_rate'      : 0.08,
    'resit_count'               : 0.05,
    'project_performance'       : 0.08,
    'attendance_rate'           : 0.08,
    'weekly_study_hours'        : 0.10,
    'sleep_hours_avg'           : 0.08,
    'sleep_consistency'         : 0.08,
    'part_time_work_hours'      : 0.10,
    'stress_level'              : 0.10,
    'anxiety_score'             : 0.10,
    'mood_stability'            : 0.10,
    'career_clarity_score'      : 0.08,
}

for col, noise_pct in NOISE_LEVELS.items():
    col_std  = df[col].std()
    noise    = np.random.normal(0, col_std * noise_pct, size=len(df))
    df[col]  = df[col] + noise

# Clip features back to valid ranges after noise
df['gpa_cumulative']             = df['gpa_cumulative'].clip(0.0, 4.0)
df['gpa_trend']                  = df['gpa_trend'].clip(-2.0, 2.0)
df['assignment_completion_rate'] = df['assignment_completion_rate'].clip(0.0, 1.0)
df['late_submission_rate']       = df['late_submission_rate'].clip(0.0, 1.0)
df['resit_count']                = df['resit_count'].clip(0).round().astype(int)
df['project_performance']        = df['project_performance'].clip(0, 100)
df['attendance_rate']            = df['attendance_rate'].clip(0.0, 1.0)
df['weekly_study_hours']         = df['weekly_study_hours'].clip(0, 80)
df['sleep_hours_avg']            = df['sleep_hours_avg'].clip(3.0, 12.0)
df['sleep_consistency']          = df['sleep_consistency'].clip(0.0, 1.0)
df['part_time_work_hours']       = df['part_time_work_hours'].clip(0, 40)
df['stress_level']               = df['stress_level'].clip(0, 100)
df['anxiety_score']              = df['anxiety_score'].clip(0, 25)
df['mood_stability']             = df['mood_stability'].clip(0, 100)
df['career_clarity_score']       = df['career_clarity_score'].clip(0, 100)

print("  Noise added to all 15 features (5-10% of each feature std)")
print("  All features clipped back to valid ranges")
print(f"  Shape unchanged: {df.shape}")


# ═══════════════════════════════════════════════════════════════════
# STEP 12 — FIX CLASS IMBALANCE WITH SMOTE
# Why: SMOTE synthesises new minority-class examples by interpolating
#      between existing ones in feature space. Applied ONLY to the
#      training set — test data must reflect real class proportions.
# ═══════════════════════════════════════════════════════════════════

print("\n" + "=" * 65)
print("  STEP 12: FIX CLASS IMBALANCE WITH SMOTE")
print("=" * 65)

before_counts = pd.Series(y_train_r.values).value_counts().sort_index()
print("  Before SMOTE:")
for code, cnt in before_counts.items():
    print(f"    {RISK_NAMES[code]:6s} (class {code}): {cnt:,}")

smote = SMOTE(random_state=42)
X_train_r_balanced, y_train_r_balanced = smote.fit_resample(
    X_train_r_scaled, y_train_r
)

after_counts = pd.Series(y_train_r_balanced).value_counts().sort_index()
print("  After SMOTE:")
for code, cnt in after_counts.items():
    print(f"    {RISK_NAMES[code]:6s} (class {code}): {cnt:,}")
print("  All three classes balanced.")


# ═══════════════════════════════════════════════════════════════════
# STEP 13 — SAVE ALL OBJECTS
# Why: Downstream scripts load these pkl files instead of re-running
#      preprocessing. Each file is verified immediately after saving.
# ═══════════════════════════════════════════════════════════════════

print("\n" + "=" * 65)
print("  STEP 13: SAVE ALL OBJECTS")
print("=" * 65)

save_targets = {
    'scaler.pkl'         : scaler,
    'feature_columns.pkl': FEATURE_COLUMNS,
    'risk_train.pkl'     : (X_train_r_balanced, y_train_r_balanced),
    'risk_test.pkl'      : (X_test_r_scaled,    y_test_r),
    'career_train.pkl'   : (X_train_c_scaled,   y_train_c),
    'career_test.pkl'    : (X_test_c_scaled,    y_test_c),
}

print(f"  Saving to: {SAVED_DIR}\n")
for filename, obj in save_targets.items():
    path = SAVED_DIR / filename
    joblib.dump(obj, path)
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


# ═══════════════════════════════════════════════════════════════════
# STEP 14 — FINAL SUMMARY
# ═══════════════════════════════════════════════════════════════════

SEP = "═" * 51
after_str = '  |  '.join(
    f"{RISK_NAMES[k]}={v}" for k, v in after_counts.items()
)

print("\n" + SEP)
print("  PREPROCESSING COMPLETE — SUMMARY")
print(SEP)
print(f"  Original dataset    : 9,500 rows × 27 columns")
print(f"  After dropping cols : {df_main.shape[0] + 200:,} rows × {len(FEATURE_COLUMNS)} features")
print(f"  Missing values fixed: Yes (median imputation)")
print(f"  Targets created     : career_readiness_score (regression)")
print(f"                        academic_risk_level (classification)")
print(f"  Profile holdout     : 200 rows (saved separately)")
print(f"  Training rows       : {len(X_train_r_balanced):,}  (post-SMOTE, risk model)")
print(f"  Test rows           : {len(X_test_r_scaled):,}")
print(f"  Features            : {len(FEATURE_COLUMNS)}")
for domain, cols in FEATURE_DOMAINS.items():
    print(f"    {domain.capitalize():10s} ({len(cols)}): {', '.join(cols)}")
print(f"  Class balance (after SMOTE):")
print(f"    {after_str}")
print(f"  Saved objects       : {SAVED_DIR}")
print(f"  Profile CSV         : {profile_csv_path}")
print(f"  Correlation plot    : {corr_path}")
print(SEP)
print("  Ready for model_training.py")
print(SEP)
