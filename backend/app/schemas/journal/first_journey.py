from pydantic import BaseModel
from typing import Any, Dict, List, Optional


class FirstJourneyStartRequest(BaseModel):
    user_id: str


class FirstJourneyAnswerRequest(BaseModel):
    user_id: str
    question_id: str
    answer: str


class FirstJourneyQuestionResponse(BaseModel):
    completed: bool = False
    question_id: Optional[str] = None
    question: Optional[str] = None
    options: Optional[List[str]] = None
    question_type: str = "lane"  # lane | number | text | date
    profile: Optional[Dict[str, Any]] = None
