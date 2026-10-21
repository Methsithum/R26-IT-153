"""Schemas for study-session history + the permission-first missed-session flow (session_routes.py)."""

from datetime import datetime
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.study_planner.schedule_schemas import FreeSlot

TIME_SLOT_PATTERN = r"^\d{2}:\d{2}-\d{2}:\d{2}$"
DATE_PATTERN = r"^\d{4}-\d{2}-\d{2}$"


class SessionInput(BaseModel):
    """One scheduled session as the frontend knows it (a ScheduledItem + its real date)."""

    date: str = Field(..., pattern=DATE_PATTERN, description="Real ISO date the session is on.")
    time_slot: str = Field(..., pattern=TIME_SLOT_PATTERN, description="'HH:MM-HH:MM'.")
    task_id: str
    module: str
    duration_minutes: int = Field(..., gt=0)
    task_type: Literal["assignment", "exam"] = "assignment"
    deadline_date: Optional[str] = Field(None, description="From the schedule's task registry.")


class SnapshotRequest(BaseModel):
    user_id: str
    sessions: List[SessionInput]


class SnapshotResponse(BaseModel):
    inserted: int


class MarkRequest(BaseModel):
    user_id: str
    session: SessionInput
    status: Literal["done", "missed"]


class LiveScheduleContext(BaseModel):
    """What the backend can't know on its own"""

    user_id: str
    week: Literal["this", "next"]
    weekly_free_slots: List[FreeSlot]
    occupied: Dict[str, List[str]] = Field(
        default_factory=dict, description="Real ISO date -> time_slots already taken by the live plan."
    )


class RescheduleToRequest(LiveScheduleContext):
    date: str = Field(..., pattern=DATE_PATTERN)
    time_slot: str = Field(..., pattern=TIME_SLOT_PATTERN)


class DeclineRequest(BaseModel):
    user_id: str


class SlotSuggestion(BaseModel):
    date: str
    time_slot: str
    duration_minutes: int
    fits: bool
    recommended: bool


class SuggestSlotsResponse(BaseModel):
    week: Literal["this", "next"]
    deadline_date: Optional[str] = None
    expired: bool
    can_use_this_week: bool
    can_use_next_week: bool
    suggestions: List[SlotSuggestion]
    warning: Optional[
        Literal["deadline_passed", "deadline_before_next_week", "no_slot_before_deadline", "only_partial_slots"]
    ] = None


class SessionResponse(BaseModel):
    id: str
    user_id: str
    date: str
    time_slot: str
    start_time: str
    end_time: str
    task_id: str
    module: str
    task_type: str = "assignment"
    duration_minutes: int
    deadline_date: Optional[str] = None
    status: Literal["pending", "done", "missed"]
    reschedule_decision: Optional[Literal["pending", "this_week", "next_week", "declined"]] = None
    rescheduled_from: Optional[str] = None
    rescheduled_to: Optional[str] = None
    source: Literal["schedule", "manual_reschedule"] = "schedule"
    marked_at: Optional[datetime] = None
    decided_at: Optional[datetime] = None


class RescheduleToResponse(BaseModel):
    missed: SessionResponse
    new_session: SessionResponse


class BlockedSlotResponse(BaseModel):
    date: str
    start_time: str
    end_time: str


class StatusBucket(BaseModel):
    count: int = 0
    minutes: int = 0


class SessionStatsResponse(BaseModel):
    done: StatusBucket
    missed: StatusBucket
    pending: StatusBucket
    completion_rate: Optional[float] = Field(
        None, description="done / (done + missed), 0-1. None until at least one session is marked."
    )
