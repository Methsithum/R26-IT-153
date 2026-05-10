"""
EXECUTION ORDER: 1. dataset_preprocessing.py  2. model_training.py  3. test_inference.py
PRODUCES:
  Part A — Formatted prediction cards for 3 manually defined students
  Part B — Batch accuracy summary over the 200-row profile holdout set
"""

import warnings
import joblib
import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.exceptions import InconsistentVersionWarning


# =============================================================================
# PATH SETUP & MODEL LOADING
# =============================================================================

BASE_DIR     = Path(__file__).resolve().parent
TRAINED_DIR  = (BASE_DIR / '..' / '..' / 'trained-models'
                / 'career-prediction-engine').resolve()
SAVED_DIR    = TRAINED_DIR / 'saved_objects'
PROFILES_DIR = TRAINED_DIR / 'student_profiles'

print("Loading saved models and objects...")
warnings.filterwarnings('error', category=InconsistentVersionWarning)


def _safe_load(filename):
    path = SAVED_DIR / filename
    try:
        return joblib.load(path)
    except InconsistentVersionWarning:
        print(f"WARNING: sklearn version mismatch loading '{filename}'.")
        print("  Retrain models or align sklearn versions.")
        warnings.filterwarnings('ignore', category=InconsistentVersionWarning)
        return joblib.load(path)


scaler       = _safe_load('scaler.pkl')
feature_cols = _safe_load('feature_columns.pkl')
risk_model   = _safe_load('model_A_risk_xgboost.pkl')
career_model = _safe_load('model_B_career_xgboost.pkl')

warnings.filterwarnings('default', category=InconsistentVersionWarning)

RISK_LABEL = {0: 'Low', 1: 'Medium', 2: 'High'}

print(f"  Loaded from : {SAVED_DIR}")
print(f"  Features    : {len(feature_cols)}")


# =============================================================================
# PART A — MANUAL STUDENT PREDICTIONS
# =============================================================================

# ── Student 1: HIGH RISK ──────────────────────────────────────────────────────
student_1 = {
    'gpa_cumulative'            : 2.2,
    'gpa_trend'                 : -0.5,
    'assignment_completion_rate': 0.42,
    'late_submission_rate'      : 0.58,
    'resit_count'               : 2,
    'project_performance'       : 52,
    'attendance_rate'           : 0.50,
    'weekly_study_hours'        : 7,
    'sleep_hours_avg'           : 5.0,
    'sleep_consistency'         : 0.35,
    'part_time_work_hours'      : 22,
    'stress_level'              : 80,
    'anxiety_score'             : 20,
    'mood_stability'            : 28,
    'career_clarity_score'      : 18,
}

# ── Student 2: MEDIUM RISK (borderline / average) ─────────────────────────────
student_2 = {
    'gpa_cumulative'            : 2.9,
    'gpa_trend'                 : -0.1,
    'assignment_completion_rate': 0.68,
    'late_submission_rate'      : 0.25,
    'resit_count'               : 1,
    'project_performance'       : 72,
    'attendance_rate'           : 0.70,
    'weekly_study_hours'        : 20,
    'sleep_hours_avg'           : 6.0,
    'sleep_consistency'         : 0.65,
    'part_time_work_hours'      : 14,
    'stress_level'              : 52,
    'anxiety_score'             : 12,
    'mood_stability'            : 45,
    'career_clarity_score'      : 50,
}

# ── Student 3: LOW RISK ───────────────────────────────────────────────────────
student_3 = {
    'gpa_cumulative'            : 3.9,
    'gpa_trend'                 : 0.4,
    'assignment_completion_rate': 0.97,
    'late_submission_rate'      : 0.04,
    'resit_count'               : 0,
    'project_performance'       : 91,
    'attendance_rate'           : 0.95,
    'weekly_study_hours'        : 28,
    'sleep_hours_avg'           : 7.8,
    'sleep_consistency'         : 0.88,
    'part_time_work_hours'      : 4,
    'stress_level'              : 22,
    'anxiety_score'             : 5,
    'mood_stability'            : 82,
    'career_clarity_score'      : 85,
}


def predict_student(student_data, label='Student'):
    df_s    = pd.DataFrame([student_data])[feature_cols]
    scaled  = scaler.transform(df_s)

    risk_pred   = risk_model.predict(scaled)[0]
    risk_proba  = risk_model.predict_proba(scaled)[0]
    career_pred = career_model.predict(scaled)[0]

    print(f"\n{'=' * 62}")
    print(f"  STUDENT PROFILE — {label}")
    print(f"{'=' * 62}")
    print("  INPUT FEATURES:")
    for feat, val in student_data.items():
        print(f"    {feat:<34} : {val}")
    print(f"  {'─' * 58}")
    print("  PREDICTIONS:")
    print(f"    Academic Risk Level    : {RISK_LABEL[risk_pred]}")
    print(f"    Risk Probabilities:")
    print(f"      Low    → {risk_proba[0] * 100:5.1f}%")
    print(f"      Medium → {risk_proba[1] * 100:5.1f}%")
    print(f"      High   → {risk_proba[2] * 100:5.1f}%")
    print(f"    Career Readiness Score : {career_pred:.1f} / 100")
    print(f"{'=' * 62}")


print("\n" + "=" * 62)
print("  PART A — MANUAL STUDENT PREDICTIONS (3 STUDENTS)")
print("=" * 62)

predict_student(student_1, label='HIGH RISK STUDENT')
predict_student(student_2, label='MEDIUM RISK STUDENT')
predict_student(student_3, label='LOW RISK STUDENT')


# =============================================================================
# PART B — BATCH PROFILE TESTING (200-ROW HOLDOUT)
# =============================================================================

# print("\n" + "=" * 62)
# print("  PART B — BATCH PROFILE TESTING (200 PROFILES)")
# print("=" * 62)

# profile_csv = PROFILES_DIR / 'student_profiles.csv'
# if not profile_csv.exists():
#     print(f"\n  WARNING: {profile_csv} not found.")
#     print("  Run dataset_preprocessing.py first to generate the profile set.")
# else:
#     df_p = pd.read_csv(profile_csv)
#     print(f"\n  Loaded : {profile_csv}")
#     print(f"  Shape  : {df_p.shape}")

#     scaled_p     = scaler.transform(df_p[feature_cols])
#     risk_preds   = risk_model.predict(scaled_p)
#     risk_probas  = risk_model.predict_proba(scaled_p)
#     career_preds = career_model.predict(scaled_p)

#     actual_risk_int = df_p['academic_risk_encoded'].values
#     actual_labels   = [RISK_LABEL[r] for r in actual_risk_int]
#     pred_labels     = [RISK_LABEL[r] for r in risk_preds]
#     correct_mask    = [a == p for a, p in zip(actual_labels, pred_labels)]

#     total         = len(df_p)
#     n_correct     = sum(correct_mask)
#     accuracy      = n_correct / total
#     actual_career = df_p['career_readiness_score'].values
#     career_errors = np.abs(career_preds - actual_career)

#     print(f"\n  Total profiles tested       : {total}")
#     print(f"  Risk Accuracy               : {accuracy:.4f}  ({n_correct}/{total} correct)")
#     print(f"  Career MAE (mean abs error) : {career_errors.mean():.4f}")
#     print(f"  Career error range          : [{career_errors.min():.2f}, {career_errors.max():.2f}]")

#     correct_idx   = [i for i, ok in enumerate(correct_mask) if ok]
#     incorrect_idx = [i for i, ok in enumerate(correct_mask) if not ok]

#     # ── 5 correct predictions ─────────────────────────────────────────────────
#     print(f"\n  5 CORRECT PREDICTIONS")
#     print(f"  {'─' * 60}")
#     print(f"  {'#':>4}  {'Actual':8} {'Predicted':10}  "
#           f"{'Actual Career':14} {'Pred Career':11}")
#     print(f"  {'─' * 60}")
#     for i in correct_idx[:5]:
#         print(f"  {i + 1:>4}  {actual_labels[i]:8} {pred_labels[i]:10}  "
#               f"{actual_career[i]:14.2f} {career_preds[i]:11.2f}")

#     # ── 5 incorrect predictions ───────────────────────────────────────────────
#     print(f"\n  5 INCORRECT PREDICTIONS")
#     print(f"  {'─' * 60}")
#     print(f"  {'#':>4}  {'Actual':8} {'Predicted':10}  "
#           f"{'Actual Career':14} {'Pred Career':11}")
#     print(f"  {'─' * 60}")
#     for i in incorrect_idx[:5]:
#         print(f"  {i + 1:>4}  {actual_labels[i]:8} {pred_labels[i]:10}  "
#               f"{actual_career[i]:14.2f} {career_preds[i]:11.2f}")

#     # ── Career error summary ──────────────────────────────────────────────────
#     print(f"\n  CAREER SCORE PREDICTION ERROR SUMMARY")
#     print(f"  {'─' * 42}")
#     print(f"    Mean  : {career_errors.mean():.4f}")
#     print(f"    Min   : {career_errors.min():.4f}")
#     print(f"    Max   : {career_errors.max():.4f}")

#     print("\n" + "=" * 62)
#     print("  Profile batch testing complete.")
#     print("=" * 62)
