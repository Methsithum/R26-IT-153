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
    question_id: Optional[str] = None
    question: Optional[str] = None
    options: Optional[List[str]] = None
    category: Optional[str] = None
    answer_type: Optional[str] = None
    requires_special_interaction: bool = False
    interaction_type: Optional[str] = None
    target_location: Optional[str] = None
    context_field: Optional[str] = None
    completed: bool = False
    journal_entry: Optional[str] = None