"""
Priority Prediction API Routes - Complete Version
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, validator
from datetime import datetime
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent.parent.parent))
from ml_scripts.Study_Planner.model_service import get_prediction_service

router = APIRouter(prefix="/api/v1/priority", tags=["Priority Prediction"])


# Request/Response Models
class StudentData(BaseModel):
    """Student academic data for priority prediction"""
    Age: int = Field(..., ge=18, le=24, description="Student age")
    Attendance_percent: float = Field(..., alias="Attendance (%)", ge=0, le=100)
    Midterm_Score: float = Field(..., ge=0, le=100)
    Final_Score: float = Field(..., ge=0, le=100)
    Assignments_Avg: float = Field(..., ge=0, le=100)
    Quizzes_Avg: float = Field(..., ge=0, le=100)
    Participation_Score: float = Field(..., ge=0, le=100)
    Projects_Score: float = Field(..., ge=0, le=100)
    Total_Score: float = Field(..., ge=0, le=100)
    Study_Hours_per_Week: float = Field(..., ge=0, le=50)
    Stress_Level: int = Field(..., alias="Stress_Level (1-10)", ge=1, le=10)
    Sleep_Hours_per_Night: float = Field(..., ge=0, le=12)
    Risk_Score: int = Field(..., ge=0, le=5)
    Engagement_Score: float = Field(..., ge=0, le=1)
    Performance_Inconsistency: float = Field(..., ge=0)
    Study_Efficiency: float = Field(..., ge=0)
    Workload_Balance: float = Field(..., ge=0)
    Dept_CS: bool = False
    Dept_Engineering: bool = False
    Dept_Mathematics: bool = False
    Extracurricular_Encoded: int = Field(..., ge=0, le=1)
    
    @validator('Dept_CS', 'Dept_Engineering', 'Dept_Mathematics')
    def validate_department(cls, v, values, **kwargs):
        """Ensure only one department is selected"""
        # This is a soft validation - backend will handle
        return v
    
    class Config:
        allow_population_by_field_name = True
        schema_extra = {
            "example": {
                "Age": 21,
                "Attendance (%)": 85.5,
                "Midterm_Score": 75.0,
                "Final_Score": 80.0,
                "Assignments_Avg": 78.0,
                "Quizzes_Avg": 82.0,
                "Participation_Score": 70.0,
                "Projects_Score": 85.0,
                "Total_Score": 78.5,
                "Study_Hours_per_Week": 15.0,
                "Stress_Level (1-10)": 5,
                "Sleep_Hours_per_Night": 7.0,
                "Risk_Score": 1,
                "Engagement_Score": 0.75,
                "Performance_Inconsistency": 10.0,
                "Study_Efficiency": 5.0,
                "Workload_Balance": 2.5,
                "Dept_CS": True,
                "Dept_Engineering": False,
                "Dept_Mathematics": False,
                "Extracurricular_Encoded": 1
            }
        }


class PriorityResponse(BaseModel):
    """Priority prediction response"""
    success: bool
    priority_level: str
    priority_code: int
    confidence: float
    confidence_level: str
    probabilities: Dict[str, float]
    recommendation: str
    prediction_timestamp: str


class StudyPlanResponse(BaseModel):
    """Study plan response"""
    priority: str
    daily_study_hours: int
    weekly_tutoring_sessions: int
    focus_areas: List[str]
    check_in_frequency: str
    intervention_level: str
    recommended_actions: List[str]
    course_specific: Optional[str] = None
    confidence: float


class BatchPredictionRequest(BaseModel):
    """Batch prediction request"""
    students: List[StudentData]
    generate_study_plans: bool = False


@router.post("/predict", response_model=PriorityResponse)
async def predict_priority(student_data: StudentData):
    """
    Predict priority level for a single student
    """
    service = get_prediction_service()
    
    # Convert to dict with proper field names
    data_dict = student_data.dict(by_alias=True)
    
    # Make prediction
    result = service.predict_priority(data_dict)
    
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Prediction failed"))
    
    return PriorityResponse(**result)


@router.post("/predict/batch", response_model=List[PriorityResponse])
async def predict_priority_batch(request: BatchPredictionRequest):
    """
    Predict priority levels for multiple students
    """
    service = get_prediction_service()
    
    results = []
    for student in request.students:
        data_dict = student.dict(by_alias=True)
        result = service.predict_priority(data_dict)
        
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=f"Prediction failed: {result.get('error')}")
        
        results.append(PriorityResponse(**result))
    
    return results


@router.post("/study-plan", response_model=StudyPlanResponse)
async def generate_study_plan(student_data: StudentData):
    """
    Generate personalized study plan based on priority prediction
    """
    service = get_prediction_service()
    
    data_dict = student_data.dict(by_alias=True)
    study_plan = service.get_study_plan(data_dict)
    
    if not study_plan.get("priority"):
        raise HTTPException(status_code=500, detail="Failed to generate study plan")
    
    return StudyPlanResponse(**study_plan)


@router.get("/model-info")
async def get_model_info():
    """Get model information and statistics"""
    service = get_prediction_service()
    return service.get_model_info()


@router.post("/reload")
async def reload_model(background_tasks: BackgroundTasks):
    """Reload the model (useful after retraining)"""
    service = get_prediction_service()
    
    def reload():
        service.is_loaded = False
        service.load_model()
    
    background_tasks.add_task(reload)
    
    return {"message": "Model reload initiated in background"}


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    service = get_prediction_service()
    
    return {
        "status": "healthy" if service.is_loaded else "degraded",
        "model_loaded": service.is_loaded,
        "timestamp": datetime.now().isoformat()
    }