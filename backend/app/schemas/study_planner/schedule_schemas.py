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
    task_type: Literal["assignment", "exam"] = "assignment"


class TaskRegistryEntry(BaseModel):
    """One entry of the schedule's task registry - see StudyScheduler.generate_schedule()."""

    module: str
    weight: float
    priority_label: Literal["High", "Medium", "Low"]
    deadline_date: str
    estimated_hours_needed: float
    # Round-tripped from TaskInput.task_type (see task_schemas.py) so the
    # frontend can tell exam-prep sessions apart from assignment sessions
    # purely from schedule.tasks[taskId] - see PROJECT CONTEXT.md Section 5d.
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


# ---------------------------------------------------------------------------
# Rolling multi-week scheduling (PROJECT CONTEXT.md Section 8d)
# ---------------------------------------------------------------------------
# DESIGN CHOICE: a separate endpoint, not optional parameters bolted onto
# /schedule. ScheduleResponse.schedule is keyed by weekday NAME (Monday..
# Sunday, one week only); a multi-week result is keyed by real ISO DATE
# across many weeks and needs extra fields /schedule callers never expect
# (weeks_generated, range_start/end, weeks_allocated per task). Reusing
# /schedule's existing, already-documented single-week contract for both
# shapes (via an optional flag) would make every existing caller's response
# type conditional on a request flag - a new endpoint with its own explicit
# response shape is simpler to reason about and doesn't risk the current
# single-week callers (used for the actual currently-viewed week, still the
# only source of the LIVE-adjustable /reschedule flow) breaking if this one
# changes.

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
