"""
Complete Data Preprocessing for Academic Priority Prediction
Author: Your Name
Date: 2026-05-05
Purpose: Clean, preprocess, and prepare data with class weights for imbalance handling
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.utils.class_weight import compute_class_weight
from imblearn.over_sampling import SMOTE
from imblearn.combine import SMOTETomek
import joblib
import os
import json
from pathlib import Path
import warnings
warnings.filterwarnings('ignore')

# Set paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_PATH = BASE_DIR / "datasets" / "Study-Planner" / "students_data_preprocessed.csv"
PROCESSED_DATA_PATH = BASE_DIR / "datasets" / "Study-Planner" / "processed_academic_data.csv"
MODEL_ARTIFACTS_PATH = BASE_DIR / "trained-models" / "Study-Planner"

# Create directories if they don't exist
os.makedirs(MODEL_ARTIFACTS_PATH, exist_ok=True)

class AcademicDataPreprocessor:
    """
    Complete preprocessing pipeline for academic priority prediction
    """
    
    def __init__(self):
        self.scaler = StandardScaler()
        self.feature_columns = None
        self.class_weights = None
        self.class_weight_dict = None
        self.X_train = None
        self.X_test = None
        self.y_train = None
        self.y_test = None
        
    def load_data(self, file_path=None):
        """Load the preprocessed dataset"""
        if file_path is None:
            file_path = DATA_PATH
        
        print("="*60)
        print("LOADING DATA")
        print("="*60)
        df = pd.read_csv(file_path)
        print(f"✓ Dataset loaded successfully")
        print(f"  Shape: {df.shape}")
        print(f"  Columns: {len(df.columns)}")
        return df
    
    def explore_data(self, df):
        """Perform comprehensive data exploration"""
        print("\n" + "="*60)
        print("DATA EXPLORATION")
        print("="*60)
        
        # Basic info
        print(f"\n✓ Missing values: {df.isnull().sum().sum()}")
        print(f"✓ Duplicates: {df.duplicated().sum()}")
        
        # Target distribution
        print(f"\n✓ Priority Distribution:")
        priority_dist = df['Priority_Level'].value_counts()
        priority_pct = df['Priority_Level'].value_counts(normalize=True) * 100
        for level in ['Low', 'Medium', 'High']:
            count = priority_dist.get(level, 0)
            pct = priority_pct.get(level, 0)
            print(f"  {level}: {count} ({pct:.1f}%)")
        
        # Calculate imbalance ratio
        majority_count = priority_dist.max()
        minority_count = priority_dist.min()
        imbalance_ratio = majority_count / minority_count
        print(f"\n✓ Imbalance Ratio: {imbalance_ratio:.2f}:1")
        
        if imbalance_ratio > 1.5:
            print(f"  ⚠️ Dataset is imbalanced - Class weights recommended")
        
        return df
    
    def create_derived_features(self, df):
        """Create advanced derived features for better prediction"""
        print("\n" + "="*60)
        print("FEATURE ENGINEERING")
        print("="*60)
        
        # Performance percentiles
        for col in ['Midterm_Score', 'Final_Score', 'Total_Score']:
            df[f'{col}_Percentile'] = df[col].rank(pct=True) * 100
            print(f"✓ Created: {col}_Percentile")
        
        # Low performance count (scores below 50)
        df['Low_Performance_Count'] = (
            (df['Midterm_Score'] < 50).astype(int) +
            (df['Final_Score'] < 50).astype(int) +
            (df['Assignments_Avg'] < 50).astype(int) +
            (df['Quizzes_Avg'] < 50).astype(int)
        )
        print(f"✓ Created: Low_Performance_Count (range: {df['Low_Performance_Count'].min()}-{df['Low_Performance_Count'].max()})")
        
        # Improvement trend
        df['Improvement_Score'] = df['Final_Score'] - df['Midterm_Score']
        print(f"✓ Created: Improvement_Score (range: {df['Improvement_Score'].min():.1f}-{df['Improvement_Score'].max():.1f})")
        
        # Attendance efficiency
        df['Attendance_Efficiency'] = df['Total_Score'] / (df['Attendance (%)'] + 1)
        print(f"✓ Created: Attendance_Efficiency")
        
        # Stress to performance ratio
        df['Stress_Performance_Ratio'] = df['Stress_Level (1-10)'] / (df['Total_Score'] + 1)
        print(f"✓ Created: Stress_Performance_Ratio")
        
        # Adjusted study effort
        df['Adjusted_Study_Effort'] = df['Study_Hours_per_Week'] / (df['Sleep_Hours_per_Night'] + 1)
        print(f"✓ Created: Adjusted_Study_Effort")
        
        # Risk category (based on Risk_Score)
        df['Risk_Category'] = pd.cut(df['Risk_Score'], 
                                      bins=[-1, 1, 3, 5], 
                                      labels=['Low_Risk', 'Medium_Risk', 'High_Risk'])
        print(f"✓ Created: Risk_Category")
        
        # Performance consistency score
        df['Consistency_Score'] = 100 - df['Performance_Inconsistency']
        print(f"✓ Created: Consistency_Score")
        
        # Workload stress index
        df['Workload_Stress_Index'] = df['Workload_Balance'] * df['Stress_Level (1-10)']
        print(f"✓ Created: Workload_Stress_Index")
        
        return df
    
    def select_features(self, df):
        """Select optimal features for priority prediction"""
        print("\n" + "="*60)
        print("FEATURE SELECTION")
        print("="*60)
        
        # Core academic features
        core_features = [
            'Age',
            'Attendance (%)',
            'Midterm_Score',
            'Final_Score',
            'Assignments_Avg',
            'Quizzes_Avg',
            'Participation_Score',
            'Projects_Score',
            'Total_Score',
            'Study_Hours_per_Week',
            'Stress_Level (1-10)',
            'Sleep_Hours_per_Night',
            'Risk_Score',
            'Engagement_Score',
            'Performance_Inconsistency',
            'Study_Efficiency',
            'Workload_Balance',
        ]
        
        # Derived features
        derived_features = [
            'Midterm_Score_Percentile',
            'Final_Score_Percentile',
            'Total_Score_Percentile',
            'Low_Performance_Count',
            'Improvement_Score',
            'Attendance_Efficiency',
            'Stress_Performance_Ratio',
            'Adjusted_Study_Effort',
            'Consistency_Score',
            'Workload_Stress_Index'
        ]
        
        # Categorical/Boolean features
        boolean_features = [
            'Dept_CS', 
            'Dept_Engineering', 
            'Dept_Mathematics', 
            'Extracurricular_Encoded'
        ]
        
        # Combine all features
        all_features = core_features + derived_features + boolean_features
        available_features = [f for f in all_features if f in df.columns]
        
        print(f"✓ Selected {len(available_features)} features")
        print(f"  Core features: {len(core_features)}")
        print(f"  Derived features: {len(derived_features)}")
        print(f"  Boolean features: {len(boolean_features)}")
        
        return available_features
    
    def prepare_target(self, df):
        """Prepare target variable with encoding"""
        print("\n" + "="*60)
        print("TARGET PREPARATION")
        print("="*60)
        
        # Use Priority_Encoded (0=Low, 1=Medium, 2=High)
        y = df['Priority_Encoded'].values
        
        print(f"✓ Target variable: Priority_Encoded")
        print(f"  Encoding: 0=Low, 1=Medium, 2=High")
        
        return y
    
    def compute_class_weights(self, y):
        """Compute class weights for handling imbalance"""
        print("\n" + "="*60)
        print("CLASS WEIGHTS COMPUTATION")
        print("="*60)
        
        classes = np.unique(y)
        self.class_weights = compute_class_weight(
            class_weight='balanced',
            classes=classes,
            y=y
        )
        
        self.class_weight_dict = {
            0: self.class_weights[0],  # Low priority
            1: self.class_weights[1],  # Medium priority
            2: self.class_weights[2]   # High priority
        }
        
        print(f"✓ Computed class weights:")
        print(f"  Low (0):    {self.class_weights[0]:.3f}")
        print(f"  Medium (1): {self.class_weights[1]:.3f}")
        print(f"  High (2):   {self.class_weights[2]:.3f}")
        
        # Verify weights
        priority_counts = np.bincount(y)
        print(f"\n  Class distribution:")
        print(f"  Low:    {priority_counts[0]} samples")
        print(f"  Medium: {priority_counts[1]} samples")
        print(f"  High:   {priority_counts[2]} samples")
        
        return self.class_weight_dict
    
    def split_data(self, X, y, test_size=0.2, random_state=42):
        """Split data with stratification"""
        print("\n" + "="*60)
        print("DATA SPLITTING")
        print("="*60)
        
        X_train, X_test, y_train, y_test = train_test_split(
            X, y,
            test_size=test_size,
            random_state=random_state,
            stratify=y  # Maintain class distribution
        )
        
        print(f"✓ Stratified split completed")
        print(f"  Training set: {X_train.shape[0]} samples ({X_train.shape[0]/len(X)*100:.1f}%)")
        print(f"  Test set:     {X_test.shape[0]} samples ({X_test.shape[0]/len(X)*100:.1f}%)")
        
        # Show distribution
        train_dist = np.bincount(y_train)
        test_dist = np.bincount(y_test)
        print(f"\n  Training distribution: Low={train_dist[0]}, Medium={train_dist[1]}, High={train_dist[2]}")
        print(f"  Test distribution:     Low={test_dist[0]}, Medium={test_dist[1]}, High={test_dist[2]}")
        
        self.X_train, self.X_test = X_train, X_test
        self.y_train, self.y_test = y_train, y_test
        
        return X_train, X_test, y_train, y_test
    
    def apply_smote(self, X_train, y_train, sampling_strategy='auto', random_state=42):
        """Apply SMOTE for oversampling (optional)"""
        print("\n" + "="*60)
        print("SMOTE OVERSAMPLING (OPTIONAL)")
        print("="*60)
        
        smote = SMOTE(sampling_strategy=sampling_strategy, random_state=random_state)
        X_resampled, y_resampled = smote.fit_resample(X_train, y_train)
        
        print(f"✓ SMOTE applied")
        print(f"  Original size: {X_train.shape[0]} samples")
        print(f"  Resampled size: {X_resampled.shape[0]} samples")
        
        resampled_dist = np.bincount(y_resampled)
        print(f"  New distribution: Low={resampled_dist[0]}, Medium={resampled_dist[1]}, High={resampled_dist[2]}")
        
        return X_resampled, y_resampled
    
    def apply_smote_tomek(self, X_train, y_train, random_state=42):
        """Apply SMOTE + Tomek links for cleaner boundaries"""
        print("\n" + "="*60)
        print("SMOTE + TOMEK (ADVANCED)")
        print("="*60)
        
        smote_tomek = SMOTETomek(random_state=random_state)
        X_resampled, y_resampled = smote_tomek.fit_resample(X_train, y_train)
        
        print(f"✓ SMOTE + Tomek applied")
        print(f"  Original size: {X_train.shape[0]} samples")
        print(f"  Resampled size: {X_resampled.shape[0]} samples")
        
        return X_resampled, y_resampled
    
    def scale_features(self, X_train, X_test):
        """Scale features (optional - for non-tree models)"""
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        print(f"\n✓ Feature scaling completed")
        
        return X_train_scaled, X_test_scaled
    
    def save_artifacts(self):
        """Save all preprocessing artifacts"""
        print("\n" + "="*60)
        print("SAVING ARTIFACTS")
        print("="*60)
        
        # Save scaler
        scaler_path = MODEL_ARTIFACTS_PATH / "scaler.pkl"
        joblib.dump(self.scaler, scaler_path)
        print(f"✓ Scaler saved: {scaler_path}")
        
        # Save feature columns
        features_path = MODEL_ARTIFACTS_PATH / "feature_columns.pkl"
        joblib.dump(self.feature_columns, features_path)
        print(f"✓ Feature columns saved: {features_path}")
        
        # Save class weights
        weights_path = MODEL_ARTIFACTS_PATH / "class_weights.pkl"
        joblib.dump(self.class_weight_dict, weights_path)
        print(f"✓ Class weights saved: {weights_path}")
        
        # Save class weights as JSON for easy access
        weights_json_path = MODEL_ARTIFACTS_PATH / "class_weights.json"
        with open(weights_json_path, 'w') as f:
            json.dump(self.class_weight_dict, f, indent=4)
        print(f"✓ Class weights (JSON) saved: {weights_json_path}")
        
        # Save train/test indices for reproducibility
        split_info = {
            'train_shape': self.X_train.shape,
            'test_shape': self.X_test.shape,
            'train_distribution': np.bincount(self.y_train).tolist(),
            'test_distribution': np.bincount(self.y_test).tolist()
        }
        
        split_path = MODEL_ARTIFACTS_PATH / "split_info.json"
        with open(split_path, 'w') as f:
            json.dump(split_info, f, indent=4)
        print(f"✓ Split info saved: {split_path}")
    
    def save_processed_data(self, X, y):
        """Save processed data for future reference"""
        processed_df = pd.DataFrame(X, columns=self.feature_columns)
        processed_df['Priority_Encoded'] = y
        processed_df.to_csv(PROCESSED_DATA_PATH, index=False)
        print(f"\n✓ Processed data saved: {PROCESSED_DATA_PATH}")
    
    def run_preprocessing(self, use_smote=False, use_scaling=False):
        """Run complete preprocessing pipeline"""
        print("\n" + "="*60)
        print("COMPLETE PREPROCESSING PIPELINE")
        print("="*60)
        
        # Step 1: Load data
        df = self.load_data()
        
        # Step 2: Explore data
        df = self.explore_data(df)
        
        # Step 3: Create derived features
        df = self.create_derived_features(df)
        
        # Step 4: Select features
        self.feature_columns = self.select_features(df)
        
        # Step 5: Prepare features and target
        X = df[self.feature_columns].copy()
        
        # Convert boolean columns to int
        for col in ['Dept_CS', 'Dept_Engineering', 'Dept_Mathematics', 'Extracurricular_Encoded']:
            if col in X.columns:
                X[col] = X[col].astype(int)
        
        y = self.prepare_target(df)
        
        # Step 6: Split data
        X_train, X_test, y_train, y_test = self.split_data(X, y)
        
        # Step 7: Apply SMOTE if requested
        if use_smote:
            X_train, y_train = self.apply_smote(X_train, y_train)
        
        # Step 8: Scale features if requested
        if use_scaling:
            X_train, X_test = self.scale_features(X_train, X_test)
        
        # Step 9: Compute class weights
        class_weights = self.compute_class_weights(y_train)
        
        # Step 10: Save artifacts
        self.save_artifacts()
        
        # Step 11: Save processed data
        self.save_processed_data(X, y)
        
        print("\n" + "="*60)
        print("PREPROCESSING COMPLETE!")
        print("="*60)
        
        return X_train, X_test, y_train, y_test, class_weights


def main():
    """Main execution"""
    preprocessor = AcademicDataPreprocessor()
    
    # Run preprocessing without SMOTE (using class weights only)
    X_train, X_test, y_train, y_test, class_weights = preprocessor.run_preprocessing(
        use_smote=False,  # Set to True if you want SMOTE
        use_scaling=False  # Set to True for non-tree models
    )
    
    print(f"\nFinal shapes:")
    print(f"  X_train: {X_train.shape}")
    print(f"  X_test: {X_test.shape}")
    print(f"  y_train: {y_train.shape}")
    print(f"  y_test: {y_test.shape}")
    
    return X_train, X_test, y_train, y_test, class_weights


if __name__ == "__main__":
    X_train, X_test, y_train, y_test, class_weights = main()