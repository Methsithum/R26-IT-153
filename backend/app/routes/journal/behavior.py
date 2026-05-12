from fastapi import APIRouter, HTTPException
from datetime import datetime
from app.schemas.journal.analysis import BehaviorAnalysisRequest, BehaviorAnalysisResponse
from app.models.user.user import UserModel
from app.models.journal.behavior_analysis import BehaviorAnalysisModel
from app.services.journal.behavior_analysis import build_activity_snapshot, analyze_behavior

router = APIRouter(prefix="/behavior", tags=["behavior"])


@router.post("/analyze", response_model=BehaviorAnalysisResponse)
async def analyze_behavior_category(req: BehaviorAnalysisRequest):
    user = await UserModel.find_by_id(req.user_id)
    if not user:
        raise HTTPException(404, "User not found")

    snapshot = await build_activity_snapshot(req.user_id)
    analysis = await analyze_behavior(snapshot)

    record = {
        "studentId": req.user_id,
        "behaviorCategory": analysis["behaviorCategory"],
        "reasoning": analysis["reasoning"],
        "timestamp": datetime.utcnow(),
        "snapshotOfActivityData": snapshot
    }

    await BehaviorAnalysisModel.create(record)

    return BehaviorAnalysisResponse(
        studentId=req.user_id,
        behaviorCategory=analysis["behaviorCategory"],
        reasoning=analysis["reasoning"],
        generatedAt=record["timestamp"],
        snapshotOfActivityData=snapshot
    )
