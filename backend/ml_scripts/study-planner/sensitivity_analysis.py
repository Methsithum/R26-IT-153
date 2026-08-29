"""
sensitivity_analysis.py

Sensitivity analysis for the hardcoded constants in the hybrid priority
layer (frontend/src/utils/priorityEngine.js, PROJECT CONTEXT.md Section 5d)
and the exam-prep escalation model (frontend/src/utils/examPrepConfig.js,
Section 8a):

  - Base tier day-thresholds (assignment: 2/15 real boundaries, exam: 7/31;
    the "7"/"14" cosmetic sub-boundaries in the assignment table and the "14"
    in the exam table are "leaning" labels only - see priorityEngine.js's
    computeBaseTier - they never change the computed tier, so they have no
    effect on any scheduling metric and are excluded from the sweep below.
    The >30-day hard floor is swept alongside these two real boundaries.)
  - The +/-1 ML modifier clamp
  - Exam prep total budget hours
  - Exam prep escalation curve (share of budget per days-out window)
  - Performance multiplier range

DOES NOT MODIFY ANY PRODUCTION FILE. The priority/exam-prep math below is a
standalone Python port of the JS logic, parameterized so each constant can
be swept independently - written for this analysis only. Production values
(PROD_* constants below) are transcribed directly from priorityEngine.js /
examPrepConfig.js and must be kept in sync by hand if those files change.

Reuses the real StudyScheduler (schedule_engine.py) unmodified for the
actual slot-filling step, so the scheduling OUTCOME measured here is the
real production allocator's behavior under different upstream constants,
not a separate simulation of it.

Run with:
    venv/Scripts/python ml_scripts/study-planner/sensitivity_analysis.py
"""

import csv
import os
import statistics
import sys
from datetime import date, timedelta

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
OUTPUTS_DIR = os.path.join(BACKEND_DIR, "ml_scripts", "study-planner", "outputs")
os.makedirs(OUTPUTS_DIR, exist_ok=True)

if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)
from schedule_engine import StudyScheduler, DAY_ORDER  # noqa: E402

ANCHOR_DATE = date(2026, 8, 29)  # Saturday - matches the real sample data used throughout this project's docs

LEVELS = {"Low": 0, "Medium": 1, "High": 2}
LABELS = ["Low", "Medium", "High"]


def section(title):
    print("\n" + "=" * 90)
    print(title)
    print("=" * 90)


# ===========================================================================
# 1. PRODUCTION VALUES (transcribed from priorityEngine.js / examPrepConfig.js)
# ===========================================================================
PROD_THRESHOLDS = {
    "assign_high_max": 2,     # <=2 days -> High (assignment)
    "assign_low_min": 15,     # >=15 days -> Low (assignment); 3-14 = Medium
    "exam_high_max": 7,       # <=7 days -> High (exam)
    "exam_low_min": 31,       # >=31 days -> Low (exam); 8-30 = Medium
    "hard_floor_days": 30,    # >30 days -> forced Low regardless of ML, either type
}
PROD_CLAMP = 1
PROD_EXAM_BUDGET_HOURS = 12
PROD_EXAM_CURVE = [  # (min_days, max_days_or_None, share_of_budget)
    (15, None, 0.15),
    (7, 14, 0.35),
    (0, 6, 0.50),
]
PROD_PERF_MULT = {"weak": 1.4, "baseline": 1.0, "strong": 0.75}
PERF_WEAK_THRESH = 50
PERF_STRONG_THRESH = 70


# ===========================================================================
# 2. STANDALONE PYTHON PORT OF THE HYBRID PRIORITY LAYER (priorityEngine.js)
# ===========================================================================
def clamp(n, lo, hi):
    return max(lo, min(hi, n))


def compute_base_tier_level(days, task_type, thresholds):
    """Returns 0/1/2 (Low/Medium/High). Mirrors computeBaseTier()."""
    if days < 0:
        return 2
    if task_type == "exam":
        if days <= thresholds["exam_high_max"]:
            return 2
        if days < thresholds["exam_low_min"]:
            return 1
        return 0
    # assignment
    if days <= thresholds["assign_high_max"]:
        return 2
    if days < thresholds["assign_low_min"]:
        return 1
    return 0


def compute_final_priority_level(days, task_type, ml_level, thresholds, modifier_clamp):
    """Mirrors computeFinalPriority(). Returns 0/1/2."""
    if days > thresholds["hard_floor_days"]:
        return 0  # Low, unconditional

    base = compute_base_tier_level(days, task_type, thresholds)
    overdue = days < 0
    if overdue or ml_level is None:
        return 2 if overdue else base

    modifier = clamp(ml_level - base, -modifier_clamp, modifier_clamp)
    return clamp(base + modifier, 0, 2)


# ===========================================================================
# 3. STANDALONE PYTHON PORT OF THE EXAM-PREP MODEL (examPrepConfig.js)
# ===========================================================================
def curve_window_for(days, curve):
    for min_d, max_d, share in curve:
        if days >= min_d and (max_d is None or days <= max_d):
            return (min_d, max_d, share)
    return None


def compute_exam_prep_hours_for_day(exam_days_from_today, for_day_offset, total_budget_hours, curve):
    """Mirrors computeExamPrepHoursForDay(). Days measured from `today` (offset 0)."""
    days_from_forday_to_exam = exam_days_from_today - for_day_offset
    if days_from_forday_to_exam < 0:
        return 0.0
    window = curve_window_for(days_from_forday_to_exam, curve)
    if not window:
        return 0.0
    min_d, max_d, share = window
    window_hi = exam_days_from_today if max_d is None else min(max_d, exam_days_from_today)
    days_in_window = max(1, window_hi - min_d + 1)
    return (total_budget_hours * share) / days_in_window


def compute_performance_multiplier(performance, has_data, perf_mult):
    if not has_data or performance is None:
        return perf_mult["baseline"]
    if performance < PERF_WEAK_THRESH:
        return perf_mult["weak"]
    if performance > PERF_STRONG_THRESH:
        return perf_mult["strong"]
    return perf_mult["baseline"]


SCHEDULING_WINDOW_DAYS = 6  # mirrors examPrepScheduling.js


def build_exam_prep_task(exam, thresholds, modifier_clamp, exam_budget_hours, exam_curve, perf_mult):
    """Mirrors buildExamPrepTasks() for one exam. Returns a StudyScheduler task dict or None."""
    exam_days = (date.fromisoformat(exam["date"]) - ANCHOR_DATE).days
    if exam_days < 0:
        return None

    multiplier = compute_performance_multiplier(exam.get("performance"), exam.get("has_data", False), perf_mult)
    final_budget = exam_budget_hours * multiplier

    window_end = min(exam_days, SCHEDULING_WINDOW_DAYS)
    this_week_hours = sum(
        compute_exam_prep_hours_for_day(exam_days, d, final_budget, exam_curve) for d in range(window_end + 1)
    )
    this_week_hours = round(this_week_hours * 4) / 4
    if this_week_hours <= 0:
        return None

    priority_level = compute_base_tier_level(exam_days, "exam", thresholds)
    return {
        "task_id": f"exam-{exam['id']}",
        "module": exam["module"],
        "deadline_date": exam["date"],
        "weight": 100,
        "estimated_hours_needed": this_week_hours,
        "priority_label": LABELS[priority_level],
        "task_type": "exam",
    }


def build_assignment_task(a, thresholds, modifier_clamp):
    """Applies the hybrid layer (base tier + clamped ML modifier) to one assignment."""
    days = (date.fromisoformat(a["deadline"]) - ANCHOR_DATE).days
    final_level = compute_final_priority_level(days, "assignment", LEVELS[a["raw_ml_label"]], thresholds, modifier_clamp)
    return {
        "task_id": a["id"],
        "module": a["module"],
        "deadline_date": a["deadline"],
        "weight": a["weight"],
        "estimated_hours_needed": a["hours_needed"],
        "priority_label": LABELS[final_level],
        "task_type": "assignment",
    }


# ===========================================================================
# 4. evaluateSchedule() - the 4 outcome metrics
# ===========================================================================
def _slot_date(day_name, anchor_date):
    target_weekday = DAY_ORDER.index(day_name)
    delta_days = (target_weekday - anchor_date.weekday()) % 7
    return anchor_date + timedelta(days=delta_days)


def evaluate_schedule(schedule_result, anchor_date=ANCHOR_DATE):
    """
    Returns {pct_high_priority_scheduled_before_deadline, avg_lead_time_high_priority,
    daily_load_variance, overload_total_hours}. None for a metric that is
    undefined for this scenario (e.g. no High-priority tasks at all) rather
    than a misleading 0 or 1.
    """
    tasks = schedule_result["tasks"]
    schedule = schedule_result["schedule"]
    overload = schedule_result["overload_warning"]
    overloaded_ids = {w["task_id"] for w in overload}

    high_ids = [tid for tid, info in tasks.items() if info["priority_label"] == "High"]
    fully_scheduled_high = [tid for tid in high_ids if tid not in overloaded_ids]

    pct_high_scheduled = (len(fully_scheduled_high) / len(high_ids)) if high_ids else None

    lead_times = []
    for tid in fully_scheduled_high:
        sessions_for_task = [
            (day, item) for day, items in schedule.items() for item in items if item["task_id"] == tid
        ]
        if not sessions_for_task:
            continue
        last_session_date = max(_slot_date(day, anchor_date) for day, _ in sessions_for_task)
        deadline = date.fromisoformat(tasks[tid]["deadline_date"])
        lead_times.append((deadline - last_session_date).days)
    avg_lead_time = statistics.mean(lead_times) if lead_times else None

    daily_hours = []
    for day in DAY_ORDER:
        minutes = sum(item["duration_minutes"] for item in schedule.get(day, []))
        daily_hours.append(minutes / 60)
    daily_load_variance = statistics.pvariance(daily_hours)

    overload_total_hours = sum(w["hours_short"] for w in overload)

    return {
        "pct_high_priority_scheduled_before_deadline": pct_high_scheduled,
        "avg_lead_time_high_priority": avg_lead_time,
        "daily_load_variance": daily_load_variance,
        "overload_total_hours": overload_total_hours,
    }


# ===========================================================================
# 5. FIXED TEST SCENARIOS (reused, unchanged, across every sweep)
# ===========================================================================
def free_slots(hours_per_day, start="17:00"):
    sh, sm = map(int, start.split(":"))
    end_minutes = sh * 60 + sm + hours_per_day * 60
    end = f"{end_minutes // 60:02d}:{end_minutes % 60:02d}"
    return [{"day": d, "start_time": start, "end_time": end, "duration_minutes": hours_per_day * 60} for d in DAY_ORDER]


SCENARIOS = {
    # Light week: 2 assignments, 1 far-off exam, generous free time (21h/wk).
    "light": {
        "free_slots": free_slots(3),
        "assignments": [
            {"id": "a1", "module": "AAA", "deadline": (ANCHOR_DATE + timedelta(days=3)).isoformat(),
             "weight": 15, "hours_needed": 3, "raw_ml_label": "High"},
            {"id": "a2", "module": "BBB", "deadline": (ANCHOR_DATE + timedelta(days=10)).isoformat(),
             "weight": 10, "hours_needed": 2, "raw_ml_label": "Medium"},
        ],
        "exams": [
            {"id": "e1", "module": "CCC", "date": (ANCHOR_DATE + timedelta(days=25)).isoformat(),
             "performance": 75, "has_data": True},
        ],
    },
    # Typical week: 4 assignments (incl. one far-off Low-floor case), 2 exams
    # at real-sample-like distances (8d/14d), realistic free time (21h/wk).
    "typical": {
        "free_slots": free_slots(3),
        "assignments": [
            {"id": "a1", "module": "AAA", "deadline": (ANCHOR_DATE + timedelta(days=2)).isoformat(),
             "weight": 25, "hours_needed": 4, "raw_ml_label": "High"},
            {"id": "a2", "module": "BBB", "deadline": (ANCHOR_DATE + timedelta(days=6)).isoformat(),
             "weight": 15, "hours_needed": 3, "raw_ml_label": "Low"},  # disagreement w/ base tier -> exercises modifier clamp
            {"id": "a3", "module": "CCC", "deadline": (ANCHOR_DATE + timedelta(days=12)).isoformat(),
             "weight": 10, "hours_needed": 2, "raw_ml_label": "High"},  # disagreement -> modifier clamp
            {"id": "a4", "module": "AAA", "deadline": (ANCHOR_DATE + timedelta(days=32)).isoformat(),
             "weight": 20, "hours_needed": 3, "raw_ml_label": "High"},  # >30d hard-floor case
        ],
        "exams": [
            {"id": "e1", "module": "DDD", "date": (ANCHOR_DATE + timedelta(days=8)).isoformat(),
             "performance": 40, "has_data": True},
            {"id": "e2", "module": "EEE", "date": (ANCHOR_DATE + timedelta(days=14)).isoformat(),
             "performance": 65, "has_data": True},
        ],
    },
    # Heavy/overloaded week: matches the real 4-exam sample (8/10/12/14d) plus
    # 4 assignments, scarce free time (14h/wk) - forces real overload.
    "heavy": {
        "free_slots": free_slots(2),
        "assignments": [
            {"id": "a1", "module": "AAA", "deadline": (ANCHOR_DATE + timedelta(days=1)).isoformat(),
             "weight": 30, "hours_needed": 5, "raw_ml_label": "High"},
            {"id": "a2", "module": "BBB", "deadline": (ANCHOR_DATE + timedelta(days=4)).isoformat(),
             "weight": 25, "hours_needed": 4, "raw_ml_label": "Medium"},
            {"id": "a3", "module": "CCC", "deadline": (ANCHOR_DATE + timedelta(days=9)).isoformat(),
             "weight": 15, "hours_needed": 3, "raw_ml_label": "Medium"},
            {"id": "a4", "module": "DDD", "deadline": (ANCHOR_DATE + timedelta(days=20)).isoformat(),
             "weight": 10, "hours_needed": 2, "raw_ml_label": "Low"},
        ],
        "exams": [
            {"id": "e1", "module": "EEE", "date": (ANCHOR_DATE + timedelta(days=8)).isoformat(),
             "performance": 30, "has_data": True},
            {"id": "e2", "module": "FFF", "date": (ANCHOR_DATE + timedelta(days=10)).isoformat(),
             "performance": 55, "has_data": True},
            {"id": "e3", "module": "GGG", "date": (ANCHOR_DATE + timedelta(days=12)).isoformat(),
             "performance": 80, "has_data": True},
            {"id": "e4", "module": "AAA", "date": (ANCHOR_DATE + timedelta(days=14)).isoformat(),
             "performance": None, "has_data": False},
        ],
    },
}


# ===========================================================================
# 6. RUNNER
# ===========================================================================
def run_scenario(scenario_name, thresholds, modifier_clamp, exam_budget_hours, exam_curve, perf_mult):
    sc = SCENARIOS[scenario_name]
    tasks = [build_assignment_task(a, thresholds, modifier_clamp) for a in sc["assignments"]]
    for e in sc["exams"]:
        t = build_exam_prep_task(e, thresholds, modifier_clamp, exam_budget_hours, exam_curve, perf_mult)
        if t:
            tasks.append(t)

    scheduler = StudyScheduler(sc["free_slots"], anchor_date=ANCHOR_DATE)
    for t in tasks:
        scheduler.add_task(t)
    result = scheduler.generate_schedule()
    return evaluate_schedule(result, ANCHOR_DATE)


def fmt(v, nd=3):
    return "n/a" if v is None else round(v, nd)


def run_sweep(group_name, values_and_labels, config_builder, rows):
    section(f"SWEEP: {group_name}")
    for label, value in values_and_labels:
        thresholds, clamp_v, budget, curve, perf_mult = config_builder(value)
        for scenario_name in SCENARIOS:
            metrics = run_scenario(scenario_name, thresholds, clamp_v, budget, curve, perf_mult)
            rows.append({
                "constant_group": group_name,
                "varied_value": label,
                "scenario": scenario_name,
                **{k: fmt(v) for k, v in metrics.items()},
            })
            print(f"  [{label:>28}] {scenario_name:8s} -> "
                  f"pct_high={fmt(metrics['pct_high_priority_scheduled_before_deadline'])} "
                  f"lead_time={fmt(metrics['avg_lead_time_high_priority'])} "
                  f"variance={fmt(metrics['daily_load_variance'])} "
                  f"overload_h={fmt(metrics['overload_total_hours'])}")


if __name__ == "__main__":
    rows = []

    # --- 3a. Base tier day-thresholds: shift by -5,-2,0(current),+2,+5 ---
    def threshold_config(delta):
        t = dict(PROD_THRESHOLDS)
        t["assign_high_max"] = max(0, t["assign_high_max"] + delta)
        t["assign_low_min"] = max(1, t["assign_low_min"] + delta)
        t["exam_high_max"] = max(0, t["exam_high_max"] + delta)
        t["exam_low_min"] = max(1, t["exam_low_min"] + delta)
        t["hard_floor_days"] = max(1, t["hard_floor_days"] + delta)
        return t, PROD_CLAMP, PROD_EXAM_BUDGET_HOURS, PROD_EXAM_CURVE, PROD_PERF_MULT

    run_sweep(
        "base_tier_thresholds",
        [("delta=-5", -5), ("delta=-2", -2), ("delta=0 (CURRENT)", 0), ("delta=+2", 2), ("delta=+5", 5)],
        threshold_config,
        rows,
    )

    # --- 3b. ML modifier clamp: 0, 1(current), 2 ---
    def clamp_config(c):
        return dict(PROD_THRESHOLDS), c, PROD_EXAM_BUDGET_HOURS, PROD_EXAM_CURVE, PROD_PERF_MULT

    run_sweep(
        "ml_modifier_clamp",
        [("clamp=0 (pure rule)", 0), ("clamp=1 (CURRENT)", 1), ("clamp=2 (more ML)", 2)],
        clamp_config,
        rows,
    )

    # --- 3c. Exam prep total budget: 8h, 12h(current), 16h ---
    def budget_config(h):
        return dict(PROD_THRESHOLDS), PROD_CLAMP, h, PROD_EXAM_CURVE, PROD_PERF_MULT

    run_sweep(
        "exam_budget_hours",
        [("8h", 8), ("12h (CURRENT)", 12), ("16h", 16)],
        budget_config,
        rows,
    )

    # --- 3d. Exam prep curve: flatter, current, front-loaded ---
    CURVES = {
        "flatter (25/40/35)": [(15, None, 0.25), (7, 14, 0.40), (0, 6, 0.35)],
        "current (15/35/50)": PROD_EXAM_CURVE,
        "front-loaded (30/40/30)": [(15, None, 0.30), (7, 14, 0.40), (0, 6, 0.30)],
    }

    def curve_config(curve):
        return dict(PROD_THRESHOLDS), PROD_CLAMP, PROD_EXAM_BUDGET_HOURS, curve, PROD_PERF_MULT

    run_sweep(
        "exam_prep_curve",
        [(name, curve) for name, curve in CURVES.items()],
        curve_config,
        rows,
    )

    # --- 3e. Performance multiplier range: narrower, current, wider ---
    PERF_RANGES = {
        "narrower (1.2/1.0/0.9)": {"weak": 1.2, "baseline": 1.0, "strong": 0.9},
        "current (1.4/1.0/0.75)": PROD_PERF_MULT,
        "wider (1.6/1.0/0.6)": {"weak": 1.6, "baseline": 1.0, "strong": 0.6},
    }

    def perf_config(pm):
        return dict(PROD_THRESHOLDS), PROD_CLAMP, PROD_EXAM_BUDGET_HOURS, PROD_EXAM_CURVE, pm

    run_sweep(
        "performance_multiplier_range",
        [(name, pm) for name, pm in PERF_RANGES.items()],
        perf_config,
        rows,
    )

    # --- Save CSV ---
    section("SAVE CSV")
    csv_path = os.path.join(OUTPUTS_DIR, "sensitivity_analysis_report.csv")
    fieldnames = [
        "constant_group", "varied_value", "scenario",
        "pct_high_priority_scheduled_before_deadline", "avg_lead_time_high_priority",
        "daily_load_variance", "overload_total_hours",
    ]
    with open(csv_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Saved {len(rows)} rows to {csv_path}")
