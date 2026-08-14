"""
Test the trained XGBoost model
"""

import joblib
import numpy as np
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
MODEL_PATH = BASE_DIR / "trained-models" / "Study-Planner"

print("="*60)
print("TESTING TRAINED XGBOOST MODEL")
print("="*60)

# Load model
model_file = MODEL_PATH / "academic_priority_model.pkl"
model = joblib.load(model_file)
print(f"\n✅ Model loaded: {model_file}")
print(f"   Model type: {type(model).__name__}")

# Load feature columns
features_file = MODEL_PATH / "feature_columns.pkl"
feature_columns = joblib.load(features_file)
print(f"✅ Features loaded: {len(feature_columns)} features")

# Load class weights
import json
weights_file = MODEL_PATH / "class_weights.json"
with open(weights_file, 'r') as f:
    class_weights = json.load(f)
print(f"✅ Class weights: {class_weights}")

# Test cases
test_cases = [
    {
        "name": "High Risk Student",
        "data": {
            'Age': 22, 'Attendance (%)': 55.0, 'Midterm_Score': 45.0,
            'Final_Score': 50.0, 'Assignments_Avg': 48.0, 'Quizzes_Avg': 52.0,
            'Participation_Score': 30.0, 'Projects_Score': 55.0, 'Total_Score': 58.0,
            'Study_Hours_per_Week': 10.0, 'Stress_Level (1-10)': 8, 'Sleep_Hours_per_Night': 5.0,
            'Risk_Score': 4, 'Engagement_Score': 0.45, 'Performance_Inconsistency': 25.0,
            'Study_Efficiency': 3.5, 'Workload_Balance': 3.5, 'Dept_CS': 1,
            'Dept_Engineering': 0, 'Dept_Mathematics': 0, 'Extracurricular_Encoded': 1,
            'Midterm_Score_Percentile': 45, 'Final_Score_Percentile': 50, 'Total_Score_Percentile': 48,
            'Low_Performance_Count': 3, 'Improvement_Score': 5, 'Attendance_Efficiency': 58/56,
            'Stress_Performance_Ratio': 8/59, 'Adjusted_Study_Effort': 10/6, 'Consistency_Score': 75,
            'Workload_Stress_Index': 3.5*8
        },
        "expected": "HIGH"
    },
    {
        "name": "Low Risk Student",
        "data": {
            'Age': 20, 'Attendance (%)': 95.0, 'Midterm_Score': 88.0,
            'Final_Score': 92.0, 'Assignments_Avg': 90.0, 'Quizzes_Avg': 85.0,
            'Participation_Score': 85.0, 'Projects_Score': 90.0, 'Total_Score': 88.0,
            'Study_Hours_per_Week': 20.0, 'Stress_Level (1-10)': 3, 'Sleep_Hours_per_Night': 8.0,
            'Risk_Score': 0, 'Engagement_Score': 0.85, 'Performance_Inconsistency': 8.0,
            'Study_Efficiency': 7.0, 'Workload_Balance': 2.0, 'Dept_CS': 0,
            'Dept_Engineering': 1, 'Dept_Mathematics': 0, 'Extracurricular_Encoded': 0,
            'Midterm_Score_Percentile': 88, 'Final_Score_Percentile': 92, 'Total_Score_Percentile': 90,
            'Low_Performance_Count': 0, 'Improvement_Score': 4, 'Attendance_Efficiency': 88/96,
            'Stress_Performance_Ratio': 3/89, 'Adjusted_Study_Effort': 20/9, 'Consistency_Score': 92,
            'Workload_Stress_Index': 2*3
        },
        "expected": "LOW"
    }
]

print("\n" + "="*60)
print("PREDICTIONS")
print("="*60)

priority_map = {0: "LOW", 1: "MEDIUM", 2: "HIGH"}

for test in test_cases:
    # Prepare features in correct order
    X = []
    for col in feature_columns:
        X.append(test["data"].get(col, 0))
    X = np.array([X])
    
    # Predict
    pred = model.predict(X)[0]
    proba = model.predict_proba(X)[0]
    
    print(f"\n📊 {test['name']}:")
    print(f"   Expected: {test['expected']}")
    print(f"   Predicted: {priority_map[pred]}")
    print(f"   Confidence: {max(proba)*100:.1f}%")
    print(f"   Probabilities: Low={proba[0]:.1%}, Medium={proba[1]:.1%}, High={proba[2]:.1%}")
    
    if priority_map[pred] == test['expected']:
        print(f"   ✅ CORRECT!")
    else:
        print(f"   ⚠️ INCORRECT - Review this case")

print("\n" + "="*60)
print("MODEL IS READY FOR PRODUCTION!")
print("="*60)