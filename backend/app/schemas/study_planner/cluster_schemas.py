"""Pydantic schemas for the behavioral clustering endpoint."""

from pydantic import BaseModel, Field


class BehaviorFeatures(BaseModel):
    """
    The 7 behavioral columns used in cluster_study_behavior.py. Note that
    has_vle_activity == 0 short-circuits to the fixed "No VLE Engagement
    Data" cluster rather than being fed to KMeans - see cluster_service.py.
    """

    avg_weekly_clicks: float = Field(..., description="Mean weekly VLE clicks for this student-module.")
    clicks_trend: float = Field(..., description="Recent week's clicks vs. the student's own earlier average.")
    active_weeks_ratio: float = Field(..., description="Proportion of weeks with any recorded VLE activity.")
    has_vle_activity: float = Field(..., description="1 if the student has any VLE click record, else 0.")
    prior_avg_score: float = Field(..., description="Student's mean score across their assessments in this module.")
    num_of_prev_attempts: float = Field(..., description="Student's prior attempts at this module.")
    studied_credits: float = Field(..., description="Total credits the student is currently studying.")


class ClusterResponse(BaseModel):
    """Output of cluster_service.predict_cluster()."""

    cluster_id: int = Field(..., description="KMeans cluster id (0-5), or -1 for the fixed no-VLE-activity group.")
    cluster_label: str = Field(..., description="Human-readable cluster name.")
