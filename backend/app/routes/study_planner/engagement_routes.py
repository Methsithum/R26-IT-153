"""
engagement_routes.py

POST /study-planner/engagement-features - the priority model's four
engagement features per subject, computed from the student's real journal
study logs (engagement_service.py). Read-only over the journal's
daily_sessions collection.
"""

from typing import Dict, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.services.auth import require_journal_owner
from app.models.journal.daily_session import session_collection
from app.services.study_planner.engagement_service import compute_engagement_features
from app.services.time_utils import local_today, to_local_date

router = APIRouter(prefix="/study-planner", tags=["study-planner"], dependencies=[Depends(require_journal_owner)])


class EngagementRequest(BaseModel):
    user_id: str
    planned_weekly_minutes: Dict[str, float] = Field(
        ..., description="Subject name -> minutes per week the planner allocates to it."
    )
    semester_start: Optional[str] = Field(None, description="ISO date; observation starts here if given.")


class SubjectEngagement(BaseModel):
    avg_weekly_clicks: float
    clicks_trend: float
    active_weeks_ratio: float
    has_vle_activity: int
    weeks_observed: int
    minutes_per_week: float


@router.post("/engagement-features", response_model=Dict[str, SubjectEngagement])
async def engagement_features(body: EngagementRequest):
    """Subjects with no completed week of history yet are omitted - the caller keeps neutral defaults for them."""
    sessions = list(
        session_collection.find(
            {"user_id": body.user_id, "study_duration_minutes": {"$gt": 0}},
            {"date": 1, "study_duration_minutes": 1, "subject_focus": 1, "today_subjects": 1},
        )
    )
    return compute_engagement_features(
        sessions,
        body.planned_weekly_minutes,
        today=local_today(),
        semester_start=to_local_date(body.semester_start),
    )
