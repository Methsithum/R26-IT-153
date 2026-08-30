"""
Regression tests for the rolling multi-week scheduler (PROJECT CONTEXT.md
Section 8d) - generate_rolling_schedule() in schedule_engine.py.
"""
from datetime import date, datetime, timedelta

import pytest

from schedule_engine import StudyScheduler, generate_rolling_schedule, MAX_WEEKS_AHEAD, DAY_ORDER, resolve_day_date
from sensitivity_analysis import (
    compute_base_tier_level,
    compute_exam_prep_hours_for_day,
    PROD_EXAM_CURVE,
    PROD_THRESHOLDS,
    LABELS,
)


def _free_slots(hours_per_day=2, days=DAY_ORDER):
    return [
        {"day": d, "start_time": "18:00", "end_time": f"{18 + hours_per_day:02d}:00", "duration_minutes": hours_per_day * 60}
        for d in days
    ]


def _total_scheduled_hours(schedule_by_date, task_id):
    minutes = sum(
        item["duration_minutes"]
        for items in schedule_by_date.values()
        for item in items
        if item["task_id"] == task_id
    )
    return minutes / 60


class TestBacklogCarryoverCorrectness:
    """A task needing more hours than fit in one week must have its
    remaining hours carried into later weeks with no duplication or loss -
    total hours scheduled across all weeks must sum exactly to
    estimated_hours_needed (Section 4c / Section 5)."""

    def test_a_task_too_big_for_one_week_carries_into_the_next(self):
        anchor = date(2026, 8, 31)  # Monday
        free_slots = _free_slots(2)  # 14h/week capacity
        tasks = [
            {"task_id": "big", "module": "AAA", "deadline_date": "2026-09-20", "weight": 20,
             "priority_label": "High", "estimated_hours_needed": 20},  # needs > 1 week's 14h capacity
        ]
        result = generate_rolling_schedule(free_slots, tasks, anchor_date=anchor)

        total = _total_scheduled_hours(result["schedule"], "big")
        assert total == pytest.approx(20.0), (
            f"Expected all 20h to be scheduled across weeks (no loss/duplication), got {total}h"
        )
        assert len(result["tasks"]["big"]["weeks_allocated"]) >= 2, "Should have spanned at least 2 weeks (20h > 14h/week capacity)"
        assert result["overload_warning"] == [], "Task should fully fit given enough weeks before its deadline"

    def test_no_duplication_across_weeks_for_a_task_split_three_ways(self):
        anchor = date(2026, 8, 31)
        free_slots = _free_slots(1)  # 7h/week capacity - forces a 3-week split for a 20h task
        tasks = [
            {"task_id": "t1", "module": "AAA", "deadline_date": "2026-09-25", "weight": 20,
             "priority_label": "High", "estimated_hours_needed": 20},
        ]
        result = generate_rolling_schedule(free_slots, tasks, anchor_date=anchor)
        total = _total_scheduled_hours(result["schedule"], "t1")
        assert total == pytest.approx(20.0)
        # No single day should carry more than one day's real capacity (1h) for this task -
        # a duplication bug would double-book the same slot.
        for day_items in result["schedule"].values():
            day_minutes_for_t1 = sum(i["duration_minutes"] for i in day_items if i["task_id"] == "t1")
            assert day_minutes_for_t1 <= 60, f"A single day scheduled {day_minutes_for_t1} min for t1 - exceeds the 1h/day free capacity, suggests duplication."

    def test_shortfall_reported_exactly_once_in_the_deadline_week_not_every_week(self):
        anchor = date(2026, 8, 31)
        free_slots = _free_slots(1)  # scarce - 7h/week
        tasks = [
            {"task_id": "t1", "module": "AAA", "deadline_date": "2026-09-27", "weight": 20,  # 4 weeks out
             "priority_label": "High", "estimated_hours_needed": 100},  # impossible to ever fully fit
        ]
        result = generate_rolling_schedule(free_slots, tasks, anchor_date=anchor)
        matching = [w for w in result["overload_warning"] if w["task_id"] == "t1"]
        assert len(matching) == 1, f"Expected exactly one overload_warning entry for t1, got {len(matching)}"
        assert matching[0]["deadline_date"] == "2026-09-27"


class TestCurrentWeekRegressionCheck:
    """Section 4a: the current (first) week's actual session placements must
    exactly match what a plain single-week StudyScheduler.generate_schedule()
    call would have produced for the same tasks/slots - the rolling wrapper
    must not change week-0 behavior."""

    def test_week_0_placements_match_plain_single_week_scheduler(self):
        anchor = date(2026, 8, 31)
        free_slots = _free_slots(3)
        tasks = [
            {"task_id": "t1", "module": "AAA", "deadline_date": "2026-09-05", "weight": 20,
             "priority_label": "High", "estimated_hours_needed": 4},
            {"task_id": "t2", "module": "BBB", "deadline_date": "2026-09-04", "weight": 10,
             "priority_label": "Medium", "estimated_hours_needed": 3},
        ]

        rolling_result = generate_rolling_schedule(free_slots, tasks, anchor_date=anchor, weeks_ahead=1)

        single_scheduler = StudyScheduler(free_slots, anchor_date=anchor)
        for t in tasks:
            single_scheduler.add_task(dict(t))
        single_result = single_scheduler.generate_schedule()

        # Re-key the single-week (weekday-named) result onto real dates the
        # same way the rolling wrapper does, then compare directly.
        from schedule_engine import resolve_day_date
        single_by_date = {}
        for day_name, items in single_result["schedule"].items():
            if items:
                single_by_date[resolve_day_date(day_name, anchor).isoformat()] = items

        rolling_by_date = {d: items for d, items in rolling_result["schedule"].items() if items}

        assert rolling_by_date == single_by_date, (
            "Week 0 of the rolling schedule does not match plain single-week StudyScheduler output - "
            "the multi-week extension changed current-week behavior."
        )
        # With weeks_ahead=1 forced, overload reporting should also match exactly
        # (no future weeks exist to defer shortfalls into).
        assert {w["task_id"] for w in rolling_result["overload_warning"]} == {w["task_id"] for w in single_result["overload_warning"]}


class TestMaxWeeksAheadCap:
    def test_caps_at_max_weeks_even_with_a_very_far_deadline(self):
        anchor = date(2026, 8, 31)
        free_slots = _free_slots(2)
        tasks = [
            {"task_id": "t1", "module": "AAA", "deadline_date": "2028-01-01", "weight": 20,  # over a year out
             "priority_label": "Low", "estimated_hours_needed": 2},
        ]
        result = generate_rolling_schedule(free_slots, tasks, anchor_date=anchor)
        assert result["weeks_generated"] == MAX_WEEKS_AHEAD

    def test_explicit_weeks_ahead_is_also_capped(self):
        anchor = date(2026, 8, 31)
        result = generate_rolling_schedule(_free_slots(2), [], anchor_date=anchor, weeks_ahead=999)
        assert result["weeks_generated"] == MAX_WEEKS_AHEAD

    def test_range_end_matches_weeks_generated(self):
        anchor = date(2026, 8, 31)
        result = generate_rolling_schedule(_free_slots(2), [], anchor_date=anchor, weeks_ahead=3)
        assert result["weeks_generated"] == 3
        assert result["range_start"] == "2026-08-31"
        assert result["range_end"] == "2026-09-20"  # 3*7 - 1 = 20 days after anchor
        assert len(result["schedule"]) == 21  # every day in the 3-week range present as a key

    def test_empty_task_list_still_generates_one_week(self):
        result = generate_rolling_schedule(_free_slots(2), [], anchor_date=date(2026, 8, 31))
        assert result["weeks_generated"] == 1


class TestExamPrepEscalationAcrossWeeks:
    """
    Exam-prep escalation (Section 8a) is computed client-side per week (one
    task per (exam, week) pair - see PROJECT CONTEXT.md Section 8d), so the
    backend's job is simply to apply the SAME generic backlog-carryover
    logic to those chunks as any other task. This test simulates that
    calling pattern: a light week-0 chunk and a heavier week-1 chunk for the
    same exam, confirming both get scheduled appropriately and week-1's
    chunk is not starved by week-0's leftover.
    """

    def test_later_heavier_exam_prep_chunk_still_gets_scheduled(self):
        anchor = date(2026, 8, 31)
        free_slots = _free_slots(3)  # 21h/week - generous
        tasks = [
            {"task_id": "exam-1-w0", "module": "AAA", "deadline_date": "2026-09-14", "weight": 100,
             "priority_label": "Medium", "estimated_hours_needed": 2, "task_type": "exam"},  # light, week 0
            {"task_id": "exam-1-w1", "module": "AAA", "deadline_date": "2026-09-14", "weight": 100,
             "priority_label": "High", "estimated_hours_needed": 6, "task_type": "exam"},  # heavier, closer to exam
        ]
        result = generate_rolling_schedule(free_slots, tasks, anchor_date=anchor, weeks_ahead=3)

        assert _total_scheduled_hours(result["schedule"], "exam-1-w0") == pytest.approx(2.0)
        assert _total_scheduled_hours(result["schedule"], "exam-1-w1") == pytest.approx(6.0)
        assert result["overload_warning"] == []


# ===========================================================================
# Part A: full-correctness verification over a realistic 3+ week horizon
# ===========================================================================
_SCENARIO_ANCHOR = date(2026, 8, 31)  # Monday, arbitrary fixed date for reproducibility
_SCENARIO_WEEKS_AHEAD = 4
_SCENARIO_HOURS_PER_DAY = 1.5  # 90 min/day = 10.5h/week - deliberately scarce (see class docstring)


def _build_exam_prep_chunks(exam_id, module, exam_date_iso, anchor, total_budget_hours, weeks_ahead):
    """
    Standalone Python re-implementation of buildMultiWeekExamPrepTasks()
    (frontend/src/utils/examPrepScheduling.js) using the ALREADY-PORTED,
    already-tested curve math in sensitivity_analysis.py (compute_exam_prep_hours_for_day,
    PROD_EXAM_CURVE) - not a third reimplementation of the curve itself, just
    the per-week chunking loop around it, for building a realistic multi-week
    exam-prep task list in a backend-only test (no frontend/JS involved).
    One priority_label is computed once for the whole exam (matching real
    examPrepScheduling.js behavior - only the HOURS escalate per week, not
    the priority tier).
    """
    exam_date = datetime.strptime(exam_date_iso, "%Y-%m-%d").date()
    exam_days = (exam_date - anchor).days
    if exam_days < 0:
        return []

    priority_level = compute_base_tier_level(exam_days, "exam", PROD_THRESHOLDS)
    priority_label = LABELS[priority_level]

    last_relevant_week = min(exam_days // 7, weeks_ahead - 1)
    chunks = []
    for week_idx in range(last_relevant_week + 1):
        window_start = week_idx * 7
        window_end = min(exam_days, window_start + 6)
        if window_end < window_start:
            continue
        hours = sum(
            compute_exam_prep_hours_for_day(exam_days, d, total_budget_hours, PROD_EXAM_CURVE)
            for d in range(window_start, window_end + 1)
        )
        hours = round(hours * 4) / 4  # nearest 15 minutes, matching the JS builder
        if hours <= 0:
            continue
        chunks.append({
            "task_id": f"exam-{exam_id}-w{week_idx}",
            "module": module,
            "deadline_date": exam_date_iso,
            "weight": 100,
            "priority_label": priority_label,
            "estimated_hours_needed": hours,
            "task_type": "exam",
        })
    return chunks


def _free_slots_fractional(hours_per_day, days=DAY_ORDER):
    """Like _free_slots() but supports a fractional hours-per-day (e.g. 1.5h),
    computing duration_minutes directly instead of formatting an end_time
    string (which only supports whole hours)."""
    minutes = round(hours_per_day * 60)
    return [
        {"day": d, "start_time": "18:00", "end_time": "20:00", "duration_minutes": minutes}
        for d in days
    ]


def _build_three_week_scenario():
    """
    A realistic mix spanning 4 weeks: 4 assignments (this week / week 2 /
    week 3 / week 4, varied priority) + 2 exams inside the 2-3 week range
    (a "mid" and a "final", different budgets) with real, curve-computed
    per-week chunks - plus deliberately scarce free time (10.5h/week over 4
    weeks = 42h capacity vs. ~51.6h total demand) so a genuine shortfall is
    guaranteed, exercising the overload-correctness check for real rather
    than only the happy path.
    """
    anchor = _SCENARIO_ANCHOR
    free_slots = _free_slots_fractional(_SCENARIO_HOURS_PER_DAY)

    assignments = [
        {"task_id": "a1-this-week", "module": "AAA", "deadline_date": (anchor + timedelta(days=2)).isoformat(),
         "weight": 25, "priority_label": "High", "estimated_hours_needed": 3},
        {"task_id": "a2-week2", "module": "BBB", "deadline_date": (anchor + timedelta(days=9)).isoformat(),
         "weight": 15, "priority_label": "Medium", "estimated_hours_needed": 5},
        {"task_id": "a3-week3", "module": "CCC", "deadline_date": (anchor + timedelta(days=16)).isoformat(),
         "weight": 10, "priority_label": "Medium", "estimated_hours_needed": 6},
        {"task_id": "a4-week4", "module": "DDD", "deadline_date": (anchor + timedelta(days=23)).isoformat(),
         "weight": 5, "priority_label": "Low", "estimated_hours_needed": 10},
    ]

    exam_chunks_e1 = _build_exam_prep_chunks("mid1", "EEE", (anchor + timedelta(days=13)).isoformat(), anchor, 12.0, _SCENARIO_WEEKS_AHEAD)
    exam_chunks_e2 = _build_exam_prep_chunks("final1", "FFF", (anchor + timedelta(days=20)).isoformat(), anchor, 15.6, _SCENARIO_WEEKS_AHEAD)

    all_tasks = assignments + exam_chunks_e1 + exam_chunks_e2
    result = generate_rolling_schedule(free_slots, all_tasks, anchor_date=anchor, weeks_ahead=_SCENARIO_WEEKS_AHEAD)
    return result, all_tasks, exam_chunks_e1, exam_chunks_e2, free_slots


@pytest.fixture(scope="module")
def three_week_scenario():
    return _build_three_week_scenario()


def _week_index_for_date(date_iso, anchor):
    d = datetime.strptime(date_iso, "%Y-%m-%d").date()
    return (d - anchor).days // 7


class TestThreeWeekHorizonFullCorrectness:
    """
    Part A: rigorous, non-visual verification of the rolling scheduler over
    a realistic 4-week scenario (4 assignments across weeks 1-4, 2 exams
    with real curve-computed multi-week chunks, deliberately scarce free
    time so a genuine overload is guaranteed) - every check is a real
    assertion on the actual numbers, not a visual inspection.
    """

    def test_1_completeness_no_task_silently_loses_hours(self, three_week_scenario):
        """Scheduled hours + overload-reported hours must sum EXACTLY to
        estimated_hours_needed for every task - if this fails, some hours
        vanished from both the schedule AND the warning (silent data loss)."""
        result, all_tasks, *_ = three_week_scenario
        overload_by_task = {w["task_id"]: w["hours_short"] for w in result["overload_warning"]}

        for task in all_tasks:
            tid = task["task_id"]
            scheduled = _total_scheduled_hours(result["schedule"], tid)
            shortfall = overload_by_task.get(tid, 0.0)
            accounted_for = scheduled + shortfall
            assert accounted_for == pytest.approx(task["estimated_hours_needed"], abs=0.01), (
                f"Task {tid}: scheduled={scheduled}h + overload={shortfall}h = {accounted_for}h, "
                f"but needed {task['estimated_hours_needed']}h - hours went missing."
            )

    def test_2_no_double_allocation(self, three_week_scenario):
        """No task's total scheduled hours may exceed what it actually needed."""
        result, all_tasks, *_ = three_week_scenario
        for task in all_tasks:
            tid = task["task_id"]
            scheduled = _total_scheduled_hours(result["schedule"], tid)
            assert scheduled <= task["estimated_hours_needed"] + 0.01, (
                f"Task {tid}: over-allocated {scheduled}h against a need of {task['estimated_hours_needed']}h."
            )

    def test_3_deadline_respect_no_task_scheduled_after_its_deadline(self, three_week_scenario):
        result, all_tasks, *_ = three_week_scenario
        deadline_by_task = {t["task_id"]: t["deadline_date"] for t in all_tasks}
        for date_str, items in result["schedule"].items():
            for item in items:
                deadline = deadline_by_task.get(item["task_id"])
                assert deadline is not None, f"Scheduled item for unknown task {item['task_id']}"
                assert date_str <= deadline, (
                    f"Task {item['task_id']} was scheduled on {date_str}, AFTER its deadline {deadline}."
                )

    def test_4_exam_escalation_is_non_decreasing_across_week_boundaries(self, three_week_scenario):
        """
        For each exam, total REAL per-week hours (aggregated by actual
        scheduled date, not by which chunk task_id nominally "belongs" to a
        week - backlog carryover can shift a chunk's hours into a later
        real week than it was built for) must never decrease week over
        week, consistent with the documented escalation curve. This is
        specifically checking the interaction between carryover and
        escalation across week BOUNDARIES, the case most likely to hide a bug.
        """
        result, all_tasks, exam_chunks_e1, exam_chunks_e2, _ = three_week_scenario
        anchor = _SCENARIO_ANCHOR

        for exam_label, chunks in [("mid1", exam_chunks_e1), ("final1", exam_chunks_e2)]:
            chunk_ids = {c["task_id"] for c in chunks}
            hours_per_week = {}
            for date_str, items in result["schedule"].items():
                week_idx = _week_index_for_date(date_str, anchor)
                for item in items:
                    if item["task_id"] in chunk_ids:
                        hours_per_week[week_idx] = hours_per_week.get(week_idx, 0.0) + item["duration_minutes"] / 60

            weeks_sorted = sorted(hours_per_week)
            assert len(weeks_sorted) >= 1, f"Exam {exam_label} got zero hours scheduled anywhere - can't verify escalation."
            sequence = [hours_per_week[w] for w in weeks_sorted]
            for i in range(1, len(sequence)):
                assert sequence[i] >= sequence[i - 1] - 0.01, (
                    f"Exam {exam_label}: hours DECREASED from week {weeks_sorted[i-1]} ({sequence[i-1]}h) "
                    f"to week {weeks_sorted[i]} ({sequence[i]}h) - escalation should be non-decreasing."
                )

    def test_5_overload_only_fires_when_the_affected_week_was_genuinely_full(self, three_week_scenario):
        """
        Cross-checks every overload_warning entry: the capacity actually
        AVAILABLE to that task before its own deadline (i.e. every day from
        its deadline week's start up to and including the deadline date
        itself - the same eligible-slots window StudyScheduler._slot_date
        enforces; days AFTER the deadline are never eligible for this task,
        so they must not count toward its "was there room" capacity) must
        have been essentially fully consumed (by this task and/or any other
        tasks competing for the same days) - if meaningful capacity was left
        idle within that window while the task was still reported short,
        that's a bug (a task got dropped/misrouted), not genuine scarcity.
        """
        result, all_tasks, _, _, free_slots = three_week_scenario
        anchor = _SCENARIO_ANCHOR
        # Recurring weekly capacity per real weekday name (e.g. "Monday" -> 90).
        capacity_by_weekday = {}
        for s in free_slots:
            capacity_by_weekday[s["day"]] = capacity_by_weekday.get(s["day"], 0) + s["duration_minutes"]

        assert result["overload_warning"], (
            "Scenario is expected to produce at least one genuine overload (scarce free time by design) "
            "- none occurred, check scenario numbers."
        )

        for w in result["overload_warning"]:
            week_idx = _week_index_for_date(w["deadline_date"], anchor)
            week_start = anchor + timedelta(days=7 * week_idx)
            deadline = datetime.strptime(w["deadline_date"], "%Y-%m-%d").date()
            # Every real date from the start of the task's deadline week up
            # to (and including) the deadline itself - the exact window
            # StudyScheduler considers eligible for this task.
            eligible_dates = []
            d = week_start
            while d <= deadline:
                eligible_dates.append(d)
                d += timedelta(days=1)

            available_minutes = sum(capacity_by_weekday.get(d.strftime("%A"), 0) for d in eligible_dates)
            used_minutes = sum(
                item["duration_minutes"]
                for date_str, items in result["schedule"].items()
                if date.fromisoformat(date_str) in eligible_dates
                for item in items
            )
            # Allow a small slack (< 15 min) for a window whose last few
            # minutes of capacity couldn't fit any remaining task's minimum grain.
            assert used_minutes >= available_minutes - 15, (
                f"Task {w['task_id']} (deadline {w['deadline_date']}) was reported {w['hours_short']}h short, "
                f"but only {used_minutes} of {available_minutes} minutes available to it (days "
                f"{eligible_dates[0]}..{eligible_dates[-1]}) were actually used - capacity was left idle, "
                f"suggesting a bug rather than genuine scarcity."
            )
