# backend/ml_scripts/study-planner/model_service.py
"""
Model Service for Academic Priority Prediction
"""

import numpy as np
import pandas as pd
import joblib
import json
from pathlib import Path
from typing import Dict, List, Union, Any
import sys

# Add backend directory to path
backend_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_dir))

class AcademicPriorityPredictor:
    """
    Service class for predicting academic task priority
    Priority levels: 0 = Low, 1 = Medium, 2 = High
    """
    
    def __init__(self, model_path: Path = None, use_production: bool = True):
        """
        Initialize the predictor with trained model
        """
        self.use_production = use_production
        
        if model_path is None:
            if use_production:
                self.model_path = backend_dir / 'trained-models' / 'study-planner' / 'academic_priority_model.pkl'
            else:
                self.model_path = backend_dir / 'trained-models' / 'study-planner' / 'academic_priority_model.pkl'
        else:
            self.model_path = model_path
        
        self.scaler_path = backend_dir / 'trained-models' / 'study-planner' / 'scaler.pkl'
        self.feature_cols_path = backend_dir / 'trained-models' / 'study-planner' / 'feature_columns.pkl'
        self.metadata_path = backend_dir / 'trained-models' / 'study-planner' / 'model_metadata.json'
        
        self.model = None
        self.scaler = None
        self.feature_columns = None
        self.metadata = None
        
        self._load_model()
    
    def _load_model(self):
        """Load the trained model and associated artifacts"""
        try:
            if not self.model_path.exists():
                raise FileNotFoundError(f"Model not found at {self.model_path}")
            
            self.model = joblib.load(self.model_path)
            self.scaler = joblib.load(self.scaler_path)
            self.feature_columns = joblib.load(self.feature_cols_path)
            
            if self.metadata_path.exists():
                with open(self.metadata_path, 'r') as f:
                    self.metadata = json.load(f)
            
            print(f"✅ Model loaded successfully from {self.model_path}")
            print(f"   Model: {self.metadata.get('model_name', 'Unknown') if self.metadata else 'Unknown'}")
            print(f"   Features: {len(self.feature_columns)}")
            
        except Exception as e:
            print(f"❌ Error loading model: {e}")
            raise
    
    def create_academic_features(self, data: pd.DataFrame) -> pd.DataFrame:
        """Create additional academic features"""
        df = data.copy()
        
        # 1. Performance Gap
        if 'Midterm_Score' in df.columns and 'Final_Score' in df.columns:
            df['Midterm_Final_Gap'] = df['Midterm_Score'] - df['Final_Score']
        else:
            df['Midterm_Final_Gap'] = 0
        
        # 2. Assignment Completion Efficiency
        if 'Assignments_Avg' in df.columns and 'Projects_Score' in df.columns:
            df['Assignment_Project_Ratio'] = df['Assignments_Avg'] / (df['Projects_Score'] + 1e-6)
        else:
            df['Assignment_Project_Ratio'] = 0
        
        # 3. Quiz Participation Efficiency
        if 'Quizzes_Avg' in df.columns and 'Projects_Score' in df.columns:
            df['Quiz_Project_Ratio'] = df['Quizzes_Avg'] / (df['Projects_Score'] + 1e-6)
        else:
            df['Quiz_Project_Ratio'] = 0
        
        # 4. Overall Performance Composite
        if all(col in df.columns for col in ['Midterm_Score', 'Final_Score', 'Assignments_Avg', 'Quizzes_Avg']):
            df['Performance_Composite'] = (
                df['Midterm_Score'] * 0.25 + 
                df['Final_Score'] * 0.35 + 
                df['Assignments_Avg'] * 0.20 + 
                df['Quizzes_Avg'] * 0.20
            )
        else:
            df['Performance_Composite'] = 0
        
        # 5. Stress to Sleep Balance
        if 'Sleep_Hours_per_Night' in df.columns and 'Stress_Level (1-10)' in df.columns:
            df['Sleep_Stress_Balance'] = df['Sleep_Hours_per_Night'] / (df['Stress_Level (1-10)'] + 1e-6)
        else:
            df['Sleep_Stress_Balance'] = 0
        
        # 6. Study Efficiency
        if 'Study_Hours_per_Week' in df.columns and 'Attendance (%)' in df.columns:
            df['Study_Efficiency'] = df['Study_Hours_per_Week'] / (df['Attendance (%)'] + 1e-6) * 100
        else:
            df['Study_Efficiency'] = 0
        
        # 7. Exam Improvement Flag
        if 'Exam_Improvement' in df.columns:
            df['Exam_Improved'] = (df['Exam_Improvement'] > 0).astype(int)
        else:
            df['Exam_Improved'] = 0
        
        # 8. Low Score Risk
        if 'Low_Score_Count' in df.columns:
            df['Low_Score_Risk'] = (df['Low_Score_Count'] > 1).astype(int)
        else:
            df['Low_Score_Risk'] = 0
        
        # 9. High Workload Indicator
        if 'Study_Hours_per_Week' in df.columns:
            median_study = df['Study_Hours_per_Week'].median() if len(df) > 0 else 15
            df['High_Workload'] = (df['Study_Hours_per_Week'] > median_study).astype(int)
        else:
            df['High_Workload'] = 0
        
        # 10. Participation Effectiveness
        if 'Participation_Score' in df.columns and 'Attendance (%)' in df.columns:
            df['Participation_Effectiveness'] = df['Participation_Score'] / (df['Attendance (%)'] + 1e-6) * 100
        else:
            df['Participation_Effectiveness'] = 0
        
        return df
    
    def preprocess_input(self, data: Union[pd.DataFrame, Dict, List[Dict]]) -> np.ndarray:
        """Preprocess input data for prediction"""
        if isinstance(data, dict):
            data = pd.DataFrame([data])
        elif isinstance(data, list):
            data = pd.DataFrame(data)
        
        # Create engineered features
        data = self.create_academic_features(data)
        
        # Ensure all required feature columns exist
        for col in self.feature_columns:
            if col not in data.columns:
                data[col] = 0
        
        # Select only the features used during training
        X = data[self.feature_columns]
        
        # Handle missing values
        X = X.fillna(X.median())
        
        # Replace infinite values
        X = X.replace([np.inf, -np.inf], np.nan)
        X = X.fillna(X.median())
        
        # Scale features
        X_scaled = self.scaler.transform(X)
        
        return X_scaled
    
    def predict(self, data: Union[pd.DataFrame, Dict, List[Dict]]) -> np.ndarray:
        """Predict priority levels"""
        X_processed = self.preprocess_input(data)
        predictions = self.model.predict(X_processed)
        return predictions
    
    def predict_proba(self, data: Union[pd.DataFrame, Dict, List[Dict]]) -> np.ndarray:
        """Get probability scores"""
        X_processed = self.preprocess_input(data)
        
        if hasattr(self.model, 'predict_proba'):
            probabilities = self.model.predict_proba(X_processed)
        else:
            probabilities = np.zeros((X_processed.shape[0], 3))
        
        return probabilities
    
    def predict_with_confidence(self, data: Union[pd.DataFrame, Dict, List[Dict]]) -> List[Dict]:
        """Predict with confidence scores"""
        X_processed = self.preprocess_input(data)
        predictions = self.model.predict(X_processed)
        probabilities = self.predict_proba(data)
        
        priority_map = {0: "Low", 1: "Medium", 2: "High"}
        
        results = []
        for i, pred in enumerate(predictions):
            results.append({
                'priority_level': int(pred),
                'priority_label': priority_map[pred],
                'confidence': float(np.max(probabilities[i])),
                'probabilities': {
                    'low': float(probabilities[i][0]),
                    'medium': float(probabilities[i][1]),
                    'high': float(probabilities[i][2]) if probabilities.shape[1] > 2 else 0
                }
            })
        
        return results
    
    def get_model_info(self) -> Dict:
        """Get model information"""
        return self.metadata or {
            'model_name': 'Unknown',
            'num_features': len(self.feature_columns),
            'feature_columns': self.feature_columns
        }


def create_student_profile(
    attendance: float = 85.0,
    midterm: float = 75.0,
    final: float = 70.0,
    assignments: float = 80.0,
    quizzes: float = 75.0,
    participation: float = 50.0,
    projects: float = 80.0,
    study_hours: float = 15.0,
    stress: int = 5,
    sleep: float = 7.0,
    extracurricular: int = 1
) -> Dict:
    """Create a student profile dictionary for testing"""
    return {
        'Attendance (%)': attendance,
        'Midterm_Score': midterm,
        'Final_Score': final,
        'Assignments_Avg': assignments,
        'Quizzes_Avg': quizzes,
        'Participation_Score': participation,
        'Projects_Score': projects,
        'Study_Hours_per_Week': study_hours,
        'Stress_Level (1-10)': stress,
        'Sleep_Hours_per_Night': sleep,
        'Extracurricular': extracurricular,
        'Avg_Exam_Score': (midterm + final) / 2,
        'Exam_Improvement': final - midterm,
        'Study_Sleep_Ratio': study_hours / sleep if sleep > 0 else 0,
        'Low_Score_Count': 0,
        'Overall_Avg_Score': (midterm + final + assignments + quizzes) / 4,
        'Score_Variability': 0,
        'Attendance_Efficiency': attendance * (1 - stress/20)
    }


if __name__ == "__main__":
    # Test the predictor
    try:
        predictor = AcademicPriorityPredictor()
        print("\n✅ Model service is ready!")
        print(f"   Model info: {predictor.get_model_info()}")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("\nPlease run model_training.py first to train and save the model.")