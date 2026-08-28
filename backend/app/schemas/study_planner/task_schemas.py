"""Pydantic schemas describing a task, both as raw model features and as scheduler input."""

from typing import Literal, Optional

from pydantic import BaseModel, Field


class TaskFeatures(BaseModel):
    """
    The 13 raw features the trained priority_model.joblib (XGBoost) was
    trained on, in the same units/encoding as train_priority_model.py.
    See app/services/study_planner/priority_service.py:FEATURE_ORDER.
    """

    date: float = Field(..., description="Assessment deadline, as day-of-module offset.")
    weight: float = Field(..., description="Assessment weight (0-100 scale, OULAD convention).")
    num_of_prev_attempts: float = Field(..., description="Student's prior attempts at this module.")
    studied_credits: float = Field(..., description="Total credits the student is currently studying.")
    module_presentation_length: float = Field(..., description="Length of the module presentation, in days.")
    date_registration: float = Field(..., description="Days relative to module start when the student registered.")
    prior_avg_score: float = Field(..., description="Student's expanding-mean score across prior assessments in this module (leakage-free).")
    avg_weekly_clicks: float = Field(..., description="Mean weekly VLE clicks for this student-module so far.")
    clicks_trend: float = Field(..., description="Recent week's clicks vs. the student's own earlier average.")
    active_weeks_ratio: float = Field(..., description="Proportion of weeks with any recorded VLE activity.")
    has_vle_activity: float = Field(..., description="1 if the student has any VLE click record for this module, else 0.")
    assessment_type_enc: float = Field(..., description="LabelEncoder-encoded assessment_type (see label_encoders.joblib).")
    code_module_enc: float = Field(..., description="LabelEncoder-encoded code_module (see label_encoders.joblib).")


class TaskInput(BaseModel):
    """
    A task as given to the scheduler. priority_label is optional - if
    omitted, the caller must supply feature_row so the API can predict it
    via the trained classifier (see schedule_service._ensure_priority_label).
    """

    task_id: str = Field(..., description="Caller-assigned unique id for this task.")
    module: str = Field(..., description="Module code this task belongs to, e.g. 'AAA'.")
    deadline_date: str = Field(..., description="ISO date (YYYY-MM-DD) the task is due.")
    weight: float = Field(..., description="Assessment weight (0-100 scale).")
    estimated_hours_needed: float = Field(..., description="Estimated study hours needed to complete this task.")
    priority_label: Optional[Literal["High", "Medium", "Low"]] = Field(
        None, description="Priority tier. If omitted, feature_row is required so the API can predict it."
    )
    feature_row: Optional[TaskFeatures] = Field(
        None, description="The 13 model features, required only when priority_label is omitted."
    )
