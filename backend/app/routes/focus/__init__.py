from fastapi import APIRouter

from .leaderboard import router as leaderboard_router
from .predict import router as predict_router
from .reports import router as reports_router
from .sessions import router as sessions_router

router = APIRouter()
router.include_router(predict_router)
router.include_router(sessions_router)
router.include_router(reports_router)
router.include_router(leaderboard_router)
