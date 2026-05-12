"""
Pydantic schemas for student input and prediction output.
All field ranges are validated at the API boundary.
"""

from pydantic import BaseModel, Field


# =============================================================================
# INPUT SCHEMAS
# =============================================================================

class StudentInput(BaseModel):
    """15 features that describe a single student's academic profile."""

    # Academic
    gpa_cumulative: float = Field(..., ge=0.0, le=4.0,
        description="Cumulative GPA on a 4.0 scale")
    gpa_trend: float = Field(..., ge=-2.0, le=2.0,
        description="Semester-over-semester GPA change")
    assignment_completion_rate: float = Field(..., ge=0.0, le=1.0,
        description="Proportion of assignments submitted (0–1)")
    late_submission_rate: float = Field(..., ge=0.0, le=1.0,
        description="Proportion of submissions that were late (0–1)")
    resit_count: int = Field(..., ge=0, le=10,
        description="Number of resit/retake examinations")
    project_performance: float = Field(..., ge=0.0, le=100.0,
        description="Average project score (0–100)")

    # Behavioral
    attendance_rate: float = Field(..., ge=0.0, le=1.0,
        description="Class attendance proportion (0–1)")
    weekly_study_hours: int = Field(..., ge=0, le=80,
        description="Self-reported study hours per week")
    sleep_hours_avg: float = Field(..., ge=3.0, le=12.0,
        description="Average nightly sleep hours")
    sleep_consistency: float = Field(..., ge=0.0, le=5.0,
        description="Sleep schedule regularity score")
    part_time_work_hours: int = Field(..., ge=0, le=40,
        description="Part-time employment hours per week")

    # Emotional
    stress_level: int = Field(..., ge=0, le=100,
        description="Self-reported stress level (0=none, 100=extreme)")
    anxiety_score: int = Field(..., ge=0, le=25,
        description="Anxiety inventory score (0–25)")
    mood_stability: int = Field(..., ge=0, le=100,
        description="Mood stability rating (0=unstable, 100=stable)")

    # Career
    career_clarity_score: int = Field(..., ge=0, le=100,
        description="Clarity of career goals (0=none, 100=very clear)")

    model_config = {
        "json_schema_extra": {
            "example": {
                "gpa_cumulative": 3.2,
                "gpa_trend": 0.1,
                "assignment_completion_rate": 0.85,
                "late_submission_rate": 0.10,
                "resit_count": 0,
                "project_performance": 78.0,
                "attendance_rate": 0.88,
                "weekly_study_hours": 25,
                "sleep_hours_avg": 6.5,
                "sleep_consistency": 1.1,
                "part_time_work_hours": 10,
                "stress_level": 40,
                "anxiety_score": 8,
                "mood_stability": 65,
                "career_clarity_score": 70,
            }
        }
    }


class SimulationInput(BaseModel):
    """Pair of student profiles for what-if scenario comparison."""

    original: StudentInput
    modified: StudentInput


# =============================================================================
# OUTPUT SCHEMAS
# =============================================================================

class PredictionOutput(BaseModel):
    """Full prediction result for one student."""

    # Risk classification
    risk_level: str = Field(..., description="Low / Medium / High")
    risk_score: int = Field(..., ge=0, le=100,
        description="Numeric risk indicator (Low≈20, Medium≈55, High≈85)")
    prob_low: float    = Field(..., description="Probability of Low risk class")
    prob_medium: float = Field(..., description="Probability of Medium risk class")
    prob_high: float   = Field(..., description="Probability of High risk class")

    # Career regression
    career_score: float = Field(..., ge=30.0, le=100.0,
        description="Predicted career readiness score (30–100)")
    career_grade: str = Field(...,
        description="Grade band: Poor / Fair / Good / Excellent")


class SimulationOutput(BaseModel):
    """Side-by-side comparison of two prediction scenarios."""

    original_prediction: PredictionOutput
    modified_prediction: PredictionOutput
    career_change: float = Field(...,
        description="Difference in career score (modified − original)")
    risk_changed: bool = Field(...,
        description="True if the risk level label changed between scenarios")
