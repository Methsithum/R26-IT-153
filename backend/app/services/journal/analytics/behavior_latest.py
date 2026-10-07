"""Read-only lookup of the latest stored behaviour analysis. Never calls the
LLM - that only happens via the existing POST /behavior/analyze, from a
button. This just reads what's already in the behavior_analysis collection."""

from typing import Dict

from app.models.journal.behavior_analysis import BehaviorAnalysisModel


async def get_latest_behavior_analysis(user_id: str) -> Dict:
    record = await BehaviorAnalysisModel.find_latest_by_user(user_id)
    if not record:
        return {"available": False}
    return {
        "available": True,
        "behaviorCategory": record.get("behaviorCategory"),
        "reasoning": record.get("reasoning"),
        "nextSteps": record.get("nextSteps") or [],
        "created_at": record.get("created_at"),
        "generated_at": record.get("timestamp"),
        "snapshotOfActivityData": record.get("snapshotOfActivityData"),
    }
