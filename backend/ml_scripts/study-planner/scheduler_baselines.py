"""
scheduler_baselines.py

Phase 2 of the study-planner scheduling research: is StudyScheduler's
greedy priority-then-deadline allocation actually a good approach, compared
to what simpler/different algorithms achieve on the same data?

Does NOT modify schedule_engine.py or StudyScheduler at all. Baselines
below reuse StudyScheduler's exact slot-filling MECHANICS (same eligible-
slot filtering by deadline, same least-loaded-day/date/start-time tiebreak)
via a shared, standalone `_greedy_fill()` function - the ONLY thing that
differs between StudyScheduler and each baseline is the ORDER tasks are
allocated in. This is a deliberate design choice: it isolates the exact
variable in question (is priority-then-deadline ORDERING better than
FCFS/EDF/random ordering?) rather than conflating it with incidental
differences in how slots get filled, which would make "baseline X did
worse" ambiguous between "worse ordering" and "worse mechanics".

Reuses Phase 1's fixed scenarios (light/typical/heavy) and task-building
(sensitivity_analysis.py, current production constants) unchanged, and its
evaluate_schedule() unchanged, so results are directly comparable to the
Phase 1 report.

Run with:
    venv/Scripts/python ml_scripts/study-planner/scheduler_baselines.py
"""

import copy
import csv
import os
import random
import statistics
import sys
from datetime import date, datetime, timedelta

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
OUTPUTS_DIR = os.path.join(BACKEND_DIR, "ml_scripts", "study-planner", "outputs")

if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from schedule_engine import StudyScheduler, DAY_ORDER  # noqa: E402
from sensitivity_analysis import (  # noqa: E402
    ANCHOR_DATE, SCENARIOS, PROD_THRESHOLDS, PROD_CLAMP, PROD_EXAM_BUDGET_HOURS,
    PROD_EXAM_CURVE, PROD_PERF_MULT, build_assignment_task, build_exam_prep_task,
    evaluate_schedule, section, fmt,
)

RANDOM_SEED = 42
RANDOM_RUNS = 20


# ===========================================================================
# 1. SHARED GREEDY-FILL ENGINE (mirrors StudyScheduler.generate_schedule(),
#    but takes tasks ALREADY IN THE ORDER TO ALLOCATE THEM - the sort step
#    itself is what StudyScheduler normally does internally; every baseline
#    below does that sorting differently and calls this same fill logic).
# ===========================================================================
def _add_minutes(hhmm, minutes):
    t = datetime.strptime(hhmm, "%H:%M") + timedelta(minutes=minutes)
    return t.strftime("%H:%M")


def _slot_date(day_name, anchor_date):
    target_weekday = DAY_ORDER.index(day_name)
    delta_days = (target_weekday - anchor_date.weekday()) % 7
    return anchor_date + timedelta(days=delta_days)


def greedy_fill(ordered_tasks, weekly_free_slots, anchor_date):
    """
    Byte-for-byte the same allocation mechanics as
    StudyScheduler.generate_schedule() (eligible-slot filtering by deadline,
    least-loaded-day -> date -> start_time tiebreak, overload_warning for
    shortfalls) - copied rather than imported because StudyScheduler bakes
    its own priority-then-deadline sort in before this point; here the
    caller has already decided the order.
    """
    remaining_slots = [dict(slot) for slot in weekly_free_slots]
    schedule = {day: [] for day in DAY_ORDER}
    overload_warning = []
    day_load_minutes = {day: 0 for day in DAY_ORDER}

    for task in ordered_tasks:
        deadline = datetime.strptime(task["deadline_date"], "%Y-%m-%d")
        minutes_needed = task["estimated_hours_needed"] * 60

        eligible_slots = [
            s for s in remaining_slots
            if s["duration_minutes"] > 0 and _slot_date(s["day"], anchor_date) <= deadline.date()
        ]
        eligible_slots.sort(key=lambda s: (day_load_minutes[s["day"]], _slot_date(s["day"], anchor_date), s["start_time"]))

        for slot in eligible_slots:
            if minutes_needed <= 0:
                break
            take = min(slot["duration_minutes"], minutes_needed)
            if take <= 0:
                continue
            schedule[slot["day"]].append({
                "time_slot": f"{slot['start_time']}-{_add_minutes(slot['start_time'], take)}",
                "task_id": task["task_id"],
                "module": task["module"],
                "duration_minutes": take,
            })
            slot["start_time"] = _add_minutes(slot["start_time"], take)
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

    for day in schedule:
        schedule[day].sort(key=lambda item: item["time_slot"])

    tasks_registry = {
        t["task_id"]: {
            "module": t["module"], "weight": t["weight"], "priority_label": t["priority_label"],
            "deadline_date": t["deadline_date"], "estimated_hours_needed": t["estimated_hours_needed"],
            "task_type": t.get("task_type", "assignment"),
        }
        for t in ordered_tasks
    }
    return {"schedule": schedule, "overload_warning": overload_warning, "tasks": tasks_registry}


PRIORITY_ORDER = {"High": 0, "Medium": 1, "Low": 2}


# ===========================================================================
# 2. ALGORITHMS
# ===========================================================================
def run_study_scheduler(tasks, weekly_free_slots, anchor_date):
    """The real, unmodified production algorithm - priority tier, then deadline."""
    scheduler = StudyScheduler(weekly_free_slots, anchor_date=anchor_date)
    for t in tasks:
        scheduler.add_task(t)
    return scheduler.generate_schedule()


def run_fcfs(tasks, weekly_free_slots, anchor_date):
    """First-Come-First-Served: allocation order = creation order, exactly as given. No priority, no deadline."""
    return greedy_fill(tasks, weekly_free_slots, anchor_date)


def run_edf(tasks, weekly_free_slots, anchor_date):
    """Earliest-Deadline-First: sort by deadline only, priority label ignored entirely."""
    ordered = sorted(tasks, key=lambda t: t["deadline_date"])
    return greedy_fill(ordered, weekly_free_slots, anchor_date)


def run_random_once(tasks, weekly_free_slots, anchor_date, rng):
    ordered = list(tasks)
    rng.shuffle(ordered)
    return greedy_fill(ordered, weekly_free_slots, anchor_date)


def run_random_averaged(tasks, weekly_free_slots, anchor_date, n_runs=RANDOM_RUNS, seed=RANDOM_SEED):
    """
    Sanity-check lower bound: n_runs independent random orderings, metrics
    averaged (mean + stdev) since a single random run isn't representative.
    """
    rng = random.Random(seed)
    per_run_metrics = []
    for _ in range(n_runs):
        result = run_random_once(tasks, weekly_free_slots, anchor_date, rng)
        per_run_metrics.append(evaluate_schedule(result, anchor_date))

    def agg(key):
        vals = [m[key] for m in per_run_metrics if m[key] is not None]
        if not vals:
            return (None, None)
        mean = statistics.mean(vals)
        stdev = statistics.pstdev(vals) if len(vals) > 1 else 0.0
        return (mean, stdev)

    return {k: agg(k) for k in ["pct_high_priority_scheduled_before_deadline", "avg_lead_time_high_priority",
                                 "daily_load_variance", "overload_total_hours"]}


# ===========================================================================
# 3. BUILD TASKS FOR A SCENARIO (identical to sensitivity_analysis.py, current
#    production constants - not what's being varied in this phase)
# ===========================================================================
def build_tasks_for_scenario(scenario_name):
    sc = SCENARIOS[scenario_name]
    tasks = [build_assignment_task(a, PROD_THRESHOLDS, PROD_CLAMP) for a in sc["assignments"]]
    for e in sc["exams"]:
        t = build_exam_prep_task(e, PROD_THRESHOLDS, PROD_CLAMP, PROD_EXAM_BUDGET_HOURS, PROD_EXAM_CURVE, PROD_PERF_MULT)
        if t:
            tasks.append(t)
    return tasks, sc["free_slots"]


# ===========================================================================
# 4. MAIN COMPARISON
# ===========================================================================
METRIC_KEYS = ["pct_high_priority_scheduled_before_deadline", "avg_lead_time_high_priority",
               "daily_load_variance", "overload_total_hours"]


def main_comparison():
    rows = []
    for scenario_name in SCENARIOS:
        section(f"SCENARIO: {scenario_name}")
        tasks, free_slots = build_tasks_for_scenario(scenario_name)

        results = {
            "StudyScheduler (current)": evaluate_schedule(run_study_scheduler(tasks, free_slots, ANCHOR_DATE), ANCHOR_DATE),
            "FCFS": evaluate_schedule(run_fcfs(tasks, free_slots, ANCHOR_DATE), ANCHOR_DATE),
            "EDF": evaluate_schedule(run_edf(tasks, free_slots, ANCHOR_DATE), ANCHOR_DATE),
        }
        random_agg = run_random_averaged(tasks, free_slots, ANCHOR_DATE)

        for algo_name, metrics in results.items():
            print(f"  {algo_name:26s} " + " ".join(f"{k}={fmt(v)}" for k, v in metrics.items()))
            rows.append({"scenario": scenario_name, "algorithm": algo_name,
                         **{k: fmt(v) for k, v in metrics.items()},
                         **{f"{k}_stdev": "" for k in METRIC_KEYS}})

        random_row = {"scenario": scenario_name, "algorithm": f"Random (mean of {RANDOM_RUNS})"}
        print(f"  {'Random (mean of ' + str(RANDOM_RUNS) + ')':26s}", end=" ")
        for k in METRIC_KEYS:
            mean, stdev = random_agg[k]
            random_row[k] = fmt(mean)
            random_row[f"{k}_stdev"] = fmt(stdev)
            print(f"{k}={fmt(mean)}(+/-{fmt(stdev,2)})", end=" ")
        print()
        rows.append(random_row)

    return rows


# ===========================================================================
# 5. PERTURBATION / STABILITY CHECK (Section 4) - typical scenario only
# ===========================================================================
def perturb_typical_scenario(seed_offset):
    """
    Returns a perturbed copy of the 'typical' scenario's raw definition:
    shifts 1-2 assignment deadlines by +/-1-2 days and scales total free
    time by roughly +/-10%, using a fixed, enumerated (not random-per-call)
    set of small, realistic perturbations so the same 8 variants are used
    for every algorithm - deterministic, not resampled.
    """
    base = copy.deepcopy(SCENARIOS["typical"])
    rng = random.Random(1000 + seed_offset)

    # Shift 1-2 assignment deadlines by +/-1 or +/-2 days.
    n_shift = rng.choice([1, 2])
    targets = rng.sample(base["assignments"], k=min(n_shift, len(base["assignments"])))
    for a in targets:
        delta = rng.choice([-2, -1, 1, 2])
        new_date = date.fromisoformat(a["deadline"]) + timedelta(days=delta)
        a["deadline"] = new_date.isoformat()

    # Scale total free time by a random factor in [-10%, +10%].
    scale = 1.0 + rng.uniform(-0.10, 0.10)
    for slot in base["free_slots"]:
        slot["duration_minutes"] = max(15, round(slot["duration_minutes"] * scale / 15) * 15)
        sh, sm = map(int, slot["start_time"].split(":"))
        end_min = sh * 60 + sm + slot["duration_minutes"]
        slot["end_time"] = f"{end_min // 60:02d}:{end_min % 60:02d}"

    return base


def build_tasks_from_scenario_def(sc):
    tasks = [build_assignment_task(a, PROD_THRESHOLDS, PROD_CLAMP) for a in sc["assignments"]]
    for e in sc["exams"]:
        t = build_exam_prep_task(e, PROD_THRESHOLDS, PROD_CLAMP, PROD_EXAM_BUDGET_HOURS, PROD_EXAM_CURVE, PROD_PERF_MULT)
        if t:
            tasks.append(t)
    return tasks, sc["free_slots"]


def perturbation_check(n_perturbations=8):
    section(f"PERTURBATION / STABILITY CHECK: typical scenario, {n_perturbations} small realistic variants")

    # Determine "best-performing baseline" from the main comparison's typical
    # scenario for the two most important metrics, rather than assuming EDF.
    tasks, free_slots = build_tasks_for_scenario("typical")
    ss_base = evaluate_schedule(run_study_scheduler(tasks, free_slots, ANCHOR_DATE), ANCHOR_DATE)
    fcfs_base = evaluate_schedule(run_fcfs(tasks, free_slots, ANCHOR_DATE), ANCHOR_DATE)
    edf_base = evaluate_schedule(run_edf(tasks, free_slots, ANCHOR_DATE), ANCHOR_DATE)

    def score(m):
        # Higher pct_high and higher lead_time = better; use lead_time as
        # tiebreaker/primary since pct_high is often tied at 1.0 in typical.
        pct = m["pct_high_priority_scheduled_before_deadline"] or 0
        lead = m["avg_lead_time_high_priority"] or 0
        return (pct, lead)

    baselines = {"FCFS": fcfs_base, "EDF": edf_base}
    best_name = max(baselines, key=lambda n: score(baselines[n]))
    print(f"Best-performing baseline on the base typical scenario (by pct_high, then lead_time): {best_name}")
    print(f"  StudyScheduler base: pct_high={fmt(ss_base['pct_high_priority_scheduled_before_deadline'])} lead_time={fmt(ss_base['avg_lead_time_high_priority'])}")
    print(f"  {best_name} base:           pct_high={fmt(baselines[best_name]['pct_high_priority_scheduled_before_deadline'])} lead_time={fmt(baselines[best_name]['avg_lead_time_high_priority'])}")
    best_runner = run_edf if best_name == "EDF" else run_fcfs

    ss_pct, ss_lead, best_pct, best_lead = [], [], [], []
    rows = []
    for i in range(n_perturbations):
        sc = perturb_typical_scenario(i)
        p_tasks, p_free_slots = build_tasks_from_scenario_def(sc)

        ss_m = evaluate_schedule(run_study_scheduler(p_tasks, p_free_slots, ANCHOR_DATE), ANCHOR_DATE)
        best_m = evaluate_schedule(best_runner(p_tasks, p_free_slots, ANCHOR_DATE), ANCHOR_DATE)

        if ss_m["pct_high_priority_scheduled_before_deadline"] is not None:
            ss_pct.append(ss_m["pct_high_priority_scheduled_before_deadline"])
        if ss_m["avg_lead_time_high_priority"] is not None:
            ss_lead.append(ss_m["avg_lead_time_high_priority"])
        if best_m["pct_high_priority_scheduled_before_deadline"] is not None:
            best_pct.append(best_m["pct_high_priority_scheduled_before_deadline"])
        if best_m["avg_lead_time_high_priority"] is not None:
            best_lead.append(best_m["avg_lead_time_high_priority"])

        print(f"  variant {i}: StudyScheduler pct_high={fmt(ss_m['pct_high_priority_scheduled_before_deadline'])} "
              f"lead={fmt(ss_m['avg_lead_time_high_priority'])}  |  {best_name} pct_high={fmt(best_m['pct_high_priority_scheduled_before_deadline'])} "
              f"lead={fmt(best_m['avg_lead_time_high_priority'])}")
        rows.append({
            "variant": i,
            "StudyScheduler_pct_high": fmt(ss_m["pct_high_priority_scheduled_before_deadline"]),
            "StudyScheduler_lead_time": fmt(ss_m["avg_lead_time_high_priority"]),
            f"{best_name}_pct_high": fmt(best_m["pct_high_priority_scheduled_before_deadline"]),
            f"{best_name}_lead_time": fmt(best_m["avg_lead_time_high_priority"]),
        })

    def mean_sd(vals):
        if not vals:
            return (None, None)
        return (statistics.mean(vals), statistics.pstdev(vals) if len(vals) > 1 else 0.0)

    ss_pct_mean, ss_pct_sd = mean_sd(ss_pct)
    ss_lead_mean, ss_lead_sd = mean_sd(ss_lead)
    best_pct_mean, best_pct_sd = mean_sd(best_pct)
    best_lead_mean, best_lead_sd = mean_sd(best_lead)

    print()
    print(f"Across {n_perturbations} perturbations:")
    print(f"  StudyScheduler: pct_high mean={fmt(ss_pct_mean)} (sd={fmt(ss_pct_sd)}), lead_time mean={fmt(ss_lead_mean)} (sd={fmt(ss_lead_sd)})")
    print(f"  {best_name}:           pct_high mean={fmt(best_pct_mean)} (sd={fmt(best_pct_sd)}), lead_time mean={fmt(best_lead_mean)} (sd={fmt(best_lead_sd)})")

    return rows, best_name, {
        "ss_pct_mean": ss_pct_mean, "ss_pct_sd": ss_pct_sd, "ss_lead_mean": ss_lead_mean, "ss_lead_sd": ss_lead_sd,
        "best_pct_mean": best_pct_mean, "best_pct_sd": best_pct_sd, "best_lead_mean": best_lead_mean, "best_lead_sd": best_lead_sd,
    }


if __name__ == "__main__":
    comparison_rows = main_comparison()

    csv_path = os.path.join(OUTPUTS_DIR, "scheduler_baseline_comparison.csv")
    fieldnames = ["scenario", "algorithm"] + METRIC_KEYS + [f"{k}_stdev" for k in METRIC_KEYS]
    with open(csv_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(comparison_rows)
    print(f"\nSaved {len(comparison_rows)} rows to {csv_path}")

    perturb_rows, best_baseline_name, perturb_summary = perturbation_check()

    perturb_csv_path = os.path.join(OUTPUTS_DIR, "scheduler_baseline_perturbation_check.csv")
    with open(perturb_csv_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(perturb_rows[0].keys()))
        writer.writeheader()
        writer.writerows(perturb_rows)
    print(f"Saved {len(perturb_rows)} rows to {perturb_csv_path}")

    print(f"\nBest baseline for perturbation check was: {best_baseline_name}")
    print(f"Summary: {perturb_summary}")
