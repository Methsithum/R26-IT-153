from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from app.models.user.user import UserModel
from app.schemas.journal.analytics import GamificationSimulatorRequest
from app.services.journal.analytics.alert_rules import evaluate_alert_rules_for_user, get_alert_rule_catalog
from app.services.journal.analytics.data_quality import build_data_quality_report
from app.services.journal.analytics.insights import build_study_insights
from app.services.journal.analytics.question_catalog import list_question_catalog
from app.services.journal.analytics.simulator import simulate_gamification

router = APIRouter(prefix="/analytics", tags=["analytics"])


async def _require_user(user_id: str) -> dict:
    user = await UserModel.find_by_id(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return user


@router.get("/insights/{user_id}")
async def study_insights(user_id: str):
    await _require_user(user_id)
    return await build_study_insights(user_id)


@router.get("/data-quality/{user_id}")
async def data_quality(user_id: str):
    await _require_user(user_id)
    return await build_data_quality_report(user_id)


@router.get("/alert-rules")
async def alert_rule_catalog():
    return {"rules": await get_alert_rule_catalog()}


@router.get("/alert-rules/{user_id}")
async def alert_rules_for_user(user_id: str):
    await _require_user(user_id)
    return await evaluate_alert_rules_for_user(user_id)


@router.get("/question-bank")
async def question_bank(category: Optional[str] = Query(None), activity: Optional[str] = Query(None)):
    return list_question_catalog(category=category, activity=activity)


@router.post("/gamification-simulator")
async def gamification_simulator(req: GamificationSimulatorRequest):
    if len(req.plan) > 90:
        raise HTTPException(400, "Plan cannot exceed 90 simulated days")
    plan = [day.model_dump() for day in req.plan]
    return simulate_gamification(
        plan,
        starting_total_xp=req.starting_total_xp,
        starting_badges=req.starting_badges,
        starting_completed_journals=req.starting_completed_journals,
        starting_completed_tasks=req.starting_completed_tasks,
    )
