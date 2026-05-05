from app.models.journal.learning_pattern import LearningPatternModel
from app.models.journal.daily_session import DailySessionModel
from typing import Dict, List, Any
from datetime import datetime, timezone, timedelta


async def aggregate_learning_patterns(user_id: str) -> Dict[str, Any]:
    """
    Aggregate learning patterns from user's session history.
    Returns insights on: productivity by subject, activity effectiveness, time patterns.
    """
    
    # Get last 30 days of sessions
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    sessions = await DailySessionModel.find_user_sessions(user_id)
    recent_sessions = [s for s in sessions if s.get("date", datetime.utcnow()) >= thirty_days_ago]
    
    if not recent_sessions:
        return {
            "total_sessions": 0,
            "average_study_time": 0,
            "most_active_subject": None,
            "preferred_activities": [],
            "engagement_trend": "insufficient_data"
        }
    
    # Aggregate data
    total_study_time = 0
    subject_times = {}
    activity_counts = {}
    engagement_levels = []
    
    for session in recent_sessions:
        # Study time
        study_mins = session.get("study_duration_minutes", 0) or 0
        total_study_time += study_mins
        
        # Subject focus
        subject = session.get("subject_focus")
        if subject:
            subject_times[subject] = subject_times.get(subject, 0) + study_mins
        
        # Activities
        activities = session.get("selected_activities", [])
        for activity in activities:
            activity_counts[activity] = activity_counts.get(activity, 0) + 1
        
        # Engagement
        engagement = session.get("engagement")
        if engagement:
            engagement_levels.append(engagement)
    
    # Calculate insights
    avg_study = total_study_time / len(recent_sessions) if recent_sessions else 0
    most_active_subject = max(subject_times, key=subject_times.get) if subject_times else None
    top_activities = sorted(activity_counts.items(), key=lambda x: x[1], reverse=True)[:3]
    
    # Engagement trend
    if engagement_levels:
        high_engagement = engagement_levels.count("high")
        low_engagement = engagement_levels.count("low")
        engagement_trend = "improving" if high_engagement > low_engagement else "declining"
    else:
        engagement_trend = "neutral"
    
    patterns = {
        "user_id": user_id,
        "total_sessions": len(recent_sessions),
        "average_study_time": round(avg_study, 2),
        "total_study_time": total_study_time,
        "most_active_subject": most_active_subject,
        "subject_breakdown": subject_times,
        "preferred_activities": [a[0] for a in top_activities],
        "activity_counts": activity_counts,
        "engagement_trend": engagement_trend,
        "engagement_distribution": {
            "high": engagement_levels.count("high"),
            "medium": engagement_levels.count("medium"),
            "low": engagement_levels.count("low")
        },
        "data_period_days": 30,
        "last_updated": datetime.utcnow()
    }
    
    # Store patterns
    await LearningPatternModel.update(user_id, patterns)
    
    return patterns


async def get_learning_insights(user_id: str) -> Dict[str, str]:
    """
    Generate human-readable learning insights for display.
    """
    patterns = await aggregate_learning_patterns(user_id)
    
    insights = []
    
    if patterns.get("most_active_subject"):
        insights.append(
            f"📚 You're strongest in {patterns['most_active_subject']} "
            f"({patterns['subject_breakdown'].get(patterns['most_active_subject'], 0)} minutes total)"
        )
    
    if patterns.get("preferred_activities"):
        top_activity = patterns["preferred_activities"][0]
        insights.append(f"⭐ Most frequent activity: {top_activity.replace('_', ' ').title()}")
    
    if patterns.get("average_study_time") > 120:
        insights.append("💪 Excellent study consistency! Keep it up!")
    elif patterns.get("average_study_time") < 60:
        insights.append("⚠️ Try to increase daily study time to 2+ hours for better retention")
    
    if patterns.get("engagement_trend") == "improving":
        insights.append("📈 Your engagement is improving - great progress!")
    elif patterns.get("engagement_trend") == "declining":
        insights.append("📉 Your engagement has been declining - consider taking breaks or changing activities")
    
    return {
        "insights": insights,
        "patterns": patterns
    }
