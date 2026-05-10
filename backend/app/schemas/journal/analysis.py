from pydantic import BaseModel
from typing import Dict, Any
from datetime import datetime

class BehaviorAnalysisRequest(BaseModel):
    user_id: str

class BehaviorAnalysisResponse(BaseModel):
    studentId: str
    behaviorCategory: str
    reasoning: str
    generatedAt: datetime
    snapshotOfActivityData: Dict[str, Any]
