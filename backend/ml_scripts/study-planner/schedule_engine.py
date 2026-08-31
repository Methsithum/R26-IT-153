"""
schedule_engine.py

Rule-based Adaptive Scheduling Engine for the Smart Uni Guide study planner.

MVP NOTE: The long-term objective for this component is an adaptive
scheduler, and a full reinforcement-learning (RL) formulation (states =
student/calendar context, actions = slot assignments, reward = on-time
completion / spaced-practice quality) is real future work. Standing up an RL
training loop, simulator, and reward model is a large, separate undertaking
that needs its own data collection pass; it is out of scope here. This
script instead builds a well-justified GREEDY rule-based allocator that
already satisfies the core product requirement - "assign study time by
priority and deadline, and adjust when new information arrives" - and can
later be swapped for a learned policy behind the same StudyScheduler
interface (generate_schedule / reschedule) without changing calling code.

Run independently with:
    venv/Scripts/python ml_scripts/study-planner/schedule_engine.py

The __main__ demo loads the trained priority_model.joblib (+ scaler,
label_encoders) to predict priority for sample tasks, so it requires
train_priority_model.py to have already been run once.
"""

import json
import os
import sys
from datetime import date, datetime, timedelta

import joblib
import pandas as pd

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))

OUTPUTS_DIR = os.path.join(BACKEND_DIR, "ml_scripts", "study-planner", "outputs")
MODELS_DIR = os.path.join(BACKEND_DIR, "app", "models", "study_planner")

MODEL_PATH = os.path.join(MODELS_DIR, "priority_model.joblib")
SCALER_PATH = os.path.join(MODELS_DIR, "scaler.joblib")
LABEL_ENCODERS_PATH = os.path.join(MODELS_DIR, "label_encoders.joblib")
XGB_LABEL_ENCODER_PATH = os.path.join(MODELS_DIR, "xgb_label_encoder.joblib")
DATASET_PATH = os.path.join(OUTPUTS_DIR, "oulad_task_level_leakage_free.csv")

os.makedirs(OUTPUTS_DIR, exist_ok=True)

PRIORITY_ORDER = {"High": 0, "Medium": 1, "Low": 2}  # lower = scheduled first
DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

# Rolling multi-week scheduling (see generate_rolling_schedule): bounds how
# far ahead the system will ever generate a schedule, regardless of how far
# out the farthest real deadline/exam is, so a student with something due in
# a year from now can't trigger an unbounded (or just absurdly large)
# generation. 12 weeks is a full academic term's worth of runway - generous
# for real planning, not unbounded.
MAX_WEEKS_AHEAD = 12


def section(title):
    print("\n" + "=" * 90)
    print(title)
    print("=" * 90)


def resolve_day_date(day_name, anchor_date):
    """
    Resolves a weekday NAME to the next real calendar date on/after
    anchor_date (anchor_date..anchor_date+6) - module-level so both
    StudyScheduler (single week) and generate_rolling_schedule (many
    consecutive weeks, each with its own anchor) share the exact same
    resolution logic rather than each reimplementing it.
    """
    target_weekday = DAY_ORDER.index(day_name)
    delta_days = (target_weekday - anchor_date.weekday()) % 7
    return anchor_date + timedelta(days=delta_days)


# ===========================================================================
# StudyScheduler: greedy priority-first allocator
# ===========================================================================
class StudyScheduler:
    """
    Greedy rule-based scheduler (MVP for the adaptive scheduling objective).

    Allocation logic (see generate_schedule):
      1. Sort tasks by priority tier (High > Medium > Low), then by deadline
         proximity within a tier - the most urgent work is placed first,
         and among equally urgent work, the soonest deadline goes first.
      2. For each task, greedily consume the nearest available free slots
         that fall on/before its deadline, splitting across multiple
         slots/days if a single slot isn't long enough to cover the task's
         estimated_hours_needed.
      3. If free capacity runs out before a task's need is met, the task is
         partially (or not at all) scheduled and flagged in overload_warning
         rather than silently dropped - the planner should surface this to
         the student (e.g. "you don't have enough free time before this
         deadline, consider re-prioritizing").
    """

    def __init__(self, weekly_free_slots, anchor_date=None):
        """
        weekly_free_slots: list of dicts, each
            {"day": "Monday", "start_time": "09:00", "end_time": "11:00", "duration_minutes": 120}
        representing time NOT already occupied by lectures/commitments, for
        the single upcoming week starting at anchor_date (defaults to today).

        anchor_date anchors the weekday names to real calendar dates (today
        through today+6) so deadline comparisons use actual dates rather
        than raw weekday-of-week matching, which would incorrectly treat
        "next Monday" the same as "this Monday".
        """
        self.weekly_free_slots = [dict(slot) for slot in weekly_free_slots]
        self.tasks = []
        self.anchor_date = anchor_date or date.today()

    def _slot_date(self, day_name):
        """Resolves a weekday name to the next real date (today..today+6)."""
        return resolve_day_date(day_name, self.anchor_date)

    def add_task(self, task):
        """
        task: dict with keys
            task_id, module, deadline_date (ISO "YYYY-MM-DD"), weight,
            priority_label ("High"/"Medium"/"Low"), estimated_hours_needed
        task_type ("assignment"/"exam") is optional and defaults to
        "assignment" - it doesn't change the greedy allocation ORDER (that's
        still driven entirely by priority_label + deadline, see _sort_tasks),
        it's carried through purely so callers (the study-planner API, then
        the frontend) can round-trip it back out via the tasks registry -
        see PROJECT CONTEXT.md Section 8's exam-prep subsection for why an
        exam-prep task competing for slots is done by giving it the
        appropriate priority_label up front (computed client-side from days-
        until-exam, the same base-tier logic used for assignments), not by
        adding a second, parallel priority system here.
        """
        required = {"task_id", "module", "deadline_date", "weight", "priority_label", "estimated_hours_needed"}
        missing = required - task.keys()
        if missing:
            raise ValueError(f"Task {task.get('task_id', '?')} missing required fields: {missing}")
        task = dict(task)
        task.setdefault("task_type", "assignment")
        self.tasks.append(task)

    def _sort_tasks(self):
        def sort_key(t):
            deadline = datetime.strptime(t["deadline_date"], "%Y-%m-%d")
            return (PRIORITY_ORDER.get(t["priority_label"], 3), deadline)
        return sorted(self.tasks, key=sort_key)

    def generate_schedule(self):
        """
        Greedily allocates free slots to tasks (priority tier, then deadline
        proximity) and returns:
            {
              "schedule": {day: [{time_slot, task_id, module, duration_minutes}, ...]},
              "overload_warning": [{"task_id":..., "module":..., "hours_short": ...}, ...],
              "tasks": {task_id: {module, weight, priority_label, deadline_date, estimated_hours_needed}, ...}
            }
        The "tasks" registry covers every task known to the scheduler at
        generation time (not just overloaded ones) - downstream consumers
        like generate_todo_output.py need each task's deadline/priority
        even when it WAS fully scheduled, since the schedule/overload_warning
        sections alone don't carry that for successfully-placed tasks. It also
        carries "weight" so the full task dict can be round-tripped straight
        back into add_task() (all of add_task's required fields present),
        which the study-planner API's reschedule endpoint relies on to
        reconstruct a StudyScheduler across stateless HTTP requests.

        Slot selection is load-balanced across days rather than pure
        nearest-first: each task still prefers the earliest *eligible* date
        when all days are equally loaded (so the very first task scheduled
        still lands as soon as possible), but once a day has accumulated
        minutes from earlier (higher-priority/closer-deadline) tasks, later
        tasks prefer a lighter day instead of continuing to stack onto the
        same one or two days - spreading real free time across the whole
        week whenever the deadline allows it, without weakening the
        priority/deadline ordering of which task gets first pick.
        """
        # Work on a fresh copy of remaining slot capacity so repeated calls
        # (e.g. via reschedule()) don't corrupt the original free-slot list.
        remaining_slots = [dict(slot) for slot in self.weekly_free_slots]
        schedule = {day: [] for day in DAY_ORDER}
        overload_warning = []
        day_load_minutes = {day: 0 for day in DAY_ORDER}

        for task in self._sort_tasks():
            deadline = datetime.strptime(task["deadline_date"], "%Y-%m-%d")
            hours_needed = task["estimated_hours_needed"]
            minutes_needed = hours_needed * 60

            # Only slots whose real calendar date falls on/before the deadline.
            eligible_slots = [
                s for s in remaining_slots
                if s["duration_minutes"] > 0 and self._slot_date(s["day"]) <= deadline.date()
            ]
            # Least-loaded day first (spreads across the week), then
            # earliest date, then earliest by start_time as tiebreakers.
            eligible_slots.sort(
                key=lambda s: (day_load_minutes[s["day"]], self._slot_date(s["day"]), s["start_time"])
            )

            for slot in eligible_slots:
                if minutes_needed <= 0:
                    break
                take = min(slot["duration_minutes"], minutes_needed)
                if take <= 0:
                    continue
                schedule[slot["day"]].append({
                    "time_slot": f"{slot['start_time']}-{self._add_minutes(slot['start_time'], take)}",
                    "task_id": task["task_id"],
                    "module": task["module"],
                    "duration_minutes": take,
                })
                slot["start_time"] = self._add_minutes(slot["start_time"], take)
                slot["duration_minutes"] -= take
                minutes_needed -= take
                day_load_minutes[slot["day"]] += take

            if minutes_needed > 0:
                overload_warning.append({
                    "task_id": task["task_id"],
                    "module": task["module"],
                    "priority_label": task["priority_label"],
                    "deadline_date": task["deadline_date"],
                    "hours_short": round(minutes_needed / 60, 2),
                    "task_type": task.get("task_type", "assignment"),
                })

        # Keep only slots with remaining capacity for the next reschedule() call.
        self.weekly_free_slots = [s for s in remaining_slots if s["duration_minutes"] > 0]

        for day in schedule:
            schedule[day].sort(key=lambda item: item["time_slot"])

        tasks_registry = {
            t["task_id"]: {
                "module": t["module"],
                "weight": t["weight"],
                "priority_label": t["priority_label"],
                "deadline_date": t["deadline_date"],
                "estimated_hours_needed": t["estimated_hours_needed"],
                "task_type": t.get("task_type", "assignment"),
            }
            for t in self.tasks
        }

        return {"schedule": schedule, "overload_warning": overload_warning, "tasks": tasks_registry}

    def reschedule(self, completed_task_ids, new_tasks=None):
        """
        Simulates adaptive rescheduling: drops completed tasks, adds any new
        tasks, and regenerates the schedule against remaining free capacity.
        This is the hook a real system would call whenever new data arrives
        (a task is marked done, a new deadline appears, a slot is consumed).
        """
        self.tasks = [t for t in self.tasks if t["task_id"] not in completed_task_ids]
        for t in (new_tasks or []):
            self.add_task(t)
        return self.generate_schedule()

    @staticmethod
    def _add_minutes(hhmm, minutes):
        t = datetime.strptime(hhmm, "%H:%M") + timedelta(minutes=minutes)
        return t.strftime("%H:%M")


# ===========================================================================
# Rolling multi-week scheduling
# ===========================================================================
def _weeks_needed_for(tasks, anchor_date, weeks_ahead=None):
    """How many consecutive 7-day blocks to generate, capped at MAX_WEEKS_AHEAD."""
    if weeks_ahead is not None:
        return max(1, min(weeks_ahead, MAX_WEEKS_AHEAD))
    if not tasks:
        return 1
    farthest = max(datetime.strptime(t["deadline_date"], "%Y-%m-%d").date() for t in tasks)
    weeks_needed = max(1, -(-((farthest - anchor_date).days + 1) // 7))  # ceil division, at least 1
    return min(weeks_needed, MAX_WEEKS_AHEAD)


def generate_rolling_schedule(weekly_free_slots, tasks, anchor_date=None, weeks_ahead=None):
    """
    Extends StudyScheduler across multiple consecutive weeks with backlog
    carryover, WITHOUT duplicating its slot-filling logic - each week is a
    real StudyScheduler.generate_schedule() call against that week's own
    7-day block of the SAME recurring weekly_free_slots pattern (the
    existing "this pattern repeats every week" assumption already implicit
    in how Settings' preferred-study-time windows feed /schedule today -
    reused verbatim here, not reinvented).

    weekly_free_slots: the same recurring weekly pattern /schedule already
        takes (e.g. "Monday 18:00-20:00 free"), assumed to repeat every
        generated week.
    tasks: same shape as StudyScheduler.add_task() expects (task_id, module,
        deadline_date, weight, priority_label, estimated_hours_needed,
        optional task_type) - deliberately NOT pre-split per week by the
        caller; a task's estimated_hours_needed is its TOTAL remaining need,
        and this function figures out which week(s) it actually lands in.
    weeks_ahead: explicit override for how many weeks to generate. If
        omitted, auto-derived from the farthest task deadline (preferred -
        see the task description). Always capped at MAX_WEEKS_AHEAD either way.

    BACKLOG CARRYOVER MECHANISM: a per-task `remaining_hours` pool is tracked
    across the whole loop, seeded from each task's estimated_hours_needed and
    decremented by whatever a week's StudyScheduler actually placed. A task
    is included in week i's scheduling pool (with estimated_hours_needed set
    to its CURRENT remaining_hours, not its original) as long as its deadline
    hasn't fully passed before week i starts AND it still has remaining hours
    - so unplaced hours from an earlier week are neither dropped nor
    double-counted, they simply compete again (at the same priority tier)
    for the next week's free capacity. A task is only reported in
    overload_warning once - in the week that actually CONTAINS its deadline -
    never speculatively in an earlier week where it merely hadn't been
    scheduled YET but still had later weeks to catch up in. This is why each
    week's own StudyScheduler.generate_schedule().overload_warning is
    deliberately NOT used directly; a task under-filled in week 1 with a
    week-3 deadline is not yet a real shortfall.

    Exam-prep escalation (Section 8a) continuing to work correctly across
    week boundaries is a property of the CALLER, not this function: the
    frontend already computes each week's slice of an exam's escalating
    curve client-side (computeExamPrepHoursForDay, examPrepConfig.js) and is
    expected to submit one task per (exam, week) pair here - e.g.
    "exam-<id>-w0", "exam-<id>-w1", ... - each carrying that week's own
    escalating chunk and the exam's real deadline_date. This function then
    applies the exact same generic backlog-carryover logic to those chunks
    as it does to any assignment - if week 0's light chunk doesn't fully
    fit, it carries into week 1 alongside week 1's own (heavier) chunk,
    with no special-casing needed here for "this is exam prep" at all.

    Returns:
        {
          "schedule": {"YYYY-MM-DD": [items...], ...}  # every date in the
              generated range present, even with an empty list,
          "overload_warning": [...],  # same shape as StudyScheduler's, plus task_type
          "tasks": {task_id: {..., "weeks_allocated": [0, 1, ...]}},  # 0-indexed
          "weeks_generated": int,
          "range_start": "YYYY-MM-DD", "range_end": "YYYY-MM-DD",
        }
    """
    anchor_date = anchor_date or date.today()
    tasks = [dict(t) for t in tasks]
    for t in tasks:
        t.setdefault("task_type", "assignment")

    task_lookup = {t["task_id"]: t for t in tasks}
    remaining_hours = {t["task_id"]: t["estimated_hours_needed"] for t in tasks}
    weeks_allocated = {t["task_id"]: [] for t in tasks}

    num_weeks = _weeks_needed_for(tasks, anchor_date, weeks_ahead)
    range_start = anchor_date
    range_end = anchor_date + timedelta(days=num_weeks * 7 - 1)

    combined_schedule = {
        (range_start + timedelta(days=d)).isoformat(): []
        for d in range(num_weeks * 7)
    }
    overload_warning = []

    for week_idx in range(num_weeks):
        week_anchor = anchor_date + timedelta(days=7 * week_idx)
        week_end = week_anchor + timedelta(days=6)

        week_task_list = []
        for tid, hours_left in remaining_hours.items():
            if hours_left <= 1e-9:
                continue
            deadline = datetime.strptime(task_lookup[tid]["deadline_date"], "%Y-%m-%d").date()
            if deadline < week_anchor:
                continue  # deadline already fully passed before this week even starts
            not_before = task_lookup[tid].get("not_before_date")
            if not_before and week_anchor < datetime.strptime(not_before, "%Y-%m-%d").date():
                # This task isn't eligible yet - e.g. a multi-week exam-prep
                # chunk built for a LATER week (see not_before_date's own
                # doc comment, TaskInput). Without this, a week with idle
                # free capacity greedily front-loads a chunk meant for
                # several weeks from now, well before its escalating-urgency
                # curve says it should happen - PROJECT CONTEXT.md Section 8e.
                continue
            week_task_list.append({**task_lookup[tid], "estimated_hours_needed": hours_left})

        scheduler = StudyScheduler(weekly_free_slots, anchor_date=week_anchor)
        for t in week_task_list:
            scheduler.add_task(t)
        week_result = scheduler.generate_schedule()

        # Re-key this week's weekday-named schedule onto real calendar dates
        # and merge into the combined multi-week result.
        for day_name, items in week_result["schedule"].items():
            if not items:
                continue
            real_date = resolve_day_date(day_name, week_anchor).isoformat()
            combined_schedule[real_date] = items

        # Decrement the backlog pool by what actually got placed this week.
        scheduled_minutes_this_week = {}
        for items in week_result["schedule"].values():
            for item in items:
                scheduled_minutes_this_week[item["task_id"]] = (
                    scheduled_minutes_this_week.get(item["task_id"], 0) + item["duration_minutes"]
                )
        for tid, minutes in scheduled_minutes_this_week.items():
            remaining_hours[tid] -= minutes / 60
            weeks_allocated[tid].append(week_idx)

        # Only report a real shortfall once we've reached the week that
        # actually contains the task's deadline - not speculatively earlier,
        # while later weeks could still catch it up.
        for t in week_task_list:
            tid = t["task_id"]
            deadline = datetime.strptime(task_lookup[tid]["deadline_date"], "%Y-%m-%d").date()
            deadline_is_this_week = week_anchor <= deadline <= week_end
            if deadline_is_this_week and remaining_hours[tid] > 1e-9:
                overload_warning.append({
                    "task_id": tid,
                    "module": task_lookup[tid]["module"],
                    "priority_label": task_lookup[tid]["priority_label"],
                    "deadline_date": task_lookup[tid]["deadline_date"],
                    "hours_short": round(remaining_hours[tid], 2),
                    "task_type": task_lookup[tid].get("task_type", "assignment"),
                })

    tasks_registry = {
        t["task_id"]: {
            "module": t["module"],
            "weight": t["weight"],
            "priority_label": t["priority_label"],
            "deadline_date": t["deadline_date"],
            "estimated_hours_needed": t["estimated_hours_needed"],
            "task_type": t.get("task_type", "assignment"),
            "weeks_allocated": weeks_allocated[t["task_id"]],
        }
        for t in tasks
    }

    return {
        "schedule": combined_schedule,
        "overload_warning": overload_warning,
        "tasks": tasks_registry,
        "weeks_generated": num_weeks,
        "range_start": range_start.isoformat(),
        "range_end": range_end.isoformat(),
    }


def print_schedule(result, title):
    print(f"\n--- {title} ---")
    for day in DAY_ORDER:
        items = result["schedule"].get(day, [])
        if not items:
            continue
        print(f"  {day}:")
        for item in items:
            print(f"    {item['time_slot']}  [{item['module']}] {item['task_id']} ({item['duration_minutes']} min)")
    if result["overload_warning"]:
        print("  OVERLOAD WARNING - could not fully schedule:")
        for w in result["overload_warning"]:
            print(f"    {w['task_id']} ({w['module']}, {w['priority_label']}) - short by {w['hours_short']}h "
                  f"before deadline {w['deadline_date']}")
    else:
        print("  No overload - all tasks fully scheduled.")


# ===========================================================================
# __main__ demo
# ===========================================================================
if __name__ == "__main__":
    section("0. CHECK REQUIRED INPUT FILES (for classifier-driven demo tasks)")

    required = {MODEL_PATH: "train_priority_model.py", SCALER_PATH: "train_priority_model.py",
                LABEL_ENCODERS_PATH: "train_priority_model.py", DATASET_PATH: "train_priority_model.py"}
    missing = [(p, s) for p, s in required.items() if not os.path.exists(p)]
    if missing:
        print("ERROR: missing required input file(s):")
        for p, s in missing:
            print(f"  - {p}  (run {s} first to generate this)")
        sys.exit(1)
    print("All required input files found.")

    section("1. LOAD TRAINED PRIORITY MODEL")
    model = joblib.load(MODEL_PATH)
    xgb_label_encoder = joblib.load(XGB_LABEL_ENCODER_PATH) if os.path.exists(XGB_LABEL_ENCODER_PATH) else None
    label_encoders = joblib.load(LABEL_ENCODERS_PATH)
    feature_cols = list(model.feature_names_in_)
    print(f"Loaded {type(model).__name__}. Feature columns: {feature_cols}")

    def predict_priority(feature_row: dict) -> str:
        """Runs the trained classifier on one hand-built feature row (dict -> label)."""
        row_df = pd.DataFrame([feature_row])[feature_cols]
        pred_num = model.predict(row_df)[0]
        if xgb_label_encoder is not None:
            return xgb_label_encoder.inverse_transform([pred_num])[0]
        return pred_num

    section("2. BUILD SAMPLE WEEKLY FREE-SLOT LIST")
    weekly_free_slots = [
        {"day": "Monday", "start_time": "09:00", "end_time": "11:00", "duration_minutes": 120},
        {"day": "Monday", "start_time": "18:00", "end_time": "19:30", "duration_minutes": 90},
        {"day": "Tuesday", "start_time": "14:00", "end_time": "16:00", "duration_minutes": 120},
        {"day": "Wednesday", "start_time": "09:00", "end_time": "10:00", "duration_minutes": 60},
        {"day": "Wednesday", "start_time": "17:00", "end_time": "19:00", "duration_minutes": 120},
        {"day": "Thursday", "start_time": "10:00", "end_time": "12:00", "duration_minutes": 120},
        {"day": "Friday", "start_time": "13:00", "end_time": "15:00", "duration_minutes": 120},
        {"day": "Saturday", "start_time": "10:00", "end_time": "13:00", "duration_minutes": 180},
        {"day": "Saturday", "start_time": "15:00", "end_time": "16:00", "duration_minutes": 60},
        {"day": "Sunday", "start_time": "11:00", "end_time": "13:00", "duration_minutes": 120},
    ]
    total_free_minutes = sum(s["duration_minutes"] for s in weekly_free_slots)
    print(f"{len(weekly_free_slots)} free slots this week, {total_free_minutes} minutes "
          f"({total_free_minutes / 60:.1f} hours) total free capacity.")

    section("3. BUILD SAMPLE TASKS (priority predicted by the trained classifier)")

    # Rather than hand-crafting feature values (which risks unrealistic
    # combinations the model never saw in training and can extrapolate
    # oddly on), sample real rows from the leakage-free dataset the model
    # was trained on, stratified across its true Priority_Label so the demo
    # shows a genuine mix - then run those real feature rows through the
    # classifier to get realistic, trustworthy predicted priorities.
    task_data = pd.read_csv(DATASET_PATH)
    sample_per_class = {"High": 2, "Medium": 3, "Low": 2}
    sampled_rows = pd.concat([
        task_data[task_data["Priority_Label"] == label].sample(n=n, random_state=42)
        for label, n in sample_per_class.items()
    ]).reset_index(drop=True)

    module_encoder = label_encoders["code_module"]
    today = date.today()

    scheduler = StudyScheduler(weekly_free_slots)
    for i, row in sampled_rows.iterrows():
        task_id = f"T{i + 1}"
        module = module_encoder.inverse_transform([int(row["code_module_enc"])])[0]
        feature_row = row[feature_cols].to_dict()
        priority_label = predict_priority(feature_row)
        # Spread demo deadlines across the next 2-9 days so the schedule has
        # a realistic mix of near-term and further-out work.
        deadline_date = (today + timedelta(days=2 + i)).isoformat()
        # Rough hours-needed heuristic for the demo: scale with the task's
        # real weight (bigger assessments need more study time), nudged by
        # predicted priority so High-priority tasks skew toward more hours.
        priority_hours_bonus = {"High": 2, "Medium": 1, "Low": 0}[priority_label]
        estimated_hours_needed = max(1, round(row["weight"] / 10) + priority_hours_bonus)

        scheduler.add_task({
            "task_id": task_id,
            "module": module,
            "deadline_date": deadline_date,
            "weight": float(row["weight"]),
            "priority_label": priority_label,
            "estimated_hours_needed": estimated_hours_needed,
        })
        print(f"  {task_id} ({module}, deadline {deadline_date}, weight {row['weight']:.0f}, "
              f"true label {row['Priority_Label']}) -> predicted priority: {priority_label}, "
              f"needs {estimated_hours_needed}h")

    section("4. GENERATE INITIAL SCHEDULE")
    initial_result = scheduler.generate_schedule()
    print_schedule(initial_result, "Initial Weekly Schedule")

    with open(os.path.join(OUTPUTS_DIR, "sample_schedule_initial.json"), "w") as f:
        json.dump(initial_result, f, indent=2)
    print("\nSaved sample_schedule_initial.json")

    section("5. SIMULATE COMPLETING TASKS + ADDING A NEW URGENT TASK, THEN RESCHEDULE")
    # Complete the first two tasks the scheduler actually placed (whatever
    # they turned out to be), then add one more real sampled High-priority
    # row as a fresh urgent task arriving mid-week.
    completed = [t["task_id"] for t in scheduler.tasks[:2]]
    new_row = task_data[task_data["Priority_Label"] == "High"].sample(n=1, random_state=7).iloc[0]
    new_module = module_encoder.inverse_transform([int(new_row["code_module_enc"])])[0]
    new_feature_row = new_row[feature_cols].to_dict()
    new_priority_label = predict_priority(new_feature_row)
    new_urgent_task = {
        "task_id": f"T{len(sampled_rows) + 1}",
        "module": new_module,
        "deadline_date": (today + timedelta(days=2)).isoformat(),  # arrives with a near-term deadline
        "weight": float(new_row["weight"]),
        "priority_label": new_priority_label,
        "estimated_hours_needed": max(1, round(new_row["weight"] / 10) + 2),
    }
    print(f"Completed: {completed}")
    print(f"New task: {new_urgent_task['task_id']} ({new_urgent_task['module']}, "
          f"predicted priority: {new_urgent_task['priority_label']})")

    after_result = scheduler.reschedule(completed_task_ids=completed, new_tasks=[new_urgent_task])
    print_schedule(after_result, "Schedule After Reschedule")

    with open(os.path.join(OUTPUTS_DIR, "sample_schedule_after_reschedule.json"), "w") as f:
        json.dump(after_result, f, indent=2)
    print("\nSaved sample_schedule_after_reschedule.json")

    section("6. SUMMARY")
    print(f"""
Summary:
- Built a greedy, priority-then-deadline rule-based StudyScheduler (documented MVP for the
  adaptive scheduling objective; a learned RL policy is noted future work behind the same interface).
- Predicted priority for {len(sampled_rows) + 1} real sampled tasks using the trained
  priority_model.joblib, then generated an initial weekly schedule across {len(weekly_free_slots)} free slots.
- Simulated completing {len(completed)} tasks and adding 1 new urgent task, then called reschedule()
  to show the system adapting to new information without a full re-plan from scratch.
- Saved: sample_schedule_initial.json, sample_schedule_after_reschedule.json to {OUTPUTS_DIR}
""")
    print("Done.")
