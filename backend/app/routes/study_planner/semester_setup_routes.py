"""semester_setup_routes.py"""

from datetime import date
from typing import Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator

from app.services.auth import require_journal_owner
from app.models.user.user import UserModel

router = APIRouter(prefix="/study-planner/semester-setup", tags=["study-planner"], dependencies=[Depends(require_journal_owner)])


class SubjectSetup(BaseModel):
    credits: float = Field(..., ge=0, le=40, description="Credit value of this subject.")
    prev_attempts: int = Field(0, ge=0, le=6, description="Times this subject was attempted before (0 = first time).")


class SemesterSetup(BaseModel):
    semester_start: date
    semester_end: date
    registered_on: date = Field(..., description="When the student registered/enrolled for this semester.")
    subjects: Dict[str, SubjectSetup] = Field(default_factory=dict)

    @model_validator(mode="after")
    def check_dates(self):
        if self.semester_end <= self.semester_start:
            raise ValueError("semester_end must be after semester_start.")
        if (self.semester_end - self.semester_start).days > 366:
            raise ValueError("A semester can't be longer than a year.")
        return self


class SemesterSetupRequest(SemesterSetup):
    user_id: str


@router.get("/{user_id}", response_model=Optional[SemesterSetup])
async def get_semester_setup(user_id: str):
    user = await UserModel.find_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return user.get("study_planner_setup")


@router.put("", response_model=SemesterSetup)
async def save_semester_setup(body: SemesterSetupRequest):
    if not await UserModel.find_by_id(body.user_id):
        raise HTTPException(status_code=404, detail="User not found.")
    setup = body.model_dump(mode="json", exclude={"user_id"})
    await UserModel.update(body.user_id, {"study_planner_setup": setup})
    return setup
