import json
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List
from openai import AsyncOpenAI
from app.config.settings import settings
from app.models.journal.daily_session import DailySessionModel
from app.models.journal.task import TaskModel
from app.services.journal.learning_patterns import aggregate_learning_patterns

client = AsyncOpenAI(api_key=settings.openai_api_key)
MODEL = settings.openai_model

BEHAVIOR_CATEGORIES = [
    "Consistent Learner",
    "Last-Minute Learner",
    "Overloaded Student",
    "Highly Engaged Student",
    "Low Engagement Student"
]


def _parse_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except Exception:
            return None
    return None


def _count_completed_tasks(tasks: List[Dict[str, Any]]) -> int:
    count = 0
    for task in tasks:
        stage = str(task.get("progress_stage", "")).lower()
        if stage.endswith("completed") or stage == "joined":
            count += 1
    return count


def _build_behavior_prompt(snapshot: Dict[str, Any]) -> str:
    return f"""
You are a behavioral analysis assistant for university productivity data.
Analyze the structured activity snapshot and choose EXACTLY ONE category from:
{json.dumps(BEHAVIOR_CATEGORIES)}.

Rules:
- Assign one category only.
- Provide reasoning in 2-3 sentences.
- This classification is ONLY for analytics/reporting/insights. It MUST NOT influence question generation.

Return JSON only in this format:
{{
  "behaviorCategory": "...",
  "reasoning": "..."
}}

Activity snapshot:
{json.dumps(snapshot, default=str, indent=2)}
"""


async def build_activity_snapshot(user_id: str) -> Dict[str, Any]:
    now = datetime.utcnow().replace(tzinfo=timezone.utc)
    cutoff = now - timedelta(days=14)

    sessions = await DailySessionModel.find_user_sessions(user_id)
    recent_sessions = []
    last_activity_date = None

    for session in sessions:
        session_date = _parse_datetime(session.get("date") or session.get("created_at"))
        if session_date and session_date.tzinfo is None:
            session_date = session_date.replace(tzinfo=timezone.utc)
        if session_date and session_date >= cutoff:
            recent_sessions.append(session)
        if session_date and (last_activity_date is None or session_date > last_activity_date):
            last_activity_date = session_date

    total_study_minutes = sum(s.get("study_duration_minutes", 0) or 0 for s in recent_sessions)
    avg_study_hours = round((total_study_minutes / max(len(recent_sessions), 1)) / 60, 2) if recent_sessions else 0

    engagement_levels = [s.get("engagement") for s in recent_sessions if s.get("engagement")]
    engagement_distribution = {
        "high": engagement_levels.count("high"),
        "medium": engagement_levels.count("medium"),
        "low": engagement_levels.count("low")
    }

    tasks = await TaskModel.find_by_user(user_id)
    total_tasks = len(tasks)
    completed_tasks = _count_completed_tasks(tasks)

    assignment_progress = {}
    deadlines = []
    overdue_count = 0
    due_soon_3 = 0
    due_soon_7 = 0

    for task in tasks:
        if task.get("task_type") == "assignment":
            stage = task.get("progress_stage") or "unknown"
            assignment_progress[stage] = assignment_progress.get(stage, 0) + 1

        deadline = _parse_datetime(task.get("deadline"))
        if deadline:
            if deadline.tzinfo is None:
                deadline = deadline.replace(tzinfo=timezone.utc)
            days_left = (deadline - now).days
            deadlines.append(days_left)
            if days_left < 0:
                overdue_count += 1
            if days_left <= 3:
                due_soon_3 += 1
            if days_left <= 7:
                due_soon_7 += 1

    nearest_deadline = min(deadlines) if deadlines else None

    patterns = await aggregate_learning_patterns(user_id)

    return {
        "study_hours_avg_per_day": avg_study_hours,
        "study_hours_last_14_days": round(total_study_minutes / 60, 2),
        "total_sessions_last_14_days": len(recent_sessions),
        "activity_frequency": round(len(recent_sessions) / 14, 2),
        "assignment_progress": assignment_progress,
        "deadline_proximity": {
            "nearest_deadline_days": nearest_deadline,
            "due_within_3_days": due_soon_3,
            "due_within_7_days": due_soon_7,
            "overdue": overdue_count
        },
        "task_completion_history": {
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks
        },
        "engagement_trend": patterns.get("engagement_trend", "insufficient_data"),
        "engagement_distribution": engagement_distribution,
        "last_activity_date": last_activity_date
    }


async def analyze_behavior(snapshot: Dict[str, Any]) -> Dict[str, str]:
    prompt = _build_behavior_prompt(snapshot)
    resp = await client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0.2
    )
    data = json.loads(resp.choices[0].message.content)
    category = data.get("behaviorCategory")
    reasoning = data.get("reasoning", "")

    if category not in BEHAVIOR_CATEGORIES:
        category = "Low Engagement Student"
        reasoning = reasoning or "The activity snapshot does not show consistent or high engagement signals."

    return {"behaviorCategory": category, "reasoning": reasoning}
