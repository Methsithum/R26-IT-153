from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from datetime import datetime

class BehaviorAnalysisRequest(BaseModel):
    user_id: str

class BehaviorAnalysisResponse(BaseModel):
    studentId: str
    behaviorCategory: str
    reasoning: str
    nextSteps: List[Dict[str, str]] = []
    modelConfidence: Optional[float] = None
    modelName: Optional[str] = None
    topFeatures: List[Dict[str, Any]] = []
    generatedAt: datetime
    snapshotOfActivityData: Dict[str, Any]
