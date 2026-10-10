from fastapi import APIRouter, HTTPException, Depends
from app.services.auth import require_journal_owner
from app.schemas.journal.analysis import BehaviorAnalysisRequest, BehaviorAnalysisResponse
from app.models.user.user import UserModel
from app.services.journal.behavior_analysis import run_and_store_behavior_analysis

router = APIRouter(prefix="/behavior", tags=["behavior"], dependencies=[Depends(require_journal_owner)])


@router.post("/analyze", response_model=BehaviorAnalysisResponse)
async def analyze_behavior_category(req: BehaviorAnalysisRequest):
    user = await UserModel.find_by_id(req.user_id)
    if not user:
        raise HTTPException(404, "User not found")

    record = await run_and_store_behavior_analysis(req.user_id, trigger="manual")

    return BehaviorAnalysisResponse(
        studentId=req.user_id,
        behaviorCategory=record["behaviorCategory"],
        reasoning=record["reasoning"],
        nextSteps=record["nextSteps"],
        generatedAt=record["timestamp"],
        snapshotOfActivityData=record["snapshotOfActivityData"],
    )
