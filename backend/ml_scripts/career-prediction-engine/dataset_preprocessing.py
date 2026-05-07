# =============================================================================
# FILE: data_preprocessing.py
# PROJECT: Integrated Future & Career Prediction Engine
# DESCRIPTION: Full preprocessing pipeline — cleans, encodes, scales,
#              engineers targets, and balances the student dataset.
# =============================================================================

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import joblib
import os
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from imblearn.over_sampling import SMOTE

# =============================================================================
# SECTION 1 — LOAD DATASET
# =============================================================================

print("=" * 60)
print("  STEP 1: LOADING DATASET")
print("=" * 60)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(BASE_DIR, "..", "..", "datasets", "career-prediction-engine", "student_dataset.xls")
data_set = pd.read_excel(DATASET_PATH)

print(f"Raw dataset shape : {data_set.shape}")
print(f"Columns           : {data_set.columns.tolist()}")


# =============================================================================
# SECTION 2 — REMOVE UNSUITABLE COLUMNS
# =============================================================================

print("\n" + "=" * 60)
print("  STEP 2: REMOVING UNSUITABLE COLUMNS")
print("=" * 60)

cols_to_remove = ["student_id", "burnout_risk_level", "screen_time_non_study"]
new_data_set = data_set.drop(columns=cols_to_remove)

print(f"Removed columns   : {cols_to_remove}")
print(f"New shape         : {new_data_set.shape}")


# =============================================================================
# SECTION 3 — ENGINEER TARGET 2: ACADEMIC RISK LEVEL
# =============================================================================

print("\n" + "=" * 60)
print("  STEP 3: ENGINEERING ACADEMIC RISK LEVEL (TARGET 2)")
print("=" * 60)

def derive_academic_risk(row):
    """
    Derives academic risk level from rule-based scoring.
    Uses 5 key academic/behavioral indicators.
    
    Returns: 'Low', 'Medium', or 'High'
    """
    score = 0

    # GPA scoring — lower GPA = higher risk
    if row['gpa_cumulative'] < 2.5:
        score += 3
    elif row['gpa_cumulative'] < 3.0:
        score += 2
    elif row['gpa_cumulative'] < 3.3:
        score += 1

    # GPA trend — declining GPA = higher risk
    if row['gpa_trend'] < -0.3:
        score += 2
    elif row['gpa_trend'] < 0:
        score += 1

    # Resit count — more resits = higher risk
    if row['resit_count'] >= 2:
        score += 3
    elif row['resit_count'] == 1:
        score += 1

    # Attendance rate — low attendance = higher risk
    if row['attendance_rate'] < 0.6:
        score += 2
    elif row['attendance_rate'] < 0.75:
        score += 1

    # Assignment completion — low completion = higher risk
    if row['assignment_completion_rate'] < 0.5:
        score += 2
    elif row['assignment_completion_rate'] < 0.7:
        score += 1

    # Final classification
    if score >= 7:
        return 'High'
    elif score >= 4:
        return 'Medium'
    else:
        return 'Low'

new_data_set = new_data_set.copy()
new_data_set['academic_risk_level'] = new_data_set.apply(derive_academic_risk, axis=1)

print("Academic risk level distribution:")
print(new_data_set['academic_risk_level'].value_counts())
print(f"\nDataset shape after engineering: {new_data_set.shape}")


# =============================================================================
# SECTION 4 — MISSING VALUE CHECK
# =============================================================================

print("\n" + "=" * 60)
print("  STEP 4: MISSING VALUE CHECK")
print("=" * 60)

df = new_data_set.copy()

missing      = df.isnull().sum()
missing_pct  = (missing / len(df)) * 100
missing_report = pd.DataFrame({
    'Missing Count': missing,
    'Missing %'    : missing_pct
}).query('`Missing Count` > 0')

if missing_report.empty:
    print("No missing values found — dataset is clean.")
else:
    print("Missing values detected — handling required:")
    print(missing_report)
    # Auto-fill numeric columns with median (safe default)
    for col in missing_report.index:
        if df[col].dtype in ['float64', 'int64']:
            df[col].fillna(df[col].median(), inplace=True)
            print(f"   Filled '{col}' with median.")


# =============================================================================
# SECTION 5 — ENCODE TARGET LABEL
# =============================================================================

print("\n" + "=" * 60)
print("  STEP 5: ENCODING ACADEMIC RISK LEVEL")
print("=" * 60)

risk_map = {'Low': 0, 'Medium': 1, 'High': 2}
df['academic_risk_encoded'] = df['academic_risk_level'].map(risk_map)

print("Encoding mapping  : Low=0 | Medium=1 | High=2")
print("Encoding check:")
print(df[['academic_risk_level', 'academic_risk_encoded']].value_counts())


# =============================================================================
# SECTION 6 — SEPARATE FEATURES & TARGETS
# =============================================================================

print("\n" + "=" * 60)
print("  STEP 6: SEPARATING FEATURES AND TARGETS")
print("=" * 60)

# X — Input features (25 columns)
X = df.drop(columns=[
    'academic_risk_level',    # text version of target
    'academic_risk_encoded',  # numeric version of target
    'career_readiness_score'  # Target 2 — separate model
])

# Target 1 — Classification: Academic Risk Level
y_risk = df['academic_risk_encoded']

# Target 2 — Regression: Career Readiness Score
y_career = df['career_readiness_score']

print(f"Features (X)        : {X.shape}  — {X.columns.tolist()}")
print(f"Risk target         : {y_risk.shape}")
print(f"Career target       : {y_career.shape}")

# Confirm no string columns remain
non_numeric = X.select_dtypes(exclude=['number']).columns.tolist()
if non_numeric:
    print(f"\nNon-numeric columns found in X: {non_numeric}")
else:
    print("\nAll feature columns are numeric — safe to scale.")


# =============================================================================
# SECTION 7 — CORRELATION ANALYSIS
# =============================================================================

print("\n" + "=" * 60)
print("  STEP 7: CORRELATION ANALYSIS")
print("=" * 60)

corr_matrix = X.corr()

plt.figure(figsize=(16, 12))
sns.heatmap(
    corr_matrix,
    annot=False,
    cmap='coolwarm',
    center=0,
    linewidths=0.5
)
plt.title('Feature Correlation Matrix', fontsize=16)
plt.tight_layout()
plt.savefig('correlation_matrix.png', dpi=150)
plt.show()
print("Correlation heatmap saved as 'correlation_matrix.png'")

# Find highly correlated pairs (threshold > 0.85 = danger zone)
high_corr = []
for i in range(len(corr_matrix.columns)):
    for j in range(i + 1, len(corr_matrix.columns)):
        val = abs(corr_matrix.iloc[i, j])
        if val > 0.85:
            high_corr.append({
                'Feature 1'  : corr_matrix.columns[i],
                'Feature 2'  : corr_matrix.columns[j],
                'Correlation': round(val, 3)
            })

if high_corr:
    print("\nHighly correlated pairs detected (consider dropping one):")
    print(pd.DataFrame(high_corr))
else:
    print("\nNo dangerous multicollinearity found (all pairs < 0.85).")


# =============================================================================
# SECTION 8 — TRAIN/TEST SPLIT + SCALING
# =============================================================================

print("\n" + "=" * 60)
print("  STEP 8: TRAIN/TEST SPLIT + FEATURE SCALING")
print("=" * 60)

# --- Split for RISK MODEL (Academic Risk Classification) ---
X_train_r, X_test_r, y_train_r, y_test_r = train_test_split(
    X, y_risk,
    test_size=0.2,
    random_state=42,
    stratify=y_risk     # preserves class ratio in both splits
)

# --- Split for CAREER MODEL (Career Readiness Regression) ---
X_train_c, X_test_c, y_train_c, y_test_c = train_test_split(
    X, y_career,
    test_size=0.2,
    random_state=42
)

# --- Scale features (fit ONLY on train, transform both) ---
scaler = StandardScaler()
X_train_r_scaled = pd.DataFrame(scaler.fit_transform(X_train_r), columns=X.columns)
X_test_r_scaled  = pd.DataFrame(scaler.transform(X_test_r),      columns=X.columns)

# Career model uses same scaler (already fitted on same X_train_r split)
X_train_c_scaled = pd.DataFrame(scaler.transform(X_train_c), columns=X.columns)
X_test_c_scaled  = pd.DataFrame(scaler.transform(X_test_c),  columns=X.columns)

print(f"Risk  — Train: {X_train_r_scaled.shape} | Test: {X_test_r_scaled.shape}")
print(f"Career — Train: {X_train_c_scaled.shape} | Test: {X_test_c_scaled.shape}")


# =============================================================================
# SECTION 9 — FIX CLASS IMBALANCE WITH SMOTE
# =============================================================================

print("\n" + "=" * 60)
print("  STEP 9: SMOTE — FIXING CLASS IMBALANCE")
print("=" * 60)

print("Before SMOTE (training set):")
print(pd.Series(y_train_r).value_counts().rename({0:'Low', 1:'Medium', 2:'High'}))

smote = SMOTE(random_state=42)
X_train_r_balanced, y_train_r_balanced = smote.fit_resample(
    X_train_r_scaled, y_train_r
)

print("\nAfter SMOTE (training set):")
print(pd.Series(y_train_r_balanced).value_counts().rename({0:'Low', 1:'Medium', 2:'High'}))
print("\nAll 3 classes balanced — model will treat each class equally.")


# =============================================================================
# SECTION 10 — SAVE ALL PREPROCESSED OBJECTS
# =============================================================================

print("\n" + "=" * 60)
print("  STEP 10: SAVING PREPROCESSED OBJECTS")
print("=" * 60)

SAVED_DIR = os.path.join(BASE_DIR, "saved_objects")
os.makedirs(SAVED_DIR, exist_ok=True)

# Save scaler (needed in simulation & model training)
joblib.dump(scaler, os.path.join(SAVED_DIR, "scaler.pkl"))

# Save feature column names (needed to rebuild DataFrames later)
joblib.dump(X.columns.tolist(), os.path.join(SAVED_DIR, "feature_columns.pkl"))

# Save all train/test splits
joblib.dump((X_train_r_balanced, y_train_r_balanced), os.path.join(SAVED_DIR, "risk_train.pkl"))
joblib.dump((X_test_r_scaled, y_test_r),              os.path.join(SAVED_DIR, "risk_test.pkl"))
joblib.dump((X_train_c_scaled, y_train_c),            os.path.join(SAVED_DIR, "career_train.pkl"))
joblib.dump((X_test_c_scaled, y_test_c),              os.path.join(SAVED_DIR, "career_test.pkl"))

print("Saved to 'saved_objects/' folder:")
print("  scaler.pkl")
print("  feature_columns.pkl")
print("  risk_train.pkl   | risk_test.pkl")
print("  career_train.pkl | career_test.pkl")


# =============================================================================
# SUMMARY
# =============================================================================

print("\n" + "=" * 60)
print("  PREPROCESSING COMPLETE — SUMMARY")
print("=" * 60)
print(f"  Total students       : 10,000")
print(f"  Features used        : {X.shape[1]}")
print(f"  Target 1             : academic_risk_level (Low / Medium / High)")
print(f"  Target 2             : career_readiness_score (regression)")
print(f"  Train / Test split   : 80% / 20%")
print(f"  Scaling method       : StandardScaler (mean=0, std=1)")
print(f"  Imbalance fix        : SMOTE (training data only)")
print(f"  Missing values       : None")
print(f"  Saved objects        : saved_objects/")
print("=" * 60)
print("Ready to move to model_training.py")
print("=" * 60)