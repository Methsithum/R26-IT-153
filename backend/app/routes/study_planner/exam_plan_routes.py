"""
exam_plan_routes.py

Lets the Study Planner record two planning facts on the journal's real
`exams` documents (through ExamModel, the same way task_routes.py writes an
assignment's weight back into `tasks`):

  - exam_session: "morning" | "afternoon" - the student only picks the half
    of the day; the actual times are derived from it on the frontend
    (utils/examDay.js's EXAM_SESSION_TIMES).
  - after_exam_revision: true | false - the student's answer to "on a day
    with an exam, and another exam the next day, may we add a short
    revision session after this exam for tomorrow's one?". Exam days are
    otherwise kept completely free; this is asked, never assumed.
"""

from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.services.auth import require_journal_owner
from app.models.journal.exam import ExamModel

router = APIRouter(prefix="/study-planner/exams", tags=["study-planner"], dependencies=[Depends(require_journal_owner)])


class ExamPlanUpdate(BaseModel):
    user_id: str
    exam_session: Optional[Literal["morning", "afternoon"]] = Field(None, description="Which half of the day the exam is in.")
    after_exam_revision: Optional[bool] = Field(None, description="Allow revision after this exam for the next day's exam.")


class ExamPlanResponse(BaseModel):
    id: str
    exam_session: Optional[Literal["morning", "afternoon"]] = None
    after_exam_revision: Optional[bool] = None


@router.patch("/{exam_id}/plan", response_model=ExamPlanResponse)
async def update_exam_plan(exam_id: str, body: ExamPlanUpdate):
    update = body.model_dump(exclude_none=True, exclude={"user_id"})
    if not update:
        raise HTTPException(status_code=422, detail="Nothing to update - send exam_session and/or after_exam_revision.")
    exam = next((e for e in await ExamModel.find_by_user(body.user_id) if e["id"] == exam_id), None)
    if not exam:
        raise HTTPException(status_code=404, detail=f"Exam {exam_id} not found.")
    await ExamModel.update(exam_id, update)
    exam.update(update)
    return exam
