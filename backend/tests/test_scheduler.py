"""
Regression tests for StudyScheduler (schedule_engine.py) - Sections 8/8c.
"""
from datetime import date

import pytest

from schedule_engine import StudyScheduler


def _free_slots(hours_per_day=3, days=("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")):
    return [
        {"day": d, "start_time": "17:00", "end_time": f"{17 + hours_per_day:02d}:00", "duration_minutes": hours_per_day * 60}
        for d in days
    ]


class TestNeverSilentlyDropsATask:
    def test_every_task_appears_in_schedule_or_overload_warning(self):
        scheduler = StudyScheduler(_free_slots(2), anchor_date=date(2026, 8, 29))
        tasks = [
            {"task_id": "t1", "module": "AAA", "deadline_date": "2026-08-31", "weight": 20,
             "priority_label": "High", "estimated_hours_needed": 3},
            {"task_id": "t2", "module": "BBB", "deadline_date": "2026-09-05", "weight": 15,
             "priority_label": "Medium", "estimated_hours_needed": 4},
            {"task_id": "t3", "module": "CCC", "deadline_date": "2026-09-01", "weight": 10,
             "priority_label": "Low", "estimated_hours_needed": 10},  # deliberately more than capacity allows
        ]
        for t in tasks:
            scheduler.add_task(t)
        result = scheduler.generate_schedule()

        scheduled_task_ids = {item["task_id"] for items in result["schedule"].values() for item in items}
        overloaded_task_ids = {w["task_id"] for w in result["overload_warning"]}

        for t in tasks:
            fully_or_partially_scheduled = t["task_id"] in scheduled_task_ids
            flagged_as_short = t["task_id"] in overloaded_task_ids
            assert fully_or_partially_scheduled or flagged_as_short, (
                f"Task {t['task_id']} vanished silently - not in schedule AND not in overload_warning."
            )

    def test_task_registry_includes_every_added_task(self):
        scheduler = StudyScheduler(_free_slots(3), anchor_date=date(2026, 8, 29))
        task_ids = [f"t{i}" for i in range(5)]
        for i, tid in enumerate(task_ids):
            scheduler.add_task({
                "task_id": tid, "module": "AAA", "deadline_date": "2026-09-10", "weight": 10,
                "priority_label": "Medium", "estimated_hours_needed": 1,
            })
        result = scheduler.generate_schedule()
        assert set(result["tasks"].keys()) == set(task_ids)


class TestTaskRegistryIncludesWeight:
    """
    Regression test for a real bug: the tasks registry originally omitted
    `weight`, which broke reschedule()'s ability to round-trip a task
    straight back into add_task() across stateless HTTP requests (add_task
    requires `weight` - see schedule_engine.py's required-fields check).
    """

    def test_every_registry_entry_has_weight(self):
        scheduler = StudyScheduler(_free_slots(3), anchor_date=date(2026, 8, 29))
        scheduler.add_task({
            "task_id": "t1", "module": "AAA", "deadline_date": "2026-09-10", "weight": 27,
            "priority_label": "High", "estimated_hours_needed": 2,
        })
        result = scheduler.generate_schedule()
        assert result["tasks"]["t1"]["weight"] == 27

    def test_registry_entries_round_trip_directly_back_into_add_task(self):
        """The actual real-world usage this bug broke: schedule_service.reschedule()
        reconstructing a scheduler from a previous response's task registry."""
        scheduler = StudyScheduler(_free_slots(3), anchor_date=date(2026, 8, 29))
        scheduler.add_task({
            "task_id": "t1", "module": "AAA", "deadline_date": "2026-09-10", "weight": 27,
            "priority_label": "High", "estimated_hours_needed": 2,
        })
        result = scheduler.generate_schedule()

        # Simulate reconstructing a fresh scheduler purely from the registry,
        # exactly as schedule_service.reschedule() does.
        fresh_scheduler = StudyScheduler(_free_slots(3), anchor_date=date(2026, 8, 29))
        for task_id, info in result["tasks"].items():
            fresh_scheduler.add_task({"task_id": task_id, **info})  # must not raise ValueError
        assert fresh_scheduler.tasks[0]["weight"] == 27


class TestReschedule:
    def test_removes_completed_task_ids(self):
        scheduler = StudyScheduler(_free_slots(3), anchor_date=date(2026, 8, 29))
        scheduler.add_task({"task_id": "t1", "module": "AAA", "deadline_date": "2026-09-10", "weight": 10,
                             "priority_label": "High", "estimated_hours_needed": 2})
        scheduler.add_task({"task_id": "t2", "module": "BBB", "deadline_date": "2026-09-10", "weight": 10,
                             "priority_label": "Medium", "estimated_hours_needed": 2})
        scheduler.generate_schedule()

        result = scheduler.reschedule(completed_task_ids=["t1"], new_tasks=[])
        assert "t1" not in result["tasks"]
        assert "t2" in result["tasks"]

    def test_incorporates_new_tasks_using_only_remaining_capacity(self):
        # Exactly 3h/day * 2 days = 6h capacity by the deadline; task uses all of it.
        scheduler = StudyScheduler(_free_slots(3, days=("Monday", "Tuesday")), anchor_date=date(2026, 8, 31))  # Monday
        scheduler.add_task({"task_id": "t1", "module": "AAA", "deadline_date": "2026-09-01", "weight": 10,
                             "priority_label": "High", "estimated_hours_needed": 6})
        first = scheduler.generate_schedule()
        assert first["overload_warning"] == []  # fully consumes the 6h capacity

        # A new task arriving now has ZERO remaining capacity before the same deadline.
        result = scheduler.reschedule(completed_task_ids=[], new_tasks=[
            {"task_id": "t2", "module": "BBB", "deadline_date": "2026-09-01", "weight": 10,
             "priority_label": "High", "estimated_hours_needed": 2},
        ])
        overloaded_ids = {w["task_id"] for w in result["overload_warning"]}
        assert "t2" in overloaded_ids, "New task should be flagged short - no remaining capacity was available."


class TestTypicalScenarioRegression:
    """
    Lightweight regression test capturing Phase 2's verified finding: on the
    documented `typical` scenario, StudyScheduler achieves
    pct_high_priority_scheduled_before_deadline == 1.0. A future algorithm
    change that regresses this already-verified property should fail here.
    """

    def test_typical_scenario_fully_schedules_all_high_priority_tasks(self, build_scenario_tasks):
        from sensitivity_analysis import ANCHOR_DATE, evaluate_schedule

        tasks, free_slots = build_scenario_tasks("typical")
        scheduler = StudyScheduler(free_slots, anchor_date=ANCHOR_DATE)
        for t in tasks:
            scheduler.add_task(t)
        result = scheduler.generate_schedule()

        metrics = evaluate_schedule(result, ANCHOR_DATE)
        assert metrics["pct_high_priority_scheduled_before_deadline"] == pytest.approx(1.0), (
            "REGRESSION: the typical scenario used to fully schedule 100% of High-priority tasks "
            "(Phase 2 finding) - this no longer holds."
        )
