"""
Complete Prediction Service with Class Weights
Author: Your Name
Date: 2026-05-05
Purpose: Load and serve the trained model for priority prediction
"""

import joblib
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, List, Any, Optional
import json
from datetime import datetime

# Set paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
MODEL_PATH = BASE_DIR / "trained-models" / "Study-Planner"

class PriorityPredictionService:
    """
    Complete service for making priority predictions
    """
    
    def __init__(self):
        self.model = None
        self.scaler = None
        self.feature_columns = None
        self.class_weights = None
        self.model_metadata = None
        self.is_loaded = False
        
    def load_model(self) -> bool:
        """Load trained model and all artifacts"""
        try:
            print("Loading Academic Priority Prediction Model...")
            
            # Load model
            model_file = MODEL_PATH / "academic_priority_model.pkl"
            if model_file.exists():
                self.model = joblib.load(model_file)
                print(f"  ✓ Model loaded: {model_file}")
            else:
                raise FileNotFoundError(f"Model not found at {model_file}")
            
            # Load feature columns
            features_file = MODEL_PATH / "feature_columns.pkl"
            if features_file.exists():
                self.feature_columns = joblib.load(features_file)
                print(f"  ✓ Feature columns loaded ({len(self.feature_columns)} features)")
            
            # Load scaler (if exists)
            scaler_file = MODEL_PATH / "scaler.pkl"
            if scaler_file.exists():
                self.scaler = joblib.load(scaler_file)
                print(f"  ✓ Scaler loaded")
            
            # Load class weights
            weights_file = MODEL_PATH / "class_weights.pkl"
            if weights_file.exists():
                self.class_weights = joblib.load(weights_file)
                print(f"  ✓ Class weights loaded: {self.class_weights}")
            
            # Load model metadata
            metadata_file = MODEL_PATH / "model_metadata.json"
            if metadata_file.exists():
                with open(metadata_file, 'r') as f:
                    self.model_metadata = json.load(f)
                print(f"  ✓ Model metadata loaded")
            
            self.is_loaded = True
            print("✅ Model service ready!")
            return True
            
        except Exception as e:
            print(f"❌ Error loading model: {e}")
            self.is_loaded = False
            return False
    
    def prepare_features(self, student_data: Dict[str, Any]) -> np.ndarray:
        """
        Prepare features for prediction
        
        Args:
            student_data: Dictionary containing student academic data
            
        Returns:
            Feature array ready for prediction
        """
        if not self.feature_columns:
            raise ValueError("Feature columns not loaded. Call load_model() first.")
        
        # Create dataframe from input
        df = pd.DataFrame([student_data])
        
        # Create derived features (same as in preprocessing)
        
        # Performance percentiles
        for col in ['Midterm_Score', 'Final_Score', 'Total_Score']:
            if col in df.columns:
                # For single sample, percentile is meaningless, use relative position
                # Instead, use the raw scores normalized or keep as is
                df[f'{col}_Percentile'] = df[col]  # Keep original for single prediction
        
        # Low performance count
        if all(col in df.columns for col in ['Midterm_Score', 'Final_Score', 'Assignments_Avg', 'Quizzes_Avg']):
            df['Low_Performance_Count'] = (
                (df['Midterm_Score'] < 50).astype(int) +
                (df['Final_Score'] < 50).astype(int) +
                (df['Assignments_Avg'] < 50).astype(int) +
                (df['Quizzes_Avg'] < 50).astype(int)
            )
        
        # Improvement score
        if 'Final_Score' in df.columns and 'Midterm_Score' in df.columns:
            df['Improvement_Score'] = df['Final_Score'] - df['Midterm_Score']
        
        # Attendance efficiency
        if 'Total_Score' in df.columns and 'Attendance (%)' in df.columns:
            df['Attendance_Efficiency'] = df['Total_Score'] / (df['Attendance (%)'] + 1)
        
        # Stress performance ratio
        if 'Stress_Level (1-10)' in df.columns and 'Total_Score' in df.columns:
            df['Stress_Performance_Ratio'] = df['Stress_Level (1-10)'] / (df['Total_Score'] + 1)
        
        # Adjusted study effort
        if 'Study_Hours_per_Week' in df.columns and 'Sleep_Hours_per_Night' in df.columns:
            df['Adjusted_Study_Effort'] = df['Study_Hours_per_Week'] / (df['Sleep_Hours_per_Night'] + 1)
        
        # Consistency score
        if 'Performance_Inconsistency' in df.columns:
            df['Consistency_Score'] = 100 - df['Performance_Inconsistency']
        
        # Workload stress index
        if 'Workload_Balance' in df.columns and 'Stress_Level (1-10)' in df.columns:
            df['Workload_Stress_Index'] = df['Workload_Balance'] * df['Stress_Level (1-10)']
        
        # Select only required features in correct order
        X = pd.DataFrame(index=[0])
        for col in self.feature_columns:
            if col in df.columns:
                X[col] = df[col].values[0]
            else:
                # Feature missing - use default value (0 or mean)
                print(f"  ⚠️ Missing feature: {col}, using 0")
                X[col] = 0
        
        # Convert boolean columns to int
        for col in ['Dept_CS', 'Dept_Engineering', 'Dept_Mathematics', 'Extracurricular_Encoded']:
            if col in X.columns:
                X[col] = X[col].astype(int)
        
        # Scale if scaler exists
        if self.scaler:
            X = self.scaler.transform(X)
        else:
            X = X.values
        
        return X
    
    def predict_priority(self, student_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predict priority for a single student
        
        Args:
            student_data: Dictionary with student academic data
            
        Returns:
            Dictionary with prediction results
        """
        if not self.is_loaded:
            success = self.load_model()
            if not success:
                return {"error": "Model not loaded", "success": False}
        
        try:
            # Validate required fields
            required_fields = ['Midterm_Score', 'Final_Score', 'Total_Score', 'Attendance (%)']
            missing_fields = [f for f in required_fields if f not in student_data]
            if missing_fields:
                return {
                    "error": f"Missing required fields: {missing_fields}",
                    "success": False
                }
            
            # Prepare features
            X = self.prepare_features(student_data)
            
            # Make prediction
            prediction = self.model.predict(X)[0]
            
            # Get probabilities
            if hasattr(self.model, 'predict_proba'):
                probabilities = self.model.predict_proba(X)[0]
            else:
                probabilities = [0.0, 0.0, 0.0]
                probabilities[prediction] = 1.0
            
            # Map prediction to label
            priority_map = {0: 'Low', 1: 'Medium', 2: 'High'}
            priority_label = priority_map[prediction]
            
            # Get recommendation based on priority and probability
            recommendation = self._get_recommendation(prediction, probabilities)
            
            # Calculate confidence
            confidence = probabilities[prediction]
            confidence_level = self._get_confidence_level(confidence)
            
            # Create response
            response = {
                "success": True,
                "priority_level": priority_label,
                "priority_code": int(prediction),
                "confidence": float(confidence),
                "confidence_level": confidence_level,
                "probabilities": {
                    "Low": float(probabilities[0]),
                    "Medium": float(probabilities[1]),
                    "High": float(probabilities[2])
                },
                "recommendation": recommendation,
                "prediction_timestamp": datetime.now().isoformat()
            }
            
            return response
            
        except Exception as e:
            return {
                "error": str(e),
                "success": False
            }
    
    def predict_batch(self, students_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Predict priorities for multiple students"""
        results = []
        for data in students_data:
            results.append(self.predict_priority(data))
        return results
    
    def _get_recommendation(self, prediction: int, probabilities: List[float]) -> str:
        """Generate personalized study recommendation"""
        confidence = probabilities[prediction]
        
        if prediction == 2:  # High priority
            if confidence > 0.8:
                return "🔴 URGENT: High-priority student requiring immediate intervention. Schedule intensive tutoring sessions (4-6 hours/week). Monitor progress daily."
            elif confidence > 0.6:
                return "🟠 HIGH PRIORITY: Student needs attention. Schedule tutoring (3-4 hours/week) and check in twice weekly."
            else:
                return "🟡 MODERATE CONCERN: Student shows some risk indicators. Schedule regular check-ins (2-3 hours/week)."
        
        elif prediction == 1:  # Medium priority
            if confidence > 0.8:
                return "🟢 MEDIUM PRIORITY: Student performing adequately. Maintain regular study schedule (2-3 hours/week)."
            else:
                return "📘 NORMAL PRIORITY: Student is on track. Continue standard study plan (2 hours/week)."
        
        else:  # Low priority
            return "✅ LOW PRIORITY: Student is performing well. Minimal intervention needed (1 hour/week maintenance)."
    
    def _get_confidence_level(self, confidence: float) -> str:
        """Get confidence level string"""
        if confidence >= 0.8:
            return "Very High"
        elif confidence >= 0.6:
            return "High"
        elif confidence >= 0.4:
            return "Medium"
        else:
            return "Low"
    
    def get_study_plan(self, student_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate complete study plan based on priority prediction
        
        Args:
            student_data: Dictionary with student academic data
            
        Returns:
            Dictionary with study plan recommendations
        """
        prediction = self.predict_priority(student_data)
        
        if not prediction.get('success'):
            return prediction
        
        priority = prediction['priority_level']
        
        # Generate study plan based on priority
        if priority == 'High':
            study_plan = {
                "daily_study_hours": 5,
                "weekly_tutoring_sessions": 3,
                "focus_areas": ["Foundational Concepts", "Problem-Solving", "Time Management"],
                "check_in_frequency": "Daily",
                "intervention_level": "Intensive",
                "recommended_actions": [
                    "Schedule one-on-one tutoring sessions",
                    "Provide additional practice materials",
                    "Monitor attendance closely",
                    "Weekly progress reviews",
                    "Parent/guardian notification if applicable"
                ]
            }
        elif priority == 'Medium':
            study_plan = {
                "daily_study_hours": 3,
                "weekly_tutoring_sessions": 1,
                "focus_areas": ["Concept Clarification", "Practice Problems"],
                "check_in_frequency": "Weekly",
                "intervention_level": "Moderate",
                "recommended_actions": [
                    "Group study sessions recommended",
                    "Weekly progress check-ins",
                    "Access to office hours",
                    "Peer tutoring available"
                ]
            }
        else:  # Low priority
            study_plan = {
                "daily_study_hours": 2,
                "weekly_tutoring_sessions": 0,
                "focus_areas": ["Advanced Topics", "Self-Study"],
                "check_in_frequency": "Bi-weekly",
                "intervention_level": "Minimal",
                "recommended_actions": [
                    "Self-directed learning",
                    "Maintain current study habits",
                    "Optional enrichment activities",
                    "Monthly progress reviews"
                ]
            }
        
        # Add course-specific recommendations
        if student_data.get('Dept_CS'):
            study_plan['course_specific'] = "Focus on programming assignments and algorithm practice"
        elif student_data.get('Dept_Engineering'):
            study_plan['course_specific'] = "Emphasize problem-solving and lab work"
        elif student_data.get('Dept_Mathematics'):
            study_plan['course_specific'] = "Practice proofs and mathematical reasoning"
        
        study_plan['priority'] = priority
        study_plan['confidence'] = prediction['confidence']
        
        return study_plan
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get model information and statistics"""
        if not self.model_metadata:
            return {"error": "Model metadata not available"}
        
        info = {
            "model_name": self.model_metadata.get('model_name'),
            "training_date": self.model_metadata.get('training_date'),
            "performance": self.model_metadata.get('performance', {}),
            "num_features": len(self.feature_columns) if self.feature_columns else 0,
            "class_weights": self.class_weights,
            "is_loaded": self.is_loaded
        }
        
        return info


# Create singleton instance
prediction_service = PriorityPredictionService()

def get_prediction_service() -> PriorityPredictionService:
    """Get the singleton prediction service instance"""
    if not prediction_service.is_loaded:
        prediction_service.load_model()
    return prediction_service


# Test function
def test_service():
    """Test the prediction service with sample data"""
    print("\n" + "="*60)
    print("TESTING PREDICTION SERVICE")
    print("="*60)
    
    service = get_prediction_service()
    
    # Test case 1: High priority student
    high_priority_student = {
        'Age': 22,
        'Attendance (%)': 55.0,
        'Midterm_Score': 45.0,
        'Final_Score': 50.0,
        'Assignments_Avg': 48.0,
        'Quizzes_Avg': 52.0,
        'Participation_Score': 30.0,
        'Projects_Score': 55.0,
        'Total_Score': 58.0,
        'Study_Hours_per_Week': 12.0,
        'Stress_Level (1-10)': 8,
        'Sleep_Hours_per_Night': 5.0,
        'Risk_Score': 3,
        'Engagement_Score': 0.45,
        'Performance_Inconsistency': 25.0,
        'Study_Efficiency': 3.5,
        'Workload_Balance': 3.5,
        'Dept_CS': 1,
        'Dept_Engineering': 0,
        'Dept_Mathematics': 0,
        'Extracurricular_Encoded': 1
    }
    
    print("\n📊 Testing High Priority Student:")
    result = service.predict_priority(high_priority_student)
    print(f"  Priority: {result['priority_level']}")
    print(f"  Confidence: {result['confidence_level']} ({result['confidence']:.2%})")
    print(f"  Recommendation: {result['recommendation']}")
    
    # Test case 2: Low priority student
    low_priority_student = {
        'Age': 20,
        'Attendance (%)': 95.0,
        'Midterm_Score': 88.0,
        'Final_Score': 92.0,
        'Assignments_Avg': 90.0,
        'Quizzes_Avg': 85.0,
        'Participation_Score': 85.0,
        'Projects_Score': 90.0,
        'Total_Score': 88.0,
        'Study_Hours_per_Week': 20.0,
        'Stress_Level (1-10)': 3,
        'Sleep_Hours_per_Night': 8.0,
        'Risk_Score': 0,
        'Engagement_Score': 0.85,
        'Performance_Inconsistency': 5.0,
        'Study_Efficiency': 7.0,
        'Workload_Balance': 2.0,
        'Dept_CS': 0,
        'Dept_Engineering': 1,
        'Dept_Mathematics': 0,
        'Extracurricular_Encoded': 0
    }
    
    print("\n📊 Testing Low Priority Student:")
    result = service.predict_priority(low_priority_student)
    print(f"  Priority: {result['priority_level']}")
    print(f"  Confidence: {result['confidence_level']} ({result['confidence']:.2%})")
    print(f"  Recommendation: {result['recommendation']}")
    
    # Get study plan
    print("\n📚 Study Plan for High Priority Student:")
    study_plan = service.get_study_plan(high_priority_student)
    print(f"  Daily Study Hours: {study_plan.get('daily_study_hours')}")
    print(f"  Focus Areas: {study_plan.get('focus_areas')}")
    print(f"  Recommended Actions: {study_plan.get('recommended_actions')[:2]}...")


if __name__ == "__main__":
    test_service()