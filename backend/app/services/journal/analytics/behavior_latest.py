"""Read-only lookup of the latest stored behaviour analysis. Never calls the
LLM - that only happens via the existing POST /behavior/analyze, from a
button. This just reads what's already in the behavior_analysis collection."""

from typing import Dict

from app.models.journal.behavior_analysis import BehaviorAnalysisModel
from app.models.user.user import UserModel


async def get_latest_behavior_analysis(user_id: str) -> Dict:
    user = await UserModel.find_by_id(user_id) or {}
    state = user.get("behavior_analysis_state") or {}
    record = await BehaviorAnalysisModel.find_latest_by_user(user_id)
    if state.get("status") in {"failed", "running", "stale"} or not record or record.get("journal_revision", 0) != user.get("journal_revision", 0):
        return {"available": False, "status": state.get("status", "missing"),
                "error": state.get("error"), "updated_at": state.get("updated_at")}
    return {
        "available": True,
        "status": "ready",
        "behaviorCategory": record.get("behaviorCategory"),
        "reasoning": record.get("reasoning"),
        "nextSteps": record.get("nextSteps") or [],
        "trigger": record.get("trigger") or "manual",
        "created_at": record.get("created_at"),
        "generated_at": record.get("timestamp"),
        "snapshotOfActivityData": record.get("snapshotOfActivityData"),
    }
