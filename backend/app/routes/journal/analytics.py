from fastapi import APIRouter, HTTPException, Query

from app.models.user.user import UserModel
from app.services.journal.analytics.behavior_latest import get_latest_behavior_analysis
from app.services.journal.analytics.insights import ALLOWED_WINDOWS, InvalidWindowError, build_learning_patterns

router = APIRouter(prefix="/analytics", tags=["analytics"])


async def _require_user(user_id: str) -> dict:
    user = await UserModel.find_by_id(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return user


@router.get("/learning-patterns/{user_id}")
async def learning_patterns(user_id: str, window: int = Query(30)):
    if window not in ALLOWED_WINDOWS:
        raise HTTPException(422, f"window must be one of {ALLOWED_WINDOWS}")
    await _require_user(user_id)
    try:
        return await build_learning_patterns(user_id, window_days=window)
    except InvalidWindowError as exc:
        raise HTTPException(422, str(exc)) from exc


@router.get("/behavior-latest/{user_id}")
async def behavior_latest(user_id: str):
    await _require_user(user_id)
    return await get_latest_behavior_analysis(user_id)
