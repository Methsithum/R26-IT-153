# EXECUTION ORDER: 1. dataset_preprocessing.py  2. model_training.py  3. test_inference.py
import warnings
import joblib
import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.exceptions import InconsistentVersionWarning

# ── Paths (resolved relative to this file — works on any machine) ──────────────
BASE_DIR  = Path(__file__).resolve().parent
SAVED_DIR = (BASE_DIR / '..' / '..' / 'trained-models'
             / 'career-prediction-engine' / 'saved_objects').resolve()

print(f"Loading saved models and objects from:\n  {SAVED_DIR}\n")

# ── Load with sklearn version mismatch detection ───────────────────────────────
# Converting InconsistentVersionWarning to an error lets us intercept it,
# print an actionable message, then reload without the guard.
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

risk_label = {0: 'Low', 1: 'Medium', 2: 'High'}

print(f"Features expected by model: {feature_cols}")
print(f"Total features: {len(feature_cols)}\n")

# ── Sample student — HIGH RISK ─────────────────────────────────────────────────
student_high_risk = {
    # Academic (6)
    'gpa_cumulative'            : 2.4,
    'gpa_trend'                 : -0.4,
    'assignment_completion_rate': 0.45,
    'late_submission_rate'      : 0.55,
    'resit_count'               : 2,
    'project_performance'       : 55,
    # Behavioral (5)
    'attendance_rate'           : 0.52,
    'weekly_study_hours'        : 8,
    'sleep_hours_avg'           : 5.2,
    'sleep_consistency'         : 0.4,
    'part_time_work_hours'      : 20,
    # Emotional (3)
    'stress_level'              : 78,
    'anxiety_score'             : 19,
    'mood_stability'            : 30,
    # Career (1)
    'career_clarity_score'      : 20,
}

# ── Sample student — LOW RISK ──────────────────────────────────────────────────
student_low_risk = {
    # Academic (6)
    'gpa_cumulative'            : 3.8,
    'gpa_trend'                 : 0.3,
    'assignment_completion_rate': 0.95,
    'late_submission_rate'      : 0.05,
    'resit_count'               : 0,
    'project_performance'       : 88,
    # Behavioral (5)
    'attendance_rate'           : 0.92,
    'weekly_study_hours'        : 25,
    'sleep_hours_avg'           : 7.5,
    'sleep_consistency'         : 0.85,
    'part_time_work_hours'      : 5,
    # Emotional (3)
    'stress_level'              : 30,
    'anxiety_score'             : 7,
    'mood_stability'            : 75,
    # Career (1)
    'career_clarity_score'      : 80,
}


def predict_student(student_data, label='Student'):
    df_student = pd.DataFrame([student_data])[feature_cols]
    scaled     = scaler.transform(df_student)

    risk_pred   = risk_model.predict(scaled)[0]
    risk_proba  = risk_model.predict_proba(scaled)[0]
    career_pred = career_model.predict(scaled)[0]

    print(f"\n{'=' * 50}")
    print(f"  PREDICTION RESULTS — {label}")
    print(f"{'=' * 50}")
    print(f"  Academic Risk Level    : {risk_label[risk_pred]}")
    print(f"  Risk Probabilities     :")
    print(f"    Low    → {risk_proba[0]*100:.1f}%")
    print(f"    Medium → {risk_proba[1]*100:.1f}%")
    print(f"    High   → {risk_proba[2]*100:.1f}%")
    print(f"  Career Readiness Score : {career_pred:.1f} / 100")
    print(f"{'=' * 50}")


# ── Run predictions on both test students ─────────────────────────────────────
predict_student(student_high_risk, label='HIGH RISK STUDENT')
predict_student(student_low_risk,  label='LOW RISK STUDENT')
