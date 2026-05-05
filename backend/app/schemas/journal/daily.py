from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class StartDailyRequest(BaseModel):
    user_id: str
    date: datetime
    selected_activities: List[str]
    study_duration_minutes: Optional[int] = None
    subject_focus: Optional[str] = None
    engagement: Optional[str] = None
    extra_activity_type: Optional[str] = None
    extra_activity_minutes: Optional[int] = None

class AnswerRequest(BaseModel):
    session_id: str
    answer: str

class NextQuestionResponse(BaseModel):
    session_id: str
    question: Optional[str] = None
    options: Optional[List[str]] = None
    completed: bool = False
    journal_entry: Optional[str] = None