"""
generate_todo_output.py

To-Do List & Reminder Formatting for the Smart Uni Guide study planner.

Transforms a StudyScheduler schedule (produced by schedule_engine.py) into a
simple, actionable to-do list: one entry per task, with a human-readable
reminder message that varies by priority and urgency.

Run independently with:
    venv/Scripts/python ml_scripts/study-planner/generate_todo_output.py

By default this loads the saved sample_schedule_initial.json produced by
schedule_engine.py (requires that script to have already been run once).
It can also be used as a library - call build_todo_list(schedule_result)
directly with an in-memory schedule dict from schedule_engine.py, without
touching disk, e.g. from the backend API in the same process.
"""

import json
import os
import sys
from datetime import date, datetime

# Windows consoles often default to cp1252, which can't encode the emoji used
# in reminder_message below - force UTF-8 stdout so `python generate_todo_output.py`
# doesn't crash on print() regardless of the host terminal's default encoding.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))

OUTPUTS_DIR = os.path.join(BACKEND_DIR, "ml_scripts", "study-planner", "outputs")
SCHEDULE_PATH = os.path.join(OUTPUTS_DIR, "sample_schedule_initial.json")

os.makedirs(OUTPUTS_DIR, exist_ok=True)

PRIORITY_ORDER = {"High": 0, "Medium": 1, "Low": 2}


def section(title):
    print("\n" + "=" * 90)
    print(title)
    print("=" * 90)


# ===========================================================================
# CORE TRANSFORM: schedule -> to-do list
# ===========================================================================
def _reminder_message(module, priority_label, days_remaining):
    """
    Builds a short, human-readable reminder that varies by priority AND
    urgency (not priority alone) - a High-priority task due in 3 weeks
    doesn't need the same tone as one due tomorrow, and a Low-priority task
    due tomorrow still deserves a nudge.
    """
    if days_remaining < 0:
        return f"⚠️ Overdue: {module} task was due {abs(days_remaining)} day(s) ago - address immediately."

    if priority_label == "High":
        if days_remaining <= 2:
            return f"⚠️ Urgent: {module} task due in {days_remaining} day(s) — schedule time today."
        elif days_remaining <= 7:
            return f"\U0001F4CC High priority: {module} task due in {days_remaining} days — start soon."
        else:
            return f"\U0001F4CC High priority: {module} task due in {days_remaining} days — begin early given its weight."

    if priority_label == "Medium":
        if days_remaining <= 2:
            return f"⏳ {module} task due in {days_remaining} day(s) — make time soon."
        elif days_remaining <= 7:
            return f"\U0001F4C5 {module} task due in {days_remaining} days — plan a session this week."
        else:
            return f"\U0001F4C5 {module} task due in {days_remaining} days — keep it on your radar."

    # Low priority
    if days_remaining <= 2:
        return f"ℹ️ {module} task (low priority) due in {days_remaining} day(s) — quick task, fit it in when convenient."
    elif days_remaining <= 13:
        return f"ℹ️ {module} task due in {days_remaining} days — no urgent action needed yet."
    else:
        weeks = days_remaining // 7
        return f"ℹ️ {module} task due in {weeks} week(s) — no immediate action needed."


def build_todo_list(schedule_result, today=None):
    """
    schedule_result: dict as returned by StudyScheduler.generate_schedule()
      / reschedule() - {"schedule": ..., "overload_warning": ..., "tasks": ...}
    today: override "today" for days_remaining math (defaults to date.today()).

    Returns a list of dicts:
      {task_id, module, priority_label, deadline_date, days_remaining,
       recommended_next_session, reminder_message}
    sorted High -> Medium -> Low, then by soonest deadline within a tier.
    """
    today = today or date.today()
    tasks_registry = schedule_result.get("tasks", {})
    if not tasks_registry:
        raise ValueError(
            "schedule_result has no 'tasks' registry - this script requires a schedule produced by "
            "the current schedule_engine.py (generate_schedule()/reschedule()), which includes task "
            "metadata (module/priority/deadline) for every task, not just overloaded ones."
        )

    # Map each task to its next scheduled session (earliest day/time_slot), if any.
    next_session_by_task = {}
    for day, items in schedule_result.get("schedule", {}).items():
        for item in items:
            task_id = item["task_id"]
            candidate = f"{day} {item['time_slot']}"
            if task_id not in next_session_by_task:
                next_session_by_task[task_id] = candidate

    overloaded_task_ids = {w["task_id"] for w in schedule_result.get("overload_warning", [])}

    todo_items = []
    for task_id, info in tasks_registry.items():
        deadline_date = datetime.strptime(info["deadline_date"], "%Y-%m-%d").date()
        days_remaining = (deadline_date - today).days

        if task_id in next_session_by_task:
            recommended_next_session = next_session_by_task[task_id]
        elif task_id in overloaded_task_ids:
            recommended_next_session = "Not yet scheduled - insufficient free time before deadline"
        else:
            recommended_next_session = "Not yet scheduled"

        todo_items.append({
            "task_id": task_id,
            "module": info["module"],
            "priority_label": info["priority_label"],
            "deadline_date": info["deadline_date"],
            "days_remaining": days_remaining,
            "recommended_next_session": recommended_next_session,
            "reminder_message": _reminder_message(info["module"], info["priority_label"], days_remaining),
        })

    todo_items.sort(key=lambda t: (PRIORITY_ORDER.get(t["priority_label"], 3), t["days_remaining"]))
    return todo_items


def print_todo_list(todo_items):
    """Prints a formatted, readable to-do list grouped by priority, High first."""
    for priority in ["High", "Medium", "Low"]:
        group = [t for t in todo_items if t["priority_label"] == priority]
        if not group:
            continue
        print(f"\n{priority.upper()} PRIORITY ({len(group)} task(s))")
        print("-" * 60)
        for t in group:
            print(f"  [{t['task_id']}] {t['module']}  |  due {t['deadline_date']} "
                  f"({t['days_remaining']}d remaining)")
            print(f"      Next session: {t['recommended_next_session']}")
            print(f"      {t['reminder_message']}")


# ===========================================================================
# __main__: load a saved schedule and run the transform end-to-end
# ===========================================================================
if __name__ == "__main__":
    section("0. CHECK REQUIRED INPUT FILES")
    if not os.path.exists(SCHEDULE_PATH):
        print(f"ERROR: missing required input file: {SCHEDULE_PATH}")
        print("  Run schedule_engine.py first to generate it.")
        sys.exit(1)
    print("Required input file found.")

    section("1. LOAD SCHEDULE")
    with open(SCHEDULE_PATH) as f:
        schedule_result = json.load(f)
    print(f"Loaded {SCHEDULE_PATH} - {len(schedule_result.get('tasks', {}))} tasks, "
          f"{len(schedule_result.get('overload_warning', []))} overload warning(s).")

    section("2. BUILD TO-DO LIST")
    todo_items = build_todo_list(schedule_result)
    print(f"Built {len(todo_items)} to-do entries.")

    section("3. PRINT FORMATTED TO-DO LIST")
    print_todo_list(todo_items)

    section("4. SAVE OUTPUT")
    out_path = os.path.join(OUTPUTS_DIR, "sample_todo_list.json")
    with open(out_path, "w") as f:
        json.dump(todo_items, f, indent=2)
    print(f"\nSaved {out_path}")

    section("5. SUMMARY")
    counts = {p: sum(1 for t in todo_items if t["priority_label"] == p) for p in ["High", "Medium", "Low"]}
    print(f"""
Summary:
- Transformed the saved schedule ({SCHEDULE_PATH}) into {len(todo_items)} actionable to-do entries
  (High={counts['High']}, Medium={counts['Medium']}, Low={counts['Low']}).
- Each entry carries a priority/urgency-aware reminder_message and a recommended_next_session
  pulled from the schedule's actual slot assignment (or a clear "not yet scheduled" note for
  overloaded tasks).
- Saved sample_todo_list.json to {OUTPUTS_DIR}
""")
    print("Done.")
