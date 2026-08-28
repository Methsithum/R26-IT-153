from fastapi import APIRouter, HTTPException
from app.models.user.user import UserModel
from app.services.journal.learning_patterns import get_learning_insights
import logging

router = APIRouter(prefix="/learning-insights", tags=["learning-insights"])
logger = logging.getLogger(__name__)


@router.get("/{user_id}")
async def fetch_learning_insights(user_id: str):
    """
    Retrieve learning insights and aggregated patterns for a user.
    
    Returns:
    - insights: List of human-readable insight strings with emojis
    - patterns: Detailed aggregated learning patterns from last 30 days
      - total_sessions, average_study_time, most_active_subject
      - preferred_activities, engagement_trend, engagement_distribution
    """
    user = await UserModel.find_by_id(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    
    try:
        insights_data = await get_learning_insights(user_id)
        return {
            "user_id": user_id,
            "user_name": user.get("name"),
            "insights": insights_data.get("insights", []),
            "patterns": insights_data.get("patterns", {})
        }
    except Exception as e:
        logger.exception(f"Failed to fetch learning insights for user {user_id}")
        raise HTTPException(500, "Failed to fetch learning insights")
