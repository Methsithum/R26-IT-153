# ml_scripts/study-planner/data_preprocessing.py
"""
Data Preprocessing for Academic Priority Prediction
Target: Priority (0=Low, 1=Medium, 2=High)
"""

import pandas as pd
import numpy as np
import os
import sys
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
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

# Create directories if they don't exist
DATASET_PATH.mkdir(parents=True, exist_ok=True)
TRAINED_MODELS_PATH.mkdir(parents=True, exist_ok=True)

def load_data():
    """Load training and test datasets"""
    print("=" * 60)
    print("STEP 1: Loading Dataset")
    print("=" * 60)
    
    train_df = pd.read_csv(DATASET_PATH / 'train_data.csv')
    test_df = pd.read_csv(DATASET_PATH / 'test_data.csv')
    
    print(f"Training data shape: {train_df.shape}")
    print(f"Test data shape: {test_df.shape}")
    print(f"Training columns: {train_df.columns.tolist()}")
    
    return train_df, test_df

def explore_data(df, name="Dataset"):
    """Basic data exploration"""
    print(f"\n{name} Overview:")
    print(f"  - Shape: {df.shape}")
    print(f"  - Missing values: {df.isnull().sum().sum()}")
    print(f"  - Duplicates: {df.duplicated().sum()}")
    print(f"\n{name} - Priority Distribution:")
    print(df['Priority'].value_counts().sort_index())
    print(f"  - Class 0 (Low): {(df['Priority']==0).sum()}")
    print(f"  - Class 1 (Medium): {(df['Priority']==1).sum()}")
    print(f"  - Class 2 (High): {(df['Priority']==2).sum()}")
    
    return df

def create_academic_features(df):
    """
    Create additional academic features that are relevant for priority prediction
    
    Based on the dataset, these features help predict task priority:
    - Low grades + close deadlines = High priority
    - High grades + far deadlines = Low priority
    """
    print("\n" + "=" * 60)
    print("STEP 2: Feature Engineering")
    print("=" * 60)
    
    # Create a copy to avoid warnings
    df = df.copy()
    
    # 1. Performance Gap (Midterm vs Final Score)
    df['Midterm_Final_Gap'] = df['Midterm_Score'] - df['Final_Score']
    
    # 2. Assignment Completion Efficiency (Assignments Avg vs Projects Score)
    df['Assignment_Project_Ratio'] = df['Assignments_Avg'] / (df['Projects_Score'] + 1e-6)
    
    # 3. Quiz Participation Efficiency
    df['Quiz_Project_Ratio'] = df['Quizzes_Avg'] / (df['Projects_Score'] + 1e-6)
    
    # 4. Overall Performance Composite
    df['Performance_Composite'] = (
        df['Midterm_Score'] * 0.25 + 
        df['Final_Score'] * 0.35 + 
        df['Assignments_Avg'] * 0.20 + 
        df['Quizzes_Avg'] * 0.20
    )
    
    # 5. Stress to Sleep Ratio (inverse - better sleep reduces stress)
    df['Sleep_Stress_Balance'] = df['Sleep_Hours_per_Night'] / (df['Stress_Level (1-10)'] + 1e-6)
    
    # 6. Study Efficiency (Study Hours relative to Attendance)
    df['Study_Efficiency'] = df['Study_Hours_per_Week'] / (df['Attendance (%)'] + 1e-6) * 100
    
    # 7. Exam Improvement Flag (Improved significantly)
    df['Exam_Improved'] = (df['Exam_Improvement'] > 0).astype(int)
    
    # 8. Low Score Risk (multiple low scores)
    df['Low_Score_Risk'] = (df['Low_Score_Count'] > 1).astype(int)
    
    # 9. High Workload Indicator
    df['High_Workload'] = (df['Study_Hours_per_Week'] > df['Study_Hours_per_Week'].median()).astype(int)
    
    # 10. Participation Effectiveness
    df['Participation_Effectiveness'] = df['Participation_Score'] / (df['Attendance (%)'] + 1e-6) * 100
    
    print(f"  - Original features: 18")
    print(f"  - New features created: 10")
    print(f"  - Total features: {df.shape[1] - 1} (excluding Priority)")
    
    return df

def preprocess_data(df, scaler=None, fit_scaler=True):
    """
    Preprocess data: handle missing values, scale features
    """
    print("\n" + "=" * 60)
    print("STEP 3: Data Preprocessing")
    print("=" * 60)
    
    df = df.copy()
    
    # Define feature columns (excluding target)
    target_col = 'Priority'
    feature_cols = [col for col in df.columns if col != target_col]
    
    # Split features and target
    X = df[feature_cols]
    y = df[target_col] if target_col in df else None
    
    # Handle missing values (if any)
    if X.isnull().sum().sum() > 0:
        print(f"  - Missing values found: {X.isnull().sum().sum()}")
        imputer = SimpleImputer(strategy='median')
        X = pd.DataFrame(imputer.fit_transform(X), columns=feature_cols)
        print(f"  - Missing values imputed with median")
    else:
        print(f"  - No missing values found")
    
    # Handle infinite values
    X = X.replace([np.inf, -np.inf], np.nan)
    if X.isnull().sum().sum() > 0:
        X = X.fillna(X.median())
    
    # Scale features
    if fit_scaler:
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        print(f"  - Features scaled using StandardScaler (fit)")
    else:
        X_scaled = scaler.transform(X)
        print(f"  - Features scaled using existing scaler (transform)")
    
    X_scaled = pd.DataFrame(X_scaled, columns=feature_cols)
    
    return X_scaled, y, scaler, feature_cols

def split_data(X, y, test_size=0.2, random_state=42):
    """Split data into train and validation sets"""
    print("\n" + "=" * 60)
    print("STEP 4: Train-Validation Split")
    print("=" * 60)
    
    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=test_size, random_state=random_state, stratify=y
    )
    
    print(f"  - Training set: {X_train.shape}")
    print(f"  - Validation set: {X_val.shape}")
    print(f"  - Training priority distribution:")
    for priority in sorted(y_train.unique()):
        count = (y_train == priority).sum()
        print(f"      Priority {priority}: {count} ({count/len(y_train)*100:.1f}%)")
    
    return X_train, X_val, y_train, y_val

def save_preprocessed_data(X_train, X_val, y_train, y_val, X_test, scaler, feature_cols):
    """Save preprocessed data for model training"""
    print("\n" + "=" * 60)
    print("STEP 5: Saving Preprocessed Data")
    print("=" * 60)
    
    # Save numpy arrays
    np.save(DATASET_PATH / 'X_train.npy', X_train)
    np.save(DATASET_PATH / 'X_val.npy', X_val)
    np.save(DATASET_PATH / 'y_train.npy', y_train)
    np.save(DATASET_PATH / 'y_val.npy', y_val)
    np.save(DATASET_PATH / 'X_test.npy', X_test)
    
    # Save scaler
    joblib.dump(scaler, TRAINED_MODELS_PATH / 'scaler.pkl')
    
    # Save feature columns
    joblib.dump(feature_cols, TRAINED_MODELS_PATH / 'feature_columns.pkl')
    
    # Save feature columns as JSON for easy access
    import json
    with open(TRAINED_MODELS_PATH / 'feature_columns.json', 'w') as f:
        json.dump(feature_cols, f, indent=2)
    
    print(f"  - X_train.npy saved ({X_train.shape})")
    print(f"  - X_val.npy saved ({X_val.shape})")
    print(f"  - y_train.npy saved ({y_train.shape})")
    print(f"  - y_val.npy saved ({y_val.shape})")
    print(f"  - X_test.npy saved ({X_test.shape})")
    print(f"  - scaler.pkl saved")
    print(f"  - feature_columns.pkl saved")
    print(f"  - feature_columns.json saved")
    
    return True

def main():
    """Main preprocessing pipeline"""
    print("\n" + "=" * 70)
    print(" ACADEMIC PRIORITY PREDICTION - DATA PREPROCESSING PIPELINE ")
    print("=" * 70)
    
    # Step 1: Load data
    train_df, test_df = load_data()
    
    # Step 2: Explore data
    explore_data(train_df, "Training Data")
    explore_data(test_df, "Test Data")
    
    # Step 3: Feature engineering
    train_df = create_academic_features(train_df)
    test_df = create_academic_features(test_df)
    
    # Verify columns match
    train_cols = set(train_df.columns)
    test_cols = set(test_df.columns)
    missing_in_test = train_cols - test_cols
    extra_in_test = test_cols - train_cols
    
    if missing_in_test:
        print(f"\n  - Adding missing columns to test data: {missing_in_test}")
        for col in missing_in_test:
            if col != 'Priority':
                test_df[col] = 0
    
    # Step 4: Preprocess training data
    X_train_full, y_train_full, scaler, feature_cols = preprocess_data(train_df, fit_scaler=True)
    
    # Step 5: Preprocess test data
    X_test, _, _, _ = preprocess_data(test_df, scaler=scaler, fit_scaler=False)
    
    # Step 6: Split training data into train and validation
    X_train, X_val, y_train, y_val = split_data(X_train_full, y_train_full)
    
    # Step 7: Save preprocessed data
    save_preprocessed_data(X_train, X_val, y_train, y_val, X_test, scaler, feature_cols)
    
    print("\n" + "=" * 70)
    print(" DATA PREPROCESSING COMPLETED SUCCESSFULLY ")
    print("=" * 70)
    
    return X_train, X_val, y_train, y_val, X_test, scaler, feature_cols

if __name__ == "__main__":
    main()