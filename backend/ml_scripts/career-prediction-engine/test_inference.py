import joblib
import pandas as pd
import numpy as np

# ── Load saved objects ──
BASE = "D:/R26-IT-153/backend/trained-models/career-prediction-engine/saved_objects/"
print("Loading saved models and objects..." + BASE)


scaler       = joblib.load(BASE + "scaler.pkl")
feature_cols = joblib.load(BASE + "feature_columns.pkl")
risk_model   = joblib.load(BASE + "model_A_risk_xgboost.pkl")
career_model = joblib.load(BASE + "model_B_career_xgboost.pkl")

risk_label   = {0: "Low", 1: "Medium", 2: "High"}

# Sample student data for testing
student = {
    "gpa_cumulative"            : 2.4,   # low GPA
    "gpa_trend"                 : -0.4,  # declining
    "module_avg_score"          : 90,
    "module_score_variance"     : 22,
    "project_performance"       : 55,
    "assignment_completion_rate": 0.45,  # low
    "late_submission_rate"      : 0.55,  # high
    "resit_count"               : 2,     # failed before
    "lms_login_frequency"       : 5,
    "weekly_study_hours"        : 8,
    "attendance_rate"           : 0.52,  # low
    "sleep_hours_avg"           : 5.2,
    "sleep_consistency"         : 0.4,
    "extracurricular_hours"     : 1,
    "part_time_work_hours"      : 20,
    "library_resource_usage"    : 2,
    "peer_collaboration_score"  : 30,
    "help_seeking_behavior"     : 1,
    "stress_level"              : 78,
    "anxiety_score"             : 19,
    "mood_stability"            : 30,
    "motivation_score"          : 25,
    "social_support_score"      : 28,
    "sense_of_belonging"        : 30,
    "career_clarity_score"      : 20,
}


# ── Predict ──
df_student  = pd.DataFrame([student])[feature_cols]
scaled      = scaler.transform(df_student)

risk_pred   = risk_model.predict(scaled)[0]
risk_proba  = risk_model.predict_proba(scaled)[0]
career_pred = career_model.predict(scaled)[0]

# ── Output ──
print("\n" + "=" * 45)
print("  STUDENT PREDICTION RESULTS")
print("=" * 45)
print(f"  Academic Risk Level   : {risk_label[risk_pred]}")
print(f"  Risk Probabilities    :")
print(f"    Low    → {risk_proba[0]*100:.1f}%")
print(f"    Medium → {risk_proba[1]*100:.1f}%")
print(f"    High   → {risk_proba[2]*100:.1f}%")
print(f"  Career Readiness Score: {career_pred:.1f} / 100")
print("=" * 45)
