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


class BlockedSlot(BaseModel):
    """A real-dated range the generator must NOT fill"""

    date: str = Field(..., description="ISO date (YYYY-MM-DD) the blocked range falls on.")
    start_time: str = Field(..., description="'HH:MM' 24-hour format.")
    end_time: str = Field(..., description="'HH:MM' 24-hour format.")


class ScheduleRequest(BaseModel):
    """Input for POST /study-planner/schedule."""

    weekly_free_slots: List[FreeSlot] = Field(..., description="Available time slots for the week.")
    tasks: List[TaskInput] = Field(..., description="Tasks to schedule.")
    blocked_slots: Optional[List[BlockedSlot]] = Field(None, description="Manually booked ranges to keep free of generated sessions.")


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
    task_type: Literal["assignment", "exam"] = "assignment"


class TaskRegistryEntry(BaseModel):
    """One entry of the schedule's task registry - see StudyScheduler.generate_schedule()."""

    module: str
    weight: float
    priority_label: Literal["High", "Medium", "Low"]
    deadline_date: str
    estimated_hours_needed: float
    # Round-tripped from TaskInput.task_type
    task_type: Literal["assignment", "exam"] = "assignment"


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
    """Input for POST /study-planner/reschedule."""

    previous_schedule: ScheduleResponse = Field(..., description="The prior /schedule or /reschedule response.")
    remaining_free_slots: List[FreeSlot] = Field(
        ..., description="Free-slot capacity still unallocated since the previous schedule was generated."
    )
    completed_task_ids: List[str] = Field(..., description="Task ids the student has finished since last time.")
    new_tasks: Optional[List[TaskInput]] = Field(None, description="Any new tasks that have appeared.")
    blocked_slots: Optional[List[BlockedSlot]] = Field(None, description="Manually booked ranges to keep free of generated sessions.")


# Rolling multi-week scheduling (PROJECT CONTEXT.md Section 8d)

class MultiWeekScheduleRequest(BaseModel):
    """Input for POST /study-planner/multi-week-schedule."""

    weekly_free_slots: List[FreeSlot] = Field(
        ..., description="The recurring weekly free-time pattern, assumed to repeat identically every generated week."
    )
    tasks: List[TaskInput] = Field(
        ...,
        description="Tasks to schedule, each carrying its TOTAL remaining estimated_hours_needed (not pre-split "
                    "per week) - the rolling allocator determines which week(s) each task actually lands in.",
    )
    weeks_ahead: Optional[int] = Field(
        None,
        description="Explicit number of weeks to generate. If omitted, auto-derived from the farthest task "
                    "deadline (preferred). Always capped at 12 weeks regardless.",
    )
    blocked_slots: Optional[List[BlockedSlot]] = Field(None, description="Manually booked ranges to keep free of generated sessions.")


class MultiWeekTaskRegistryEntry(TaskRegistryEntry):
    """TaskRegistryEntry plus which generated week(s) this task's hours were actually allocated across."""

    weeks_allocated: List[int] = Field(
        default_factory=list,
        description="0-indexed week numbers (0 = the current/first generated week) this task received any hours "
                    "in. Empty if the task received none (see overload_warning).",
    )


class MultiWeekScheduleResponse(BaseModel):
    """Output of schedule_engine.generate_rolling_schedule()."""

    schedule: Dict[str, List[ScheduledItem]] = Field(
        ..., description="Real ISO date (YYYY-MM-DD) -> list of scheduled study sessions. Every date in the "
                          "generated range is present, even with an empty list."
    )
    overload_warning: List[OverloadWarningItem] = Field(
        ..., description="Tasks that could not be fully scheduled before their deadline, reported once - in the "
                          "week that actually contains that deadline, not speculatively in an earlier week."
    )
    tasks: Dict[str, MultiWeekTaskRegistryEntry] = Field(
        ..., description="Every task known to the scheduler, by task_id, including which generated week(s) it was actually allocated in."
    )
    weeks_generated: int = Field(..., description="How many consecutive weeks were actually generated (<= 12).")
    range_start: str = Field(..., description="ISO date of the first day generated (today, at request time).")
    range_end: str = Field(..., description="ISO date of the last day generated.")
