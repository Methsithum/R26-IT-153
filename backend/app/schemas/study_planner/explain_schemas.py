"""Pydantic schemas for the SHAP explainability endpoint."""

from typing import Dict, Literal

from pydantic import BaseModel, Field


class ExplainResponse(BaseModel):
    """Output of explain_service.explain_task()."""

    predicted_priority: Literal["High", "Medium", "Low"] = Field(..., description="Predicted priority tier.")
    feature_contributions: Dict[str, float] = Field(
        ..., description="SHAP value per feature, toward the predicted class (positive = pushed toward it)."
    )
    explanation_sentence: str = Field(..., description="Plain-English summary of the top contributing features.")
