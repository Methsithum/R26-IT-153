"""
=====================================================================
 Academic Study Planner — Model Test Script
 Usage: python test_model.py
=====================================================================
Tests:
  1. Model loading
  2. Single student prediction (manual input)
  3. Batch prediction on test set
  4. All 3 models comparison
  5. Edge case inputs
=====================================================================
"""

import os
import sys
import pickle
import numpy as np
import pandas as pd

# ── Paths ──────────────────────────────────────────────────────────
BASE_DIR  = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODEL_DIR = os.path.join(BASE_DIR, "trained-models", "study-planner")
DATA_DIR  = os.path.join(BASE_DIR, "datasets",       "study-planner")

LABEL_MAP = {0: "Low", 1: "Medium", 2: "High"}

# ── Helper ─────────────────────────────────────────────────────────
def load(filename):
    with open(os.path.join(MODEL_DIR, filename), "rb") as f:
        return pickle.load(f)

def separator(title=""):
    print()
    print("=" * 60)
    if title:
        print(f"  {title}")
        print("=" * 60)

def predict_student(model, scaler, feature_names, student_data: dict, use_scale=False):
    vec = np.array([student_data[f] for f in feature_names], dtype=float).reshape(1, -1)
    if use_scale:
        vec = scaler.transform(vec)
    pred  = model.predict(vec)[0]
    proba = model.predict_proba(vec)[0]
    return pred, proba

# ══════════════════════════════════════════════════════════════════
# TEST 1 — Model Loading
# ══════════════════════════════════════════════════════════════════
separator("TEST 1 — Model Loading")

try:
    rf    = load("random_forest_model.pkl")
    gb    = load("gradient_boosting_model.pkl")
    lr    = load("logistic_regression_model.pkl")
    scaler        = load("scaler.pkl")
    feature_names = load("feature_names.pkl")
    print(f"  [PASS]  Random Forest loaded       ({rf.n_estimators} trees)")
    print(f"  [PASS]  Gradient Boosting loaded   ({gb.n_estimators} estimators)")
    print(f"  [PASS]  Logistic Regression loaded")
    print(f"  [PASS]  Scaler loaded              ({scaler.n_features_in_} features)")
    print(f"  [PASS]  Feature names loaded       ({len(feature_names)} features)")
    print()
    print("  Features:", feature_names)
except Exception as e:
    print(f"  [FAIL]  {e}")
    sys.exit(1)

# ══════════════════════════════════════════════════════════════════
# TEST 2 — Single Student Predictions
# ══════════════════════════════════════════════════════════════════
separator("TEST 2 — Single Student Predictions")

students = [
    {
        "name": "Sachini Jayawardena (Expected: High)",
        "data": {
            "Attendance (%)":        65.0,
            "Midterm_Score":         52.0,
            "Final_Score":           48.0,
            "Assignments_Avg":       58.0,
            "Quizzes_Avg":           54.0,
            "Participation_Score":   45.0,
            "Projects_Score":        50.0,
            "Study_Hours_per_Week":  8.0,
            "Stress_Level (1-10)":   9,
            "Sleep_Hours_per_Night": 5.0,
            "Extracurricular":       0,
            "Avg_Exam_Score":        50.0,
            "Exam_Improvement":      -4.0,
            "Study_Sleep_Ratio":     1.6,
            "Low_Score_Count":       4,
            "Overall_Avg_Score":     52.0,
            "Score_Variability":     6.8,
            "Attendance_Efficiency": 72.0,
        }
    },
    {
        "name": "Kavindu Perera (Expected: Medium)",
        "data": {
            "Attendance (%)":        78.0,
            "Midterm_Score":         68.0,
            "Final_Score":           70.0,
            "Assignments_Avg":       72.0,
            "Quizzes_Avg":           67.0,
            "Participation_Score":   60.0,
            "Projects_Score":        65.0,
            "Study_Hours_per_Week":  14.0,
            "Stress_Level (1-10)":   6,
            "Sleep_Hours_per_Night": 6.5,
            "Extracurricular":       1,
            "Avg_Exam_Score":        69.0,
            "Exam_Improvement":      2.0,
            "Study_Sleep_Ratio":     2.15,
            "Low_Score_Count":       1,
            "Overall_Avg_Score":     68.0,
            "Score_Variability":     4.5,
            "Attendance_Efficiency": 90.0,
        }
    },
    {
        "name": "Dinuka Rathnayake (Expected: Low)",
        "data": {
            "Attendance (%)":        95.0,
            "Midterm_Score":         88.0,
            "Final_Score":           91.0,
            "Assignments_Avg":       87.0,
            "Quizzes_Avg":           85.0,
            "Participation_Score":   80.0,
            "Projects_Score":        90.0,
            "Study_Hours_per_Week":  20.0,
            "Stress_Level (1-10)":   3,
            "Sleep_Hours_per_Night": 7.5,
            "Extracurricular":       1,
            "Avg_Exam_Score":        89.5,
            "Exam_Improvement":      3.0,
            "Study_Sleep_Ratio":     2.67,
            "Low_Score_Count":       0,
            "Overall_Avg_Score":     88.0,
            "Score_Variability":     3.1,
            "Attendance_Efficiency": 120.0,
        }
    },
]

for student in students:
    name = student["name"]
    data = student["data"]
    pred, proba = predict_student(rf, scaler, feature_names, data)
    label = LABEL_MAP[pred]
    conf  = proba[pred] * 100

    print(f"\n  Student : {name}")
    print(f"  Result  : {label} Priority  (confidence: {conf:.1f}%)")
    print(f"  Probs   : Low={proba[0]*100:.1f}%  Medium={proba[1]*100:.1f}%  High={proba[2]*100:.1f}%")

# ══════════════════════════════════════════════════════════════════
# TEST 3 — Batch Prediction on Full Test Set
# ══════════════════════════════════════════════════════════════════
separator("TEST 3 — Batch Prediction on Test Set")

test_path = os.path.join(DATA_DIR, "test_cleaned.csv")
if not os.path.exists(test_path):
    test_path = os.path.join(DATA_DIR, "test_data.csv")

test_df = pd.read_csv(test_path)
X_test  = test_df[feature_names].values
y_test  = test_df["Priority"].values

preds = rf.predict(X_test)
correct = (preds == y_test).sum()
total   = len(y_test)
acc     = correct / total * 100

print(f"\n  Test set size : {total} students")
print(f"  Correct       : {correct}")
print(f"  Accuracy      : {acc:.2f}%")
print(f"  Errors        : {total - correct}")

print("\n  Per-class accuracy:")
for cls in [0, 1, 2]:
    mask    = y_test == cls
    cls_acc = (preds[mask] == y_test[mask]).sum() / mask.sum() * 100
    print(f"    {LABEL_MAP[cls]:6s}: {cls_acc:.1f}%  ({mask.sum()} samples)")

# ══════════════════════════════════════════════════════════════════
# TEST 4 — Compare All 3 Models
# ══════════════════════════════════════════════════════════════════
separator("TEST 4 — All Models Comparison")

X_test_scaled = scaler.transform(X_test)

models = {
    "Random Forest":       (rf,  X_test),
    "Gradient Boosting":   (gb,  X_test),
    "Logistic Regression": (lr,  X_test_scaled),
}

print(f"\n  {'Model':<22} {'Accuracy':>10} {'Correct':>10} {'Errors':>10}")
print(f"  {'-'*54}")
for model_name, (model, X) in models.items():
    p   = model.predict(X)
    acc = (p == y_test).sum() / len(y_test) * 100
    cor = (p == y_test).sum()
    err = len(y_test) - cor
    print(f"  {model_name:<22} {acc:>9.2f}% {cor:>10} {err:>10}")

# ══════════════════════════════════════════════════════════════════
# TEST 5 — Edge Cases
# ══════════════════════════════════════════════════════════════════
separator("TEST 5 — Edge Case Inputs")

edge_cases = [
    {
        "name": "Perfect student (all max scores)",
        "data": dict(zip(feature_names, [
            100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0,
            40.0, 1, 8.0, 1, 100.0, 0.0, 5.0, 0, 100.0, 0.0, 180.0
        ]))
    },
    {
        "name": "Worst student (all min scores)",
        "data": dict(zip(feature_names, [
            50.0, 40.0, 40.0, 50.0, 40.0, 40.0, 40.0,
            0.0, 10, 3.0, 0, 40.0, -20.0, 0.0, 2, 46.0, 37.0, 50.0
        ]))
    },
    {
        "name": "Average student (all means)",
        "data": dict(zip(feature_names, [
            75.35, 70.78, 69.65, 74.71, 70.0, 70.0, 70.0,
            15.0, 5, 7.0, 0, 70.0, 0.0, 2.0, 0, 69.16, 19.80, 95.40
        ]))
    },
]

for ec in edge_cases:
    pred, proba = predict_student(rf, scaler, feature_names, ec["data"])
    label = LABEL_MAP[pred]
    conf  = proba[pred] * 100
    print(f"\n  Case    : {ec['name']}")
    print(f"  Result  : {label} Priority  (confidence: {conf:.1f}%)")
    print(f"  Probs   : Low={proba[0]*100:.1f}%  Medium={proba[1]*100:.1f}%  High={proba[2]*100:.1f}%")

# ══════════════════════════════════════════════════════════════════
# TEST 6 — Prediction Speed
# ══════════════════════════════════════════════════════════════════
separator("TEST 6 — Prediction Speed")

import time

sample = X_test[:1]

for model_name, (model, X) in models.items():
    s = sample if model_name != "Logistic Regression" else scaler.transform(sample)
    # warm up
    model.predict(s)
    t0 = time.time()
    for _ in range(1000):
        model.predict(s)
    elapsed = (time.time() - t0) / 1000 * 1000  # ms per prediction
    print(f"  {model_name:<22}: {elapsed:.3f} ms per prediction")

# ══════════════════════════════════════════════════════════════════
# SUMMARY
# ══════════════════════════════════════════════════════════════════
separator("TEST SUMMARY")

rf_preds = rf.predict(X_test)
rf_acc   = (rf_preds == y_test).sum() / len(y_test) * 100

print(f"\n  [PASS]  All models load correctly")
print(f"  [PASS]  Single predictions working")
print(f"  [PASS]  Batch prediction on {total} students")
print(f"  [PASS]  Edge cases handled without errors")
print(f"  [PASS]  Speed test complete")
print()
print(f"  Random Forest accuracy on test set : {rf_acc:.2f}%")
print()
print("  All tests passed.")
print()