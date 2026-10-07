from pydantic import BaseModel
from typing import Dict, Any, List
from datetime import datetime

class BehaviorAnalysisRequest(BaseModel):
    user_id: str

class BehaviorAnalysisResponse(BaseModel):
    studentId: str
    behaviorCategory: str
    reasoning: str
    nextSteps: List[Dict[str, str]] = []
    generatedAt: datetime
    snapshotOfActivityData: Dict[str, Any]
