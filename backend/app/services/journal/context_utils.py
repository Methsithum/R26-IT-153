from datetime import datetime, timezone
from typing import Dict, List, Any

def _deadline_days(deadline: Any) -> int:
    """Calculate days until deadline from now."""
    if not deadline:
        return float('inf')
    
    try:
        if isinstance(deadline, str):
            deadline_dt = datetime.fromisoformat(deadline.replace("Z", "+00:00"))
        else:
            deadline_dt = deadline
        
        if deadline_dt.tzinfo is None:
            deadline_dt = deadline_dt.replace(tzinfo=timezone.utc)
        
        now = datetime.now(timezone.utc)
        days_left = (deadline_dt - now).days
        return days_left
    except Exception:
        return float('inf')


async def compute_derived_context(session_doc: Dict[str, Any], current_tasks: List[Dict]) -> Dict[str, bool]:
    """
    Compute behavioral flags from session data for intelligent LLM prompting.
    
    Returns dict with:
    - low_study: True if study_duration < 120 minutes
    - deadline_pressure: True if any task deadline ≤ 2 days away
    - overloaded: True if extra_activity_minutes > study_duration_minutes
    - inactive: True if no meaningful academic activities selected
    - low_engagement: True if engagement level is "low"
    """
    
    # Flag 1: Low study time (less than 2 hours)
    study_duration = session_doc.get("study_duration_minutes", 0) or 0
    low_study = study_duration < 120
    
    # Flag 2: Deadline pressure (any task due within 2 days)
    deadline_pressure = False
    for task in current_tasks:
        days_left = _deadline_days(task.get("deadline"))
        if days_left <= 2:
            deadline_pressure = True
            break
    
    # Flag 3: Overloaded (extra-curricular time exceeds study time)
    extra_activity_minutes = session_doc.get("extra_activity_minutes", 0) or 0
    overloaded = (study_duration > 0) and (extra_activity_minutes > study_duration)
    
    # Flag 4: Inactive (no productive academic activities)
    activities = session_doc.get("selected_activities", [])
    academic_activities = {
        "academic_study", "assignment_work", "project_development", "internship"
    }
    inactive = not any(a in academic_activities for a in activities)
    
    # Flag 5: Low engagement level
    engagement = session_doc.get("engagement", "").lower()
    low_engagement = engagement == "low"
    
    return {
        "low_study": low_study,
        "deadline_pressure": deadline_pressure,
        "overloaded": overloaded,
        "inactive": inactive,
        "low_engagement": low_engagement
    }


async def identify_at_risk_tasks(current_tasks: List[Dict]) -> List[Dict]:
    """
    Identify at-risk tasks: deadline ≤ 2 days AND (not started OR in progress).
    Returns list of at-risk tasks with urgency level.
    """
    at_risk = []
    
    for task in current_tasks:
        days_left = _deadline_days(task.get("deadline"))
        progress_stage = task.get("progress_stage", "").lower()
        
        # Check if task is at-risk: deadline soon + not making progress
        is_not_started = progress_stage in ["not_started", "not started", ""]
        is_in_progress = progress_stage in ["in_progress", "in progress"]
        
        if days_left <= 2 and (is_not_started or is_in_progress):
            urgency = "critical" if days_left <= 1 else "high"
            at_risk.append({
                "title": task.get("title"),
                "days_left": max(0, days_left),
                "progress": progress_stage,
                "urgency": urgency,
                "id": task.get("id")
            })
    
    return sorted(at_risk, key=lambda x: x["days_left"])
