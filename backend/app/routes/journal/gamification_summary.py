from fastapi import APIRouter, HTTPException
from app.services.journal.gamification import get_gamification_summary

router = APIRouter(prefix="/gamification", tags=["gamification"])


@router.get("/{user_id}")
async def gamification_summary(user_id: str):
    summary = await get_gamification_summary(user_id)
    if not summary:
        raise HTTPException(404, "User not found")
    return summary
