"""
Schemas for the Study Planner's writes back into the journal's real `tasks`
collection (assignment weight, deadline, and creating a brand-new
assignment) - see app/routes/study_planner/task_routes.py for why these
exist: the model needs real per-task weight/deadline to predict priority
accurately, and "Add Academic Data" needs its entries to survive the
student's next login instead of only living in frontend state.
"""

from typing import Optional

from pydantic import BaseModel, Field


class TaskWeightUpdate(BaseModel):
    weight: float = Field(..., ge=0, le=100, description="Assessment weight, 0-100 scale.")


class TaskDeadlineUpdate(BaseModel):
    deadline: str = Field(..., description="ISO date (YYYY-MM-DD) the task is due.")


class TaskCreateRequest(BaseModel):
    user_id: str = Field(..., description="The student this assignment belongs to.")
    subject: str = Field(..., description="Module/subject name - should match one of the student's registered subjects.")
    title: str = Field(..., description="Assignment title, e.g. 'TMA04 - Concurrency'.")
    deadline: Optional[str] = Field(None, description="ISO date (YYYY-MM-DD) the task is due.")
    weight: Optional[float] = Field(None, ge=0, le=100, description="Assessment weight, 0-100 scale.")


class TaskResponse(BaseModel):
    id: str
    user_id: str
    title: str
    subject: str
    task_type: str
    progress_stage: str
    deadline: Optional[str] = None
    weight: Optional[float] = None
    mark: Optional[float] = None
