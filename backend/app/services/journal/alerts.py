from typing import Dict, List, Any


def generate_proactive_alerts(at_risk_tasks: List[Dict], derived_flags: Dict[str, bool]) -> List[str]:
    """
    Generate proactive alerts based on at-risk tasks and derived context flags.
    Returns list of alert strings for inclusion in journal entry.
    """
    alerts = []
    
    # Alert 1: Critical at-risk tasks (deadline tomorrow)
    critical_tasks = [t for t in at_risk_tasks if t.get("urgency") == "critical"]
    if critical_tasks:
        for task in critical_tasks:
            alerts.append(
                f"🚨 CRITICAL: '{task['title']}' is due TODAY and status is {task['progress']}. "
                f"This requires immediate attention!"
            )
    
    # Alert 2: High-urgency tasks (deadline within 2 days)
    high_tasks = [t for t in at_risk_tasks if t.get("urgency") == "high"]
    if high_tasks:
        for task in high_tasks:
            days = task.get("days_left", 2)
            alerts.append(
                f"⚠️  '{task['title']}' due in {days} day(s) with status: {task['progress']}. "
                f"Consider starting/resuming work today."
            )
    
    # Alert 3: Low study time warning
    if derived_flags.get("low_study"):
        alerts.append(
            "📚 Low study time today. Aim for at least 2 hours of focused study for better learning retention."
        )
    
    # Alert 4: Overload warning
    if derived_flags.get("overloaded"):
        alerts.append(
            "⚖️  Your extra-curricular activities took more time than academics today. "
            "Try to balance both for optimal performance."
        )
    
    # Alert 5: Inactivity warning
    if derived_flags.get("inactive"):
        alerts.append(
            "💡 No academic activities recorded today. Even light study helps maintain consistency."
        )
    
    # Alert 6: Low engagement alert
    if derived_flags.get("low_engagement"):
        alerts.append(
            "😴 Engagement was low today. Consider: better environment, clearer goals, or short break before next session."
        )
    
    return alerts


def format_alerts_for_journal(alerts: List[str]) -> str:
    """
    Format alerts into a readable journal section.
    """
    if not alerts:
        return ""
    
    formatted = "\n\n📋 **Smart Alerts:**\n"
    for alert in alerts:
        formatted += f"- {alert}\n"
    
    return formatted
