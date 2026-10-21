"""Tests for the permission-first missed-session flow"""
from datetime import date

from app.services.study_planner.session_service import (
    build_suggestions,
    is_slot_still_free,
    reschedule_options,
    week_bounds,
)
from schedule_engine import StudyScheduler, apply_blocked_slots, generate_rolling_schedule

# Wednesday 2026-10-14; this week = Mon 12 .. Sun 18, next week = Mon 19 .. Sun 25.
WEDNESDAY = date(2026, 10, 14)
EVENINGS = [
    {"day": d, "start_time": "18:00", "end_time": "20:00", "duration_minutes": 120}
    for d in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
]
NOON = 12 * 60


def _suggest(which, deadline, duration=90, occupied=None, now=NOON):
    return build_suggestions(EVENINGS, occupied or {}, which, deadline, duration, WEDNESDAY, now)


class TestWeekBounds:
    def test_this_week_runs_from_today_to_sunday(self):
        assert week_bounds("this", WEDNESDAY) == (date(2026, 10, 14), date(2026, 10, 18))

    def test_next_week_is_next_monday_to_sunday(self):
        assert week_bounds("next", WEDNESDAY) == (date(2026, 10, 19), date(2026, 10, 25))


class TestRescheduleOptions:
    def test_far_deadline_allows_both_weeks(self):
        assert reschedule_options(date(2026, 10, 30), WEDNESDAY) == {
            "expired": False, "can_use_this_week": True, "can_use_next_week": True,
        }

    def test_deadline_this_week_blocks_next_week(self):
        opts = reschedule_options(date(2026, 10, 17), WEDNESDAY)
        assert opts["can_use_this_week"] and not opts["can_use_next_week"]

    def test_passed_deadline_allows_nothing(self):
        opts = reschedule_options(date(2026, 10, 13), WEDNESDAY)
        assert opts == {"expired": True, "can_use_this_week": False, "can_use_next_week": False}


class TestBuildSuggestions:
    def test_every_suggestion_is_on_or_before_the_deadline(self):
        result = _suggest("this", date(2026, 10, 16))
        assert [s["date"] for s in result["suggestions"]] == ["2026-10-14", "2026-10-15", "2026-10-16"]
        assert result["suggestions"][0]["recommended"] is True
        assert all(s["fits"] and s["time_slot"] == "18:00-19:30" for s in result["suggestions"])

    def test_next_week_refused_when_deadline_is_this_week(self):
        result = _suggest("next", date(2026, 10, 17))
        assert result["suggestions"] == [] and result["warning"] == "deadline_before_next_week"

    def test_next_week_cut_at_deadline(self):
        result = _suggest("next", date(2026, 10, 20))
        assert [s["date"] for s in result["suggestions"]] == ["2026-10-19", "2026-10-20"]

    def test_expired_deadline(self):
        assert _suggest("this", date(2026, 10, 1))["warning"] == "deadline_passed"

    def test_occupied_time_is_skipped(self):
        result = _suggest("this", date(2026, 10, 14), occupied={"2026-10-14": ["18:00-19:00"]}, duration=60)
        assert [s["time_slot"] for s in result["suggestions"]] == ["19:00-20:00"]

    def test_todays_past_time_is_not_offered(self):
        result = _suggest("this", date(2026, 10, 15), now=19 * 60)
        assert [s["date"] for s in result["suggestions"]] == ["2026-10-15"]

    def test_falls_back_to_partial_slots_only_when_nothing_fits(self):
        result = _suggest("this", date(2026, 10, 15), duration=180)
        assert result["warning"] == "only_partial_slots"
        assert all(not s["fits"] and s["duration_minutes"] == 120 for s in result["suggestions"])

    def test_no_free_time_at_all(self):
        occupied = {"2026-10-14": ["18:00-20:00"]}
        result = _suggest("this", date(2026, 10, 14), occupied=occupied)
        assert result["suggestions"] == [] and result["warning"] == "no_slot_before_deadline"


class TestIsSlotStillFree:
    def _check(self, target_date, time_slot, occupied=None, deadline=date(2026, 10, 30), which="this"):
        return is_slot_still_free(EVENINGS, occupied or {}, which, deadline, target_date, time_slot, WEDNESDAY, NOON)

    def test_free_slot_accepted(self):
        assert self._check("2026-10-15", "18:00-19:30")

    def test_slot_taken_after_suggesting_is_rejected(self):
        assert not self._check("2026-10-15", "18:00-19:30", occupied={"2026-10-15": ["19:00-20:00"]})

    def test_slot_after_deadline_rejected(self):
        assert not self._check("2026-10-16", "18:00-19:30", deadline=date(2026, 10, 15))

    def test_slot_outside_chosen_week_rejected(self):
        assert not self._check("2026-10-20", "18:00-19:30", which="this")

    def test_slot_outside_free_time_rejected(self):
        assert not self._check("2026-10-15", "21:00-22:00")


class TestBlockedSlots:
    def test_block_splits_only_its_own_real_date(self):
        blocked = [{"date": "2026-10-15", "start_time": "18:30", "end_time": "19:00"}]
        slots = apply_blocked_slots(EVENINGS, blocked, WEDNESDAY)
        thursday = [s for s in slots if s["day"] == "Thursday"]
        assert [(s["start_time"], s["end_time"], s["duration_minutes"]) for s in thursday] == [
            ("18:00", "18:30", 30), ("19:00", "20:00", 60),
        ]
        assert [s for s in slots if s["day"] == "Friday"][0]["duration_minutes"] == 120

    def test_block_outside_window_is_ignored(self):
        blocked = [{"date": "2026-11-30", "start_time": "18:00", "end_time": "20:00"}]
        assert apply_blocked_slots(EVENINGS, blocked, WEDNESDAY) == EVENINGS

    def test_scheduler_never_uses_a_blocked_slot(self):
        blocked = [{"date": "2026-10-14", "start_time": "18:00", "end_time": "20:00"}]
        scheduler = StudyScheduler(EVENINGS, anchor_date=WEDNESDAY, blocked_slots=blocked)
        scheduler.add_task({
            "task_id": "t1", "module": "M", "deadline_date": "2026-10-14", "weight": 20,
            "priority_label": "High", "estimated_hours_needed": 2,
        })
        result = scheduler.generate_schedule()
        assert result["schedule"]["Wednesday"] == []
        assert result["overload_warning"][0]["hours_short"] == 2

    def test_rolling_schedule_respects_blocks_in_later_weeks(self):
        blocked = [{"date": "2026-10-21", "start_time": "18:00", "end_time": "20:00"}]
        result = generate_rolling_schedule(
            EVENINGS,
            [{
                "task_id": "t1", "module": "M", "deadline_date": "2026-10-27", "weight": 20,
                "priority_label": "High", "estimated_hours_needed": 30,
            }],
            anchor_date=WEDNESDAY,
            blocked_slots=blocked,
        )
        assert result["schedule"]["2026-10-21"] == []
        assert result["schedule"]["2026-10-14"] != []
