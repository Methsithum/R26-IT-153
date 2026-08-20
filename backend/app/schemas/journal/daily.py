from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class StartDailyRequest(BaseModel):
    user_id: str
    date: datetime
    selected_activities: List[str]
    today_subjects: List[str] = []
    lecture_subjects: List[str] = []
    assignment_subjects: List[str] = []
    exam_subjects: List[str] = []
    exam_kinds: List[str] = []
    study_duration_minutes: Optional[int] = None
    subject_focus: Optional[str] = None
    engagement: Optional[str] = None
    extra_activity_type: Optional[str] = None
    extra_activity_minutes: Optional[int] = None

class AnswerRequest(BaseModel):
    session_id: str
    answer: str


class FinishRunRequest(BaseModel):
    session_id: str
    xp_earned: int
    score: int = 0

class MissingExam(BaseModel):
    id: str
    subject: str
    exam_type: str

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
    subject: Optional[str] = None
    subject_options: Optional[List[str]] = None
    missing_exams: Optional[List[MissingExam]] = None
    completed: bool = False
    journal_entry: Optional[str] = None
    journal_highlights: Optional[List[str]] = None
    total_xp: Optional[int] = None
    level: Optional[int] = None
    xp_earned: Optional[int] = None
    current_streak: Optional[int] = None
    longest_streak: Optional[int] = None
    badges: Optional[List[str]] = None
    new_badges: Optional[List[str]] = None
    current_day: Optional[int] = None
    daily_completed: Optional[bool] = None
