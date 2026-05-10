# ml_scripts/study-planner/data_preprocessing.py
"""
Data Preprocessing for Academic Priority Prediction
Improved Version - Better Generalization
Target: Priority (0=Low, 1=Medium, 2=High)
"""

import pandas as pd
import numpy as np
import os
import sys
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
import joblib
import warnings

warnings.filterwarnings('ignore')

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.append(str(project_root))

# Define paths
DATASET_PATH = project_root / 'datasets' / 'study-planner'
TRAINED_MODELS_PATH = project_root / 'trained-models' / 'study-planner'

# Create directories
DATASET_PATH.mkdir(parents=True, exist_ok=True)
TRAINED_MODELS_PATH.mkdir(parents=True, exist_ok=True)


def load_data():
    """Load dataset"""

    print("=" * 70)
    print(" STEP 1: LOADING DATASET ")
    print("=" * 70)

    train_df = pd.read_csv(DATASET_PATH / 'train_data.csv')
    test_df = pd.read_csv(DATASET_PATH / 'test_data.csv')

    print(f"\n✅ Training Data Shape: {train_df.shape}")
    print(f"✅ Test Data Shape: {test_df.shape}")

    return train_df, test_df


def explore_data(df, name="Dataset"):
    """Explore dataset"""

    print("\n" + "=" * 70)
    print(f" {name.upper()} OVERVIEW ")
    print("=" * 70)

    print(f"\nShape: {df.shape}")
    print(f"Missing Values: {df.isnull().sum().sum()}")
    print(f"Duplicate Rows: {df.duplicated().sum()}")

    print("\nPriority Distribution:")

    counts = df['Priority'].value_counts().sort_index()

    for cls in counts.index:
        percentage = (counts[cls] / len(df)) * 100

        label = {
            0: "Low",
            1: "Medium",
            2: "High"
        }[cls]

        print(f"  Priority {cls} ({label}): {counts[cls]} ({percentage:.1f}%)")

    return df


def create_academic_features(df):
    """
    Create engineered features
    Reduced leakage + better generalization
    """

    print("\n" + "=" * 70)
    print(" STEP 2: FEATURE ENGINEERING ")
    print("=" * 70)

    df = df.copy()

    # -----------------------------
    # SAFE ENGINEERED FEATURES
    # -----------------------------

    # 1
    df['Midterm_Final_Gap'] = (
        df['Midterm_Score'] - df['Final_Score']
    )

    # 2
    df['Assignment_Project_Ratio'] = (
        df['Assignments_Avg'] /
        (df['Projects_Score'] + 1e-6)
    )

    # 3
    df['Quiz_Project_Ratio'] = (
        df['Quizzes_Avg'] /
        (df['Projects_Score'] + 1e-6)
    )

    # 4
    df['Sleep_Stress_Balance'] = (
        df['Sleep_Hours_per_Night'] /
        (df['Stress_Level (1-10)'] + 1e-6)
    )

    # 5
    df['Study_Efficiency'] = (
        df['Study_Hours_per_Week'] /
        (df['Attendance (%)'] + 1e-6)
    ) * 100

    # 6
    df['Low_Score_Risk'] = (
        df['Low_Score_Count'] > 1
    ).astype(int)

    # 7
    df['High_Workload'] = (
        df['Study_Hours_per_Week'] > 15
    ).astype(int)

    # 8
    df['Participation_Effectiveness'] = (
        df['Participation_Score'] /
        (df['Attendance (%)'] + 1e-6)
    ) * 100

    # -----------------------------
    # REMOVED FEATURES
    # These were causing overfitting
    # -----------------------------
    #
    # ❌ Performance_Composite
    # ❌ Overall_Avg_Score
    # ❌ Avg_Exam_Score
    #
    # These combine marks too strongly
    # and dominate prediction
    #

    print(f"\n✅ Feature Engineering Completed")
    print(f"Original Features: 18")
    print(f"New Features Added: 8")
    print(f"Total Features: {df.shape[1] - 1}")

    return df


def preprocess_data(df, scaler=None, fit_scaler=True):
    """
    Preprocess dataset
    """

    print("\n" + "=" * 70)
    print(" STEP 3: PREPROCESSING ")
    print("=" * 70)

    df = df.copy()

    target_col = 'Priority'

    feature_cols = [
        col for col in df.columns
        if col != target_col
    ]

    X = df[feature_cols]

    y = df[target_col] if target_col in df.columns else None

    # -----------------------------------
    # Handle Missing Values
    # -----------------------------------

    missing = X.isnull().sum().sum()

    if missing > 0:

        print(f"\n⚠ Missing Values Found: {missing}")

        imputer = SimpleImputer(strategy='median')

        X = pd.DataFrame(
            imputer.fit_transform(X),
            columns=feature_cols
        )

        print("✅ Missing values imputed")

    else:
        print("\n✅ No missing values")

    # -----------------------------------
    # Handle Infinite Values
    # -----------------------------------

    X = X.replace([np.inf, -np.inf], np.nan)

    if X.isnull().sum().sum() > 0:
        X = X.fillna(X.median())

    # -----------------------------------
    # Scaling
    # -----------------------------------

    if fit_scaler:

        scaler = StandardScaler()

        X_scaled = scaler.fit_transform(X)

        print("✅ StandardScaler fitted")

    else:

        X_scaled = scaler.transform(X)

        print("✅ Existing scaler applied")

    X_scaled = pd.DataFrame(
        X_scaled,
        columns=feature_cols
    )

    return X_scaled, y, scaler, feature_cols


def split_data(X, y):
    """
    Split train and validation
    """

    print("\n" + "=" * 70)
    print(" STEP 4: TRAIN / VALIDATION SPLIT ")
    print("=" * 70)

    X_train, X_val, y_train, y_val = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y
    )

    print(f"\n✅ Training Shape: {X_train.shape}")
    print(f"✅ Validation Shape: {X_val.shape}")

    print("\nTraining Distribution:")

    for cls in sorted(y_train.unique()):

        count = (y_train == cls).sum()

        percentage = (count / len(y_train)) * 100

        print(f"  Priority {cls}: {count} ({percentage:.1f}%)")

    return X_train, X_val, y_train, y_val


def save_preprocessed_data(
    X_train,
    X_val,
    y_train,
    y_val,
    X_test,
    scaler,
    feature_cols
):
    """
    Save processed files
    """

    print("\n" + "=" * 70)
    print(" STEP 5: SAVING FILES ")
    print("=" * 70)

    np.save(DATASET_PATH / 'X_train.npy', X_train)
    np.save(DATASET_PATH / 'X_val.npy', X_val)

    np.save(DATASET_PATH / 'y_train.npy', y_train)
    np.save(DATASET_PATH / 'y_val.npy', y_val)

    np.save(DATASET_PATH / 'X_test.npy', X_test)

    # Save scaler
    joblib.dump(
        scaler,
        TRAINED_MODELS_PATH / 'scaler.pkl'
    )

    # Save feature columns
    joblib.dump(
        feature_cols,
        TRAINED_MODELS_PATH / 'feature_columns.pkl'
    )

    import json

    with open(
        TRAINED_MODELS_PATH / 'feature_columns.json',
        'w'
    ) as f:

        json.dump(feature_cols, f, indent=2)

    print("\n✅ All preprocessing files saved")


def main():

    print("\n" + "=" * 70)
    print(" ACADEMIC PRIORITY PREDICTION ")
    print(" DATA PREPROCESSING PIPELINE ")
    print("=" * 70)

    # STEP 1
    train_df, test_df = load_data()

    # STEP 2
    explore_data(train_df, "Training Data")
    explore_data(test_df, "Test Data")

    # STEP 3
    train_df = create_academic_features(train_df)
    test_df = create_academic_features(test_df)

    # STEP 4
    train_cols = set(train_df.columns)
    test_cols = set(test_df.columns)

    missing_in_test = train_cols - test_cols

    if missing_in_test:

        print(f"\n⚠ Adding missing columns to test data")

        for col in missing_in_test:

            if col != 'Priority':
                test_df[col] = 0

    # STEP 5
    X_train_full, y_train_full, scaler, feature_cols = preprocess_data(
        train_df,
        fit_scaler=True
    )

    # STEP 6
    X_test, _, _, _ = preprocess_data(
        test_df,
        scaler=scaler,
        fit_scaler=False
    )

    # STEP 7
    X_train, X_val, y_train, y_val = split_data(
        X_train_full,
        y_train_full
    )

    # STEP 8
    save_preprocessed_data(
        X_train,
        X_val,
        y_train,
        y_val,
        X_test,
        scaler,
        feature_cols
    )

    print("\n" + "=" * 70)
    print(" ✅ PREPROCESSING COMPLETED SUCCESSFULLY ")
    print("=" * 70)

    return (
        X_train,
        X_val,
        y_train,
        y_val,
        X_test,
        scaler,
        feature_cols
    )


if __name__ == "__main__":
    main()