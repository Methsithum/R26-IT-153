from typing import List, Optional

from pydantic import BaseModel, Field


class SimulatedDayPlan(BaseModel):
    play: bool = True
    on_time: bool = True
    questions_count: int = 0
    engagement: Optional[str] = None
    has_at_risk: bool = False


class GamificationSimulatorRequest(BaseModel):
    plan: List[SimulatedDayPlan] = Field(default_factory=list)
    starting_total_xp: int = 0
    starting_badges: List[str] = Field(default_factory=list)
    starting_completed_journals: int = 0
    starting_completed_tasks: int = 0
