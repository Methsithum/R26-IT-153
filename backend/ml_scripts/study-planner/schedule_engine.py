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
MODELS_DIR = os.path.join(BACKEND_DIR, "trained-models", "stuyd-planner")

MODEL_PATH = os.path.join(MODELS_DIR, "priority_model.joblib")
SCALER_PATH = os.path.join(MODELS_DIR, "scaler.joblib")
LABEL_ENCODERS_PATH = os.path.join(MODELS_DIR, "label_encoders.joblib")
XGB_LABEL_ENCODER_PATH = os.path.join(MODELS_DIR, "xgb_label_encoder.joblib")
DATASET_PATH = os.path.join(OUTPUTS_DIR, "oulad_task_level_leakage_free.csv")

os.makedirs(OUTPUTS_DIR, exist_ok=True)

PRIORITY_ORDER = {"High": 0, "Medium": 1, "Low": 2}  # lower = scheduled first
DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def section(title):
    print("\n" + "=" * 90)
    print(title)
    print("=" * 90)


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
        target_weekday = DAY_ORDER.index(day_name)
        delta_days = (target_weekday - self.anchor_date.weekday()) % 7
        return self.anchor_date + timedelta(days=delta_days)

    def add_task(self, task):
        """
        task: dict with keys
            task_id, module, deadline_date (ISO "YYYY-MM-DD"), weight,
            priority_label ("High"/"Medium"/"Low"), estimated_hours_needed
        """
        required = {"task_id", "module", "deadline_date", "weight", "priority_label", "estimated_hours_needed"}
        missing = required - task.keys()
        if missing:
            raise ValueError(f"Task {task.get('task_id', '?')} missing required fields: {missing}")
        self.tasks.append(dict(task))

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
              "tasks": {task_id: {module, priority_label, deadline_date, estimated_hours_needed}, ...}
            }
        The "tasks" registry covers every task known to the scheduler at
        generation time (not just overloaded ones) - downstream consumers
        like generate_todo_output.py need each task's deadline/priority
        even when it WAS fully scheduled, since the schedule/overload_warning
        sections alone don't carry that for successfully-placed tasks.
        """
        # Work on a fresh copy of remaining slot capacity so repeated calls
        # (e.g. via reschedule()) don't corrupt the original free-slot list.
        remaining_slots = [dict(slot) for slot in self.weekly_free_slots]
        schedule = {day: [] for day in DAY_ORDER}
        overload_warning = []

        for task in self._sort_tasks():
            deadline = datetime.strptime(task["deadline_date"], "%Y-%m-%d")
            hours_needed = task["estimated_hours_needed"]
            minutes_needed = hours_needed * 60

            # Only slots whose real calendar date falls on/before the deadline.
            eligible_slots = [
                s for s in remaining_slots
                if s["duration_minutes"] > 0 and self._slot_date(s["day"]) <= deadline.date()
            ]
            # Nearest-first: earliest date, then earliest by start_time.
            eligible_slots.sort(key=lambda s: (self._slot_date(s["day"]), s["start_time"]))

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

            if minutes_needed > 0:
                overload_warning.append({
                    "task_id": task["task_id"],
                    "module": task["module"],
                    "priority_label": task["priority_label"],
                    "deadline_date": task["deadline_date"],
                    "hours_short": round(minutes_needed / 60, 2),
                })

        # Keep only slots with remaining capacity for the next reschedule() call.
        self.weekly_free_slots = [s for s in remaining_slots if s["duration_minutes"] > 0]

        for day in schedule:
            schedule[day].sort(key=lambda item: item["time_slot"])

        tasks_registry = {
            t["task_id"]: {
                "module": t["module"],
                "priority_label": t["priority_label"],
                "deadline_date": t["deadline_date"],
                "estimated_hours_needed": t["estimated_hours_needed"],
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
