"""Alert Rules Explorer: a static catalog of the proactive-alert rules
already used inside journal generation (context_utils.py / alerts.py),
plus a read-only evaluation of which ones are currently active for a user.
Nothing here changes behavior of the existing alerts - it only explains and
surfaces it."""

from typing import Dict, List

from app.models.journal.daily_session import DailySessionModel
from app.models.journal.task import TaskModel
from app.services.journal.alerts import generate_proactive_alerts
from app.services.journal.context_utils import compute_derived_context, identify_at_risk_tasks
from app.services.time_utils import local_today, to_local_date

RULE_CATALOG: List[Dict] = [
    {
        "key": "deadline_pressure",
        "name": "Deadline pressure / at-risk task",
        "condition": "A task's deadline is <= 2 days away AND its progress is not_started or in_progress.",
        "severity_rule": "critical if the deadline has already passed (days_left <= 0), otherwise high.",
    },
    {
        "key": "low_study",
        "name": "Low study time",
        "condition": "study_duration_minutes for the day is < 120 minutes.",
        "severity_rule": "informational",
    },
    {
        "key": "overloaded",
        "name": "Extra-curricular overload",
        "condition": "extra_activity_minutes > study_duration_minutes (and study_duration_minutes > 0).",
        "severity_rule": "informational",
    },
    {
        "key": "inactive",
        "name": "No academic activity",
        "condition": "None of academic_study, assignment_work, project_development, internship was selected that day.",
        "severity_rule": "informational",
    },
    {
        "key": "low_engagement",
        "name": "Low engagement",
        "condition": "The day's engagement level is recorded as 'low'.",
        "severity_rule": "informational",
    },
]


async def get_alert_rule_catalog() -> List[Dict]:
    return RULE_CATALOG


async def evaluate_alert_rules_for_user(user_id: str) -> Dict:
    sessions = await DailySessionModel.find_user_sessions(user_id)
    completed = [s for s in (sessions or []) if s and s.get("completed") and to_local_date(s.get("date"))]
    latest = max(completed, key=lambda s: to_local_date(s["date"])) if completed else None

    tasks = await TaskModel.find_by_user(user_id)
    tasks_data = [
        {"title": t["title"], "progress_stage": t.get("progress_stage"), "deadline": t.get("deadline")}
        for t in tasks
    ]
    as_of = to_local_date(latest["date"]) if latest else local_today()

    at_risk_tasks = await identify_at_risk_tasks(tasks_data, as_of=as_of)
    derived = (
        await compute_derived_context(latest, tasks_data, as_of=as_of)
        if latest
        else {"low_study": False, "deadline_pressure": bool(at_risk_tasks), "overloaded": False, "inactive": False, "low_engagement": False}
    )
    active_alert_strings = generate_proactive_alerts(at_risk_tasks, derived)

    active_keys = set()
    if at_risk_tasks:
        active_keys.add("deadline_pressure")
    for key in ("low_study", "overloaded", "inactive", "low_engagement"):
        if derived.get(key):
            active_keys.add(key)

    return {
        "evaluated_against_date": as_of.isoformat() if as_of else None,
        "active_rule_keys": sorted(active_keys),
        "at_risk_tasks": at_risk_tasks,
        "derived_flags": derived,
        "generated_alert_messages": active_alert_strings,
        "rule_catalog": RULE_CATALOG,
    }
