# backend/ml_scripts/study-planner/test_trained_model.py
"""
Test script for the trained academic priority model
"""

import numpy as np
import pandas as pd
import joblib
from pathlib import Path
import sys

# Add the backend directory to path
backend_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_dir))


def create_engineered_features(data):
    """Create the same engineered features used in training"""

    df = data.copy()

    # Core engineered features
    df['Avg_Exam_Score'] = (
        df['Midterm_Score'] + df['Final_Score']
    ) / 2

    df['Exam_Improvement'] = (
        df['Final_Score'] - df['Midterm_Score']
    )

    df['Study_Sleep_Ratio'] = (
        df['Study_Hours_per_Week'] /
        (df['Sleep_Hours_per_Night'] + 1e-6)
    )

    df['Overall_Avg_Score'] = (
        df['Midterm_Score'] +
        df['Final_Score'] +
        df['Assignments_Avg'] +
        df['Quizzes_Avg']
    ) / 4

    df['Score_Variability'] = df[
        [
            'Midterm_Score',
            'Final_Score',
            'Assignments_Avg',
            'Quizzes_Avg'
        ]
    ].std(axis=1)

    df['Attendance_Efficiency'] = (
        df['Attendance (%)'] *
        (1 - df['Stress_Level (1-10)'] / 20)
    )

    # Additional engineered features
    df['Midterm_Final_Gap'] = (
        df['Midterm_Score'] - df['Final_Score']
    )

    df['Assignment_Project_Ratio'] = (
        df['Assignments_Avg'] /
        (df['Projects_Score'] + 1e-6)
    )

    df['Quiz_Project_Ratio'] = (
        df['Quizzes_Avg'] /
        (df['Projects_Score'] + 1e-6)
    )

    df['Performance_Composite'] = (
        df['Midterm_Score'] * 0.25 +
        df['Final_Score'] * 0.35 +
        df['Assignments_Avg'] * 0.20 +
        df['Quizzes_Avg'] * 0.20
    )

    df['Sleep_Stress_Balance'] = (
        df['Sleep_Hours_per_Night'] /
        (df['Stress_Level (1-10)'] + 1e-6)
    )

    df['Study_Efficiency'] = (
        df['Study_Hours_per_Week'] /
        (df['Attendance (%)'] + 1e-6) * 100
    )

    df['Exam_Improved'] = (
        df['Exam_Improvement'] > 0
    ).astype(int)

    df['Low_Score_Risk'] = (
        df['Low_Score_Count'] > 1
    ).astype(int)

    df['High_Workload'] = (
        df['Study_Hours_per_Week'] > 15
    ).astype(int)

    df['Participation_Effectiveness'] = (
        df['Participation_Score'] /
        (df['Attendance (%)'] + 1e-6) * 100
    )

    return df


def load_model_files():
    """Load trained model files"""

    trained_path = backend_dir / 'trained-models' / 'study-planner'

    try:
        model = joblib.load(trained_path / 'xgboost_model.pkl')
        scaler = joblib.load(trained_path / 'scaler.pkl')
        feature_cols = joblib.load(
            trained_path / 'feature_columns.pkl'
        )

        print("  ✅ Model files loaded successfully")

        return model, scaler, feature_cols

    except FileNotFoundError as e:
        print(f"  ❌ Missing file: {e}")
        return None, None, None


def preprocess_input(student_data, feature_cols, scaler):
    """Preprocess single student input"""

    df = pd.DataFrame([student_data])

    # Create engineered features
    df = create_engineered_features(df)

    # Ensure all feature columns exist
    for col in feature_cols:
        if col not in df.columns:
            df[col] = 0

    # Keep exact training order
    X = df[feature_cols]

    # Handle invalid values
    X = X.fillna(0)
    X = X.replace([np.inf, -np.inf], 0)

    # Scale data
    X_scaled = scaler.transform(X)

    return X_scaled, df


def test_validation_accuracy():
    """Test validation accuracy"""

    print("\n" + "=" * 70)
    print(" TEST 1: VALIDATION SET ACCURACY ")
    print("=" * 70)

    dataset_path = backend_dir / 'datasets' / 'study-planner'

    try:
        X_val = np.load(dataset_path / 'X_val.npy')
        y_val = np.load(dataset_path / 'y_val.npy')

        print(f"  ✅ Validation data loaded")
        print(f"  📊 Shape: {X_val.shape}")

    except FileNotFoundError:
        print("  ❌ Validation files not found")
        return 0.0

    model, scaler, feature_cols = load_model_files()

    if model is None:
        return 0.0

    # Predict
    predictions = model.predict(X_val)

    # Accuracy
    accuracy = np.mean(predictions == y_val)

    print(f"\n  🎯 Validation Accuracy: {accuracy * 100:.2f}%")

    print(f"  📊 Total Samples: {len(y_val)}")
    print(f"  ✅ Correct Predictions: {np.sum(predictions == y_val)}")

    # Per-class accuracy
    priority_names = {
        0: 'Low',
        1: 'Medium',
        2: 'High'
    }

    print(f"\n  📊 Per-Class Accuracy:")

    for priority in [0, 1, 2]:

        mask = y_val == priority

        if np.sum(mask) > 0:

            class_acc = np.mean(
                predictions[mask] == y_val[mask]
            )

            print(
                f"     Priority {priority} "
                f"({priority_names[priority]}): "
                f"{class_acc * 100:.2f}%"
            )

    return accuracy


def test_student_scenarios():
    """Test multiple student scenarios"""

    print("\n" + "=" * 70)
    print(" TEST 2: STUDENT SCENARIO PREDICTIONS ")
    print("=" * 70)

    model, scaler, feature_cols = load_model_files()

    if model is None:
        return

    test_cases = [

        {
            "name": "Perfect Student",
            "expected": "Low",
            "features": {
                'Attendance (%)': 98,
                'Midterm_Score': 95,
                'Final_Score': 96,
                'Assignments_Avg': 94,
                'Quizzes_Avg': 93,
                'Participation_Score': 90,
                'Projects_Score': 95,
                'Study_Hours_per_Week': 10,
                'Stress_Level (1-10)': 2,
                'Sleep_Hours_per_Night': 8,
                'Extracurricular': 0,
                'Low_Score_Count': 0
            }
        },

        {
            "name": "At-Risk Student",
            "expected": "High",
            "features": {
                'Attendance (%)': 45,
                'Midterm_Score': 38,
                'Final_Score': 42,
                'Assignments_Avg': 40,
                'Quizzes_Avg': 35,
                'Participation_Score': 20,
                'Projects_Score': 45,
                'Study_Hours_per_Week': 28,
                'Stress_Level (1-10)': 9,
                'Sleep_Hours_per_Night': 4,
                'Extracurricular': 1,
                'Low_Score_Count': 3
            }
        },

        {
            "name": "Average Student",
            "expected": "Medium",
            "features": {
                'Attendance (%)': 75,
                'Midterm_Score': 68,
                'Final_Score': 72,
                'Assignments_Avg': 70,
                'Quizzes_Avg': 65,
                'Participation_Score': 55,
                'Projects_Score': 72,
                'Study_Hours_per_Week': 16,
                'Stress_Level (1-10)': 5,
                'Sleep_Hours_per_Night': 6,
                'Extracurricular': 1,
                'Low_Score_Count': 0
            }
        },

        {
            "name": "Improving Student",
            "expected": "Low-Medium",
            "features": {
                'Attendance (%)': 82,
                'Midterm_Score': 58,
                'Final_Score': 85,
                'Assignments_Avg': 72,
                'Quizzes_Avg': 68,
                'Participation_Score': 60,
                'Projects_Score': 78,
                'Study_Hours_per_Week': 18,
                'Stress_Level (1-10)': 6,
                'Sleep_Hours_per_Night': 6,
                'Extracurricular': 0,
                'Low_Score_Count': 0
            }
        },

        {
            "name": "Overworked Student",
            "expected": "Medium",
            "features": {
                'Attendance (%)': 68,
                'Midterm_Score': 72,
                'Final_Score': 70,
                'Assignments_Avg': 88,
                'Quizzes_Avg': 85,
                'Participation_Score': 45,
                'Projects_Score': 90,
                'Study_Hours_per_Week': 32,
                'Stress_Level (1-10)': 8,
                'Sleep_Hours_per_Night': 5,
                'Extracurricular': 1,
                'Low_Score_Count': 0
            }
        }
    ]

    print("\n  📊 Scenario Results")
    print("  " + "-" * 90)

    header = (
        f"{'Student':<25}"
        f"{'Prediction':<15}"
        f"{'Confidence':<15}"
        f"{'Expected':<15}"
        f"{'Match'}"
    )

    print("  " + header)
    print("  " + "-" * 90)

    priority_map = {
        0: 'Low',
        1: 'Medium',
        2: 'High'
    }

    for test in test_cases:

        X_scaled, _ = preprocess_input(
            test['features'],
            feature_cols,
            scaler
        )

        prediction = model.predict(X_scaled)[0]

        probabilities = model.predict_proba(X_scaled)[0]

        confidence = np.max(probabilities) * 100

        predicted_label = priority_map[prediction]

        expected = test['expected']

        match = "✓"

        if (
            expected != predicted_label and
            not (
                expected == "Low-Medium" and
                predicted_label in ["Low", "Medium"]
            )
        ):
            match = "?"

        emoji = (
            "🌟" if predicted_label == "Low"
            else "📚" if predicted_label == "Medium"
            else "⚠️"
        )

        print(
            f"  {emoji} "
            f"{test['name']:<23}"
            f"{predicted_label:<15}"
            f"{confidence:.1f}%{'':<8}"
            f"{expected:<15}"
            f"{match}"
        )


def test_single_prediction():
    """Detailed single prediction"""

    print("\n" + "=" * 70)
    print(" TEST 3: SINGLE STUDENT PREDICTION ")
    print("=" * 70)

    model, scaler, feature_cols = load_model_files()

    if model is None:
        return

    student = {
        'Attendance (%)': 85,
        'Midterm_Score': 68,
        'Final_Score': 72,
        'Assignments_Avg': 78,
        'Quizzes_Avg': 70,
        'Participation_Score': 65,
        'Projects_Score': 75,
        'Study_Hours_per_Week': 15,
        'Stress_Level (1-10)': 5,
        'Sleep_Hours_per_Night': 7,
        'Extracurricular': 1,
        'Low_Score_Count': 0
    }

    X_scaled, df = preprocess_input(
        student,
        feature_cols,
        scaler
    )

    print("\n  📊 Engineered Features")

    selected_features = [
        'Avg_Exam_Score',
        'Exam_Improvement',
        'Overall_Avg_Score',
        'Performance_Composite',
        'Study_Efficiency'
    ]

    for feature in selected_features:

        if feature in df.columns:

            print(
                f"     {feature}: "
                f"{df[feature].values[0]:.2f}"
            )

    # Predict
    prediction = model.predict(X_scaled)[0]

    probabilities = model.predict_proba(X_scaled)[0]

    priority_map = {
        0: 'Low',
        1: 'Medium',
        2: 'High'
    }

    predicted_label = priority_map[prediction]

    print("\n  📊 Prediction Results")
    print(f"     Priority: {prediction} ({predicted_label})")
    print(f"     Confidence: {np.max(probabilities) * 100:.2f}%")

    print("\n  📊 Probability Breakdown")
    print(f"     Low (0): {probabilities[0] * 100:.2f}%")
    print(f"     Medium (1): {probabilities[1] * 100:.2f}%")
    print(f"     High (2): {probabilities[2] * 100:.2f}%")

    print("\n  💡 Recommendation")

    if predicted_label == "Low":

        print(
            "     ✅ Student is performing well."
        )

        print(
            "     ✅ Continue current study habits."
        )

    elif predicted_label == "Medium":

        print(
            "     📚 Student needs moderate support."
        )

        print(
            "     📚 Monitor academic progress regularly."
        )

    else:

        print(
            "     🚨 HIGH PRIORITY STUDENT"
        )

        print(
            "     - Schedule counseling"
        )

        print(
            "     - Provide extra learning support"
        )

        print(
            "     - Monitor attendance closely"
        )


def run_custom_prediction():
    """Custom manual prediction"""

    print("\n" + "=" * 70)
    print(" TEST 4: CUSTOM STUDENT PREDICTION ")
    print("=" * 70)

    model, scaler, feature_cols = load_model_files()

    if model is None:
        return

    custom_student = {
        'Attendance (%)': 78,
        'Midterm_Score': 60,
        'Final_Score': 74,
        'Assignments_Avg': 80,
        'Quizzes_Avg': 71,
        'Participation_Score': 66,
        'Projects_Score': 77,
        'Study_Hours_per_Week': 14,
        'Stress_Level (1-10)': 4,
        'Sleep_Hours_per_Night': 7,
        'Extracurricular': 1,
        'Low_Score_Count': 1
    }

    X_scaled, _ = preprocess_input(
        custom_student,
        feature_cols,
        scaler
    )

    prediction = model.predict(X_scaled)[0]

    probabilities = model.predict_proba(X_scaled)[0]

    priority_map = {
        0: 'Low',
        1: 'Medium',
        2: 'High'
    }

    print("\n  📊 Custom Student Result")
    print(
        f"     Predicted Priority: "
        f"{priority_map[prediction]}"
    )

    print(
        f"     Confidence: "
        f"{np.max(probabilities) * 100:.2f}%"
    )


def main():
    """Run all tests"""

    print("\n" + "=" * 70)
    print(" 🎯 ACADEMIC PRIORITY PREDICTOR - TEST SUITE ")
    print("=" * 70)

    accuracy = test_validation_accuracy()

    test_student_scenarios()

    test_single_prediction()

    run_custom_prediction()

    print("\n" + "=" * 70)
    print(" FINAL SUMMARY ")
    print("=" * 70)

    print(f"  🎯 Validation Accuracy: {accuracy * 100:.2f}%")

    if accuracy >= 0.90:

        print("  🎉 Excellent model performance!")

    elif accuracy >= 0.75:

        print("  ✅ Good model performance!")

    else:

        print("  ⚠️ Model needs improvement")

    print("=" * 70)


if __name__ == "__main__":
    main()