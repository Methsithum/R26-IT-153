from pydantic import BaseModel
from typing import Dict
from datetime import datetime

class WeeklyReflectionRequest(BaseModel):
    user_id: str
    week_start: datetime
    week_end: datetime
    answers: Dict[str, str]

class SemesterReflectionRequest(BaseModel):
    user_id: str
    semester: str
    answers: Dict[str, str]