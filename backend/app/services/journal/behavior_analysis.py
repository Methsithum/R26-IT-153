import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List
from openai import AsyncOpenAI
from app.config.settings import settings
from app.models.journal.behavior_analysis import BehaviorAnalysisModel
from app.models.journal.daily_session import DailySessionModel
from app.models.journal.task import TaskModel
from app.models.user.user import UserModel
from app.services.time_utils import local_today, to_local_date, calendar_datetime, LOCAL_TZ
from app.services.journal.journal_constants import MARK_RECEIVED_STAGES

client = AsyncOpenAI(api_key=settings.openai_api_key)
MODEL = settings.openai_model
logger = logging.getLogger(__name__)

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
- "observation_window_days" is how many days this account has actually existed (capped at 14), NOT a fixed 14-day period. "activity_frequency" is already computed against that real window. If the account is only a few days old, judge activity relative to observation_window_days, not against a full 14-day expectation - do not call a new account "Low Engagement" just because its totals look small on an absolute scale.
- This classification is ONLY for analytics/reporting/insights. It MUST NOT influence question generation.
- Engagement distribution is a count, not a temporal trend. Never describe it as improving or declining.
- If fewer than 7 active days are recorded, describe this as an early snapshot with insufficient history for a stable pattern or temporal trend. Do not infer improvement from account age or a single day.

Next steps rules:
- Give 2-3 concrete actions the student can take in the next few days, matched to the chosen category.
- Ground every action in the snapshot. Only quote numbers that appear in it (e.g. nearest_deadline_days, overdue, not_started counts). Never invent deadlines, subjects, task names or numbers.
- If the account is only a few days old, keep the tone encouraging and focus on building a daily journaling habit.
- Put the most urgent action first (overdue work, deadlines within 3 days).
- "title": at most 6 words. "text": one or two sentences, at most 30 words, addressed to the student as "you".
- "icon": a single emoji that fits the action.
- Be supportive and practical, never judgemental, and give no medical or mental-health advice.

Return JSON only in this format:
{{
  "behaviorCategory": "...",
  "reasoning": "...",
  "nextSteps": [
    {{"icon": "...", "title": "...", "text": "..."}}
  ]
}}

Activity snapshot:
{json.dumps(snapshot, default=str, indent=2)}
"""


async def build_activity_snapshot(user_id: str) -> Dict[str, Any]:
    today = local_today()
    cutoff = today - timedelta(days=13)

    sessions = await DailySessionModel.find_user_sessions(user_id)
    recent_sessions = []
    last_activity_date = None

    for session in sessions:
        if not session.get("completed"):
            continue
        session_date = to_local_date(session.get("date"))
        if session_date and cutoff <= session_date <= today:
            recent_sessions.append(session)
        if session_date and session_date <= today and (last_activity_date is None or session_date > last_activity_date):
            last_activity_date = session_date

    user = await UserModel.find_by_id(user_id)
    account_created = to_local_date(user.get("created_at")) if user else None
    account_age_days = max(1, (today - account_created).days + 1) if account_created else None
    # Don't divide by a fixed 14-day window for an account that hasn't existed
    # that long - a brand-new user with 1 session out of 1 possible day is not
    # "low engagement", they just haven't had 14 days yet.
    observation_window_days = min(14, account_age_days) if account_age_days else 14

    # A legacy account can have backfilled dates older than its creation record.
    recent_sessions = [s for s in recent_sessions if to_local_date(s["date"]) >= today - timedelta(days=observation_window_days - 1)]
    active_dates = {to_local_date(s["date"]) for s in recent_sessions}
    total_study_minutes = sum(max(0, s.get("study_duration_minutes", 0) or 0) for s in recent_sessions)
    avg_study_hours = round(total_study_minutes / max(len(active_dates), 1) / 60, 2)

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

        stage = str(task.get("progress_stage") or "").lower()
        if stage in MARK_RECEIVED_STAGES or stage == "joined":
            continue
        deadline = to_local_date(task.get("deadline"))
        if deadline:
            days_left = (deadline - today).days
            deadlines.append(days_left)
            if days_left < 0:
                overdue_count += 1
            if 0 <= days_left <= 3:
                due_soon_3 += 1
            if 0 <= days_left <= 7:
                due_soon_7 += 1

    nearest_deadline = min(deadlines) if deadlines else None

    return {
        "account_age_days": account_age_days,
        "observation_window_days": observation_window_days,
        "study_hours_avg_per_day": avg_study_hours,
        "study_hours_last_14_days": round(total_study_minutes / 60, 2),
        "total_sessions_last_14_days": len(recent_sessions),
        "active_days_last_14_days": len(active_dates),
        "activity_frequency": round(len(active_dates) / observation_window_days, 2),
        "study_average_basis": "active journal day",
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
        "engagement_trend": "insufficient_data" if len(active_dates) < 7 else "not_measured",
        "engagement_distribution": engagement_distribution,
        "last_activity_date": calendar_datetime(last_activity_date).replace(tzinfo=LOCAL_TZ) if last_activity_date else None,
    }


MAX_NEXT_STEPS = 3


def _clean_next_steps(raw: Any) -> List[Dict[str, str]]:
    if not isinstance(raw, list):
        return []
    steps = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        text = str(item.get("text") or "").strip()
        if not title or not text:
            continue
        icon = str(item.get("icon") or "").strip()
        steps.append({"icon": icon if 0 < len(icon) <= 8 else "💡", "title": title[:80], "text": text[:300]})
        if len(steps) == MAX_NEXT_STEPS:
            break
    return steps


async def analyze_behavior(snapshot: Dict[str, Any]) -> Dict[str, Any]:
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

    analysis = {
        "behaviorCategory": category,
        "reasoning": reasoning,
        "nextSteps": _clean_next_steps(data.get("nextSteps")),
    }
    if snapshot.get("active_days_last_14_days", 0) < 7:
        days = snapshot.get("active_days_last_14_days", 0)
        window = snapshot.get("observation_window_days", 14)
        analysis["reasoning"] = (
            f"Your journal records {days} active day(s) within a {window}-day observation window. "
            "This is an early activity snapshot, with insufficient history to establish improvement, decline, or a stable learning pattern."
        )
        analysis["nextSteps"] = [
            {"icon": "📝", "title": "Keep a daily journal", "text": "Keep recording your campus activity so future feedback has more history to reflect on."},
            {"icon": "🔎", "title": "Review your recorded activity", "text": "Check your journal and academic records for accuracy before relying on a pattern summary."},
        ]
    return analysis


async def run_and_store_behavior_analysis(user_id: str, trigger: str) -> Dict[str, Any]:
    """trigger is "manual" (button) or "auto" (after a daily journal), kept on
    the record so the two can be told apart when evaluating the classifier."""
    revision = await BehaviorAnalysisModel.revision(user_id)
    await BehaviorAnalysisModel.set_state(user_id, "running", revision)
    try:
        snapshot = await build_activity_snapshot(user_id)
        analysis = await analyze_behavior(snapshot)
    except Exception:
        await BehaviorAnalysisModel.set_state(user_id, "failed", revision, "Analysis could not be completed. Please try again.")
        raise
    record = {
        "studentId": user_id,
        "behaviorCategory": analysis["behaviorCategory"],
        "reasoning": analysis["reasoning"],
        "nextSteps": analysis["nextSteps"],
        "trigger": trigger,
        "timestamp": datetime.utcnow(),
        "snapshotOfActivityData": snapshot,
        "journal_revision": revision,
    }
    await BehaviorAnalysisModel.create(record)
    await BehaviorAnalysisModel.set_state(user_id, "ready", revision)
    return record


async def auto_behavior_analysis(user_id: str) -> None:
    # Runs as a background task after the journal response is sent, so a
    # failure here must never surface to the student.
    try:
        await run_and_store_behavior_analysis(user_id, trigger="auto")
    except Exception:
        logger.exception("Automatic behaviour analysis failed for user %s", user_id)
