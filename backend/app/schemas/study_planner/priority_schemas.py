"""Pydantic schemas for the priority prediction endpoint."""

from typing import Literal

from pydantic import BaseModel, Field


class PriorityResponse(BaseModel):
    """Output of priority_service.predict_priority()."""

    priority_label: Literal["High", "Medium", "Low"] = Field(..., description="Predicted priority tier.")
    confidence: float = Field(..., description="Model's predicted probability for the chosen class (0-1).")
