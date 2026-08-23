"""Pydantic schemas for the to-do list endpoint."""

from typing import Literal

from pydantic import BaseModel, Field


class TodoItem(BaseModel):
    """One entry of the to-do list produced by todo_service.get_todo_list()."""

    task_id: str
    module: str
    priority_label: Literal["High", "Medium", "Low"]
    deadline_date: str = Field(..., description="ISO date (YYYY-MM-DD) the task is due.")
    days_remaining: int = Field(..., description="Days until the deadline (negative if overdue).")
    recommended_next_session: str = Field(..., description="The task's next scheduled slot, or a 'not yet scheduled' note.")
    reminder_message: str = Field(..., description="Human-readable, priority/urgency-aware reminder.")
