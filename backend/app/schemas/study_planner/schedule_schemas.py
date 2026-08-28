"""Pydantic schemas for the scheduling endpoints (StudyScheduler)."""

from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.study_planner.task_schemas import TaskInput


class FreeSlot(BaseModel):
    """One block of time not already occupied by lectures/commitments."""

    day: Literal["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] = Field(
        ..., description="Day of the week this slot falls on."
    )
    start_time: str = Field(..., description="Slot start time, 'HH:MM' 24-hour format.")
    end_time: str = Field(..., description="Slot end time, 'HH:MM' 24-hour format.")
    duration_minutes: int = Field(..., description="Slot length in minutes.")


class ScheduleRequest(BaseModel):
    """Input for POST /study-planner/schedule."""

    weekly_free_slots: List[FreeSlot] = Field(..., description="Available time slots for the week.")
    tasks: List[TaskInput] = Field(..., description="Tasks to schedule.")


class ScheduledItem(BaseModel):
    time_slot: str
    task_id: str
    module: str
    duration_minutes: int


class OverloadWarningItem(BaseModel):
    task_id: str
    module: str
    priority_label: Literal["High", "Medium", "Low"]
    deadline_date: str
    hours_short: float


class TaskRegistryEntry(BaseModel):
    """One entry of the schedule's task registry - see StudyScheduler.generate_schedule()."""

    module: str
    weight: float
    priority_label: Literal["High", "Medium", "Low"]
    deadline_date: str
    estimated_hours_needed: float


class ScheduleResponse(BaseModel):
    """Output of StudyScheduler.generate_schedule() / .reschedule(), unchanged."""

    schedule: Dict[str, List[ScheduledItem]] = Field(..., description="Day -> list of scheduled study sessions.")
    overload_warning: List[OverloadWarningItem] = Field(
        ..., description="Tasks that could not be fully scheduled before their deadline."
    )
    tasks: Dict[str, TaskRegistryEntry] = Field(
        ..., description="Every task known to the scheduler at generation time, by task_id."
    )


class RescheduleRequest(BaseModel):
    """
    Input for POST /study-planner/reschedule.

    DESIGN NOTE: StudyScheduler can't persist between stateless HTTP requests
    (see schedule_service.reschedule()'s docstring), so this request carries
    everything needed to reconstruct an equivalent scheduler:
      - previous_schedule.tasks: the task registry from the prior response
        (includes weight, so every task round-trips straight into add_task()).
      - remaining_free_slots: whatever free-slot capacity is still
        unallocated. This is NOT part of ScheduleResponse (generate_schedule()
        only returns schedule/overload_warning/tasks), so the caller must
        track and resend it - typically by having the frontend cache the
        weekly_free_slots it originally sent and subtract what generate_schedule()
        placed, or by a session/cache layer doing the same server-side.
    """

    previous_schedule: ScheduleResponse = Field(..., description="The prior /schedule or /reschedule response.")
    remaining_free_slots: List[FreeSlot] = Field(
        ..., description="Free-slot capacity still unallocated since the previous schedule was generated."
    )
    completed_task_ids: List[str] = Field(..., description="Task ids the student has finished since last time.")
    new_tasks: Optional[List[TaskInput]] = Field(None, description="Any new tasks that have appeared.")
