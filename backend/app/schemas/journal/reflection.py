# Request shape for the weekly reflection API.

from pydantic import BaseModel
from typing import Dict
from datetime import datetime

class WeeklyReflectionRequest(BaseModel):
    user_id: str
    week_start: datetime
    week_end: datetime
    answers: Dict[str, str] = {}