from fastapi import APIRouter
from app.services.journal.gamification import get_leaderboard

router = APIRouter(prefix="/leaderboard", tags=["gamification"])


@router.get("")
async def leaderboard(limit: int = 10):
    results = await get_leaderboard(limit=limit)
    return {"leaderboard": results}
