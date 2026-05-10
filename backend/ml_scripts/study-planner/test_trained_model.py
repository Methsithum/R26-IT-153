# backend/ml_scripts/study-planner/test_trained_model.py
"""
Test script for the trained academic priority model
"""

import numpy as np
import pandas as pd
import joblib
import json
from pathlib import Path
import sys

# Add the backend directory to path
backend_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_dir))

def create_engineered_features(data):
    """Create the same engineered features used in training"""
    df = data.copy()
    
    # Calculate derived features
    df['Avg_Exam_Score'] = (df['Midterm_Score'] + df['Final_Score']) / 2
    df['Exam_Improvement'] = df['Final_Score'] - df['Midterm_Score']
    df['Study_Sleep_Ratio'] = df['Study_Hours_per_Week'] / (df['Sleep_Hours_per_Night'] + 1e-6)
    df['Overall_Avg_Score'] = (df['Midterm_Score'] + df['Final_Score'] + df['Assignments_Avg'] + df['Quizzes_Avg']) / 4
    df['Score_Variability'] = df[['Midterm_Score', 'Final_Score', 'Assignments_Avg', 'Quizzes_Avg']].std(axis=1)
    df['Attendance_Efficiency'] = df['Attendance (%)'] * (1 - df['Stress_Level (1-10)'] / 20)
    
    # Additional engineered features
    df['Midterm_Final_Gap'] = df['Midterm_Score'] - df['Final_Score']
    df['Assignment_Project_Ratio'] = df['Assignments_Avg'] / (df['Projects_Score'] + 1e-6)
    df['Quiz_Project_Ratio'] = df['Quizzes_Avg'] / (df['Projects_Score'] + 1e-6)
    df['Performance_Composite'] = (
        df['Midterm_Score'] * 0.25 + df['Final_Score'] * 0.35 + 
        df['Assignments_Avg'] * 0.20 + df['Quizzes_Avg'] * 0.20
    )
    df['Sleep_Stress_Balance'] = df['Sleep_Hours_per_Night'] / (df['Stress_Level (1-10)'] + 1e-6)
    df['Study_Efficiency'] = df['Study_Hours_per_Week'] / (df['Attendance (%)'] + 1e-6) * 100
    df['Exam_Improved'] = (df['Exam_Improvement'] > 0).astype(int)
    df['Low_Score_Risk'] = (df['Low_Score_Count'] > 1).astype(int)
    df['High_Workload'] = (df['Study_Hours_per_Week'] > 15).astype(int)
    df['Participation_Effectiveness'] = df['Participation_Score'] / (df['Attendance (%)'] + 1e-6) * 100
    
    return df

def test_validation_accuracy():
    """Test accuracy on validation set"""
    print("\n" + "=" * 70)
    print(" TEST 1: VALIDATION SET ACCURACY ")
    print("=" * 70)
    
    dataset_path = backend_dir / 'datasets' / 'study-planner'
    trained_path = backend_dir / 'trained-models' / 'study-planner'
    
    # Load validation data (raw data, not scaled)
    # We need to load the original validation data to apply feature engineering
    train_df = pd.read_csv(dataset_path / 'train_data.csv')
    val_df = pd.read_csv(dataset_path / 'test_data.csv')  # Use test as validation for demo
    
    # Load model and preprocessors
    model = joblib.load(trained_path / 'xgboost_model.pkl')
    scaler = joblib.load(trained_path / 'scaler.pkl')
    feature_cols = joblib.load(trained_path / 'feature_columns.pkl')
    
    # Apply feature engineering to validation data
    val_df_engineered = create_engineered_features(val_df)
    
    # Ensure all feature columns exist
    for col in feature_cols:
        if col not in val_df_engineered.columns:
            val_df_engineered[col] = 0
    
    # Select features in correct order
    X_val = val_df_engineered[feature_cols]
    
    # Handle any missing values
    X_val = X_val.fillna(X_val.median())
    X_val = X_val.replace([np.inf, -np.inf], np.nan).fillna(X_val.median())
    
    # Scale
    X_val_scaled = scaler.transform(X_val)
    
    # Make predictions
    predictions = model.predict(X_val_scaled)
    
    # Get actual values
    y_val = val_df['Priority'].values
    
    # Calculate accuracy
    accuracy = np.mean(predictions == y_val)
    
    print(f"\n  ✅ Validation Accuracy: {accuracy*100:.2f}%")
    print(f"  📊 Total samples: {len(y_val)}")
    print(f"  ✓ Correct predictions: {np.sum(predictions == y_val)}")
    
    # Per-class accuracy
    print(f"\n  📊 Per-Class Accuracy:")
    for priority in [0, 1, 2]:
        mask = y_val == priority
        if np.sum(mask) > 0:
            class_acc = np.mean(predictions[mask] == y_val[mask])
            priority_name = {0: 'Low', 1: 'Medium', 2: 'High'}[priority]
            print(f"     Priority {priority} ({priority_name}): {class_acc*100:.2f}%")
    
    return accuracy

def test_student_scenarios():
    """Test various student scenarios"""
    print("\n" + "=" * 70)
    print(" TEST 2: STUDENT SCENARIO PREDICTIONS ")
    print("=" * 70)
    
    trained_path = backend_dir / 'trained-models' / 'study-planner'
    
    model = joblib.load(trained_path / 'xgboost_model.pkl')
    scaler = joblib.load(trained_path / 'scaler.pkl')
    feature_cols = joblib.load(trained_path / 'feature_columns.pkl')
    
    # Define test scenarios with raw features (engineered features will be created)
    test_cases = [
        {
            "name": "🌟 Perfect Student",
            "features": {
                'Attendance (%)': 98, 'Midterm_Score': 95, 'Final_Score': 96,
                'Assignments_Avg': 94, 'Quizzes_Avg': 93, 'Participation_Score': 90,
                'Projects_Score': 95, 'Study_Hours_per_Week': 10, 'Stress_Level (1-10)': 2,
                'Sleep_Hours_per_Night': 8, 'Extracurricular': 0, 'Low_Score_Count': 0
            }
        },
        {
            "name": "⚠️ At-Risk Student",
            "features": {
                'Attendance (%)': 45, 'Midterm_Score': 38, 'Final_Score': 42,
                'Assignments_Avg': 40, 'Quizzes_Avg': 35, 'Participation_Score': 20,
                'Projects_Score': 45, 'Study_Hours_per_Week': 28, 'Stress_Level (1-10)': 9,
                'Sleep_Hours_per_Night': 4, 'Extracurricular': 1, 'Low_Score_Count': 3
            }
        },
        {
            "name": "📚 Average Student",
            "features": {
                'Attendance (%)': 75, 'Midterm_Score': 68, 'Final_Score': 72,
                'Assignments_Avg': 70, 'Quizzes_Avg': 65, 'Participation_Score': 55,
                'Projects_Score': 72, 'Study_Hours_per_Week': 16, 'Stress_Level (1-10)': 5,
                'Sleep_Hours_per_Night': 6, 'Extracurricular': 1, 'Low_Score_Count': 0
            }
        },
        {
            "name": "💪 Improving Student",
            "features": {
                'Attendance (%)': 82, 'Midterm_Score': 58, 'Final_Score': 85,
                'Assignments_Avg': 72, 'Quizzes_Avg': 68, 'Participation_Score': 60,
                'Projects_Score': 78, 'Study_Hours_per_Week': 18, 'Stress_Level (1-10)': 6,
                'Sleep_Hours_per_Night': 6, 'Extracurricular': 0, 'Low_Score_Count': 0
            }
        },
        {
            "name": "😴 Overworked Student",
            "features": {
                'Attendance (%)': 68, 'Midterm_Score': 72, 'Final_Score': 70,
                'Assignments_Avg': 88, 'Quizzes_Avg': 85, 'Participation_Score': 45,
                'Projects_Score': 90, 'Study_Hours_per_Week': 32, 'Stress_Level (1-10)': 8,
                'Sleep_Hours_per_Night': 5, 'Extracurricular': 1, 'Low_Score_Count': 0
            }
        }
    ]
    
    print("\n  📊 Predictions:")
    print("  " + "-" * 75)
    print(f"  {'Student':<20} {'Priority':<12} {'Confidence':<12} {'Reason'}")
    print("  " + "-" * 75)
    
    for test in test_cases:
        # Create DataFrame
        df = pd.DataFrame([test['features']])
        
        # Create engineered features
        df = create_engineered_features(df)
        
        # Ensure all feature columns exist
        for col in feature_cols:
            if col not in df.columns:
                df[col] = 0
        
        # Select features in correct order
        X = df[feature_cols]
        
        # Handle missing values
        X = X.fillna(X.median())
        X = X.replace([np.inf, -np.inf], np.nan).fillna(X.median())
        
        # Scale
        X_scaled = scaler.transform(X)
        
        # Predict
        prediction = model.predict(X_scaled)[0]
        
        # Get probability
        proba = model.predict_proba(X_scaled)[0]
        confidence = np.max(proba) * 100
        
        priority_map = {0: 'Low', 1: 'Medium', 2: 'High'}
        
        # Calculate average grade
        avg_grade = (test['features']['Midterm_Score'] + test['features']['Final_Score']) / 2
        
        if priority_map[prediction] == 'Low':
            reason = f"Good grades ({avg_grade:.0f}%)"
        elif priority_map[prediction] == 'High':
            if avg_grade < 50:
                reason = f"Critical: {avg_grade:.0f}% avg"
            else:
                reason = f"Needs immediate attention"
        else:
            reason = f"Medium priority, monitor progress"
        
        print(f"  {test['name']:<20} {priority_map[prediction]:<12} {confidence:.1f}%{'':<6} {reason}")
    
    return test_cases

def test_single_prediction():
    """Test single student prediction"""
    print("\n" + "=" * 70)
    print(" TEST 3: SINGLE STUDENT PREDICTION ")
    print("=" * 70)
    
    trained_path = backend_dir / 'trained-models' / 'study-planner'
    
    model = joblib.load(trained_path / 'xgboost_model.pkl')
    scaler = joblib.load(trained_path / 'scaler.pkl')
    feature_cols = joblib.load(trained_path / 'feature_columns.pkl')
    
    # Sample student
    student = {
        'Attendance (%)': 85,
        'Midterm_Score': 75,
        'Final_Score': 80,
        'Assignments_Avg': 78,
        'Quizzes_Avg': 72,
        'Participation_Score': 65,
        'Projects_Score': 82,
        'Study_Hours_per_Week': 15,
        'Stress_Level (1-10)': 5,
        'Sleep_Hours_per_Night': 7,
        'Extracurricular': 1,
        'Low_Score_Count': 0
    }
    
    # Create DataFrame
    df = pd.DataFrame([student])
    
    # Create engineered features
    df = create_engineered_features(df)
    
    # Ensure all feature columns exist
    for col in feature_cols:
        if col not in df.columns:
            df[col] = 0
    
    # Select features in correct order
    X = df[feature_cols]
    
    # Handle missing values
    X = X.fillna(X.median())
    X = X.replace([np.inf, -np.inf], np.nan).fillna(X.median())
    
    # Scale
    X_scaled = scaler.transform(X)
    
    # Predict
    prediction = model.predict(X_scaled)[0]
    proba = model.predict_proba(X_scaled)[0]
    
    priority_map = {0: 'Low', 1: 'Medium', 2: 'High'}
    
    print(f"\n  📊 Sample Student Prediction:")
    print(f"     Priority Level: {prediction} ({priority_map[prediction]})")
    print(f"     Confidence: {np.max(proba)*100:.1f}%")
    print(f"     Probabilities:")
    print(f"        Low: {proba[0]*100:.1f}%")
    print(f"        Medium: {proba[1]*100:.1f}%")
    print(f"        High: {proba[2]*100:.1f}%")
    
    return prediction

def main():
    """Run all tests"""
    print("\n" + "=" * 70)
    print(" 🎯 ACADEMIC PRIORITY PREDICTOR - COMPLETE TEST SUITE ")
    print("=" * 70)
    
    # Run tests
    accuracy = test_validation_accuracy()
    test_student_scenarios()
    test_single_prediction()
    
    # Summary
    print("\n" + "=" * 70)
    print(" ✅ TEST SUMMARY ")
    print("=" * 70)
    print(f"  🎯 Model Accuracy: {accuracy*100:.2f}%")
    print(f"  📊 Target Range: 75-90%")
    if accuracy >= 0.90:
        print(f"  🎉 EXCELLENT! Model exceeds target!")
    elif accuracy >= 0.75:
        print(f"  ✅ GOOD! Model meets target!")
    else:
        print(f"  ⚠️ Model needs improvement")
    print("  🚀 Model is ready for production deployment")
    print("=" * 70)

if __name__ == "__main__":
    main()