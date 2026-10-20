"""
Overlapping study sessions: each regeneration could put another task in the
same time slot, and every frozen version of a day was stored and shown -
several "studied" sessions at the same time. snapshot() keeps the first
version per slot, and /mark refuses a second marked session in a used slot.
"""

import asyncio

import mongomock
import pytest

from app.models.study_planner import study_session
from app.models.study_planner.study_session import StudySessionModel, slots_overlap

DATE = "2026-10-19"


def _session(task_id, time_slot, date=DATE):
    return {"date": date, "time_slot": time_slot, "task_id": task_id, "module": "m", "duration_minutes": 60}


@pytest.fixture
def collection(monkeypatch):
    coll = mongomock.MongoClient().db.study_sessions
    monkeypatch.setattr(study_session, "session_collection", coll)
    return coll


def run(coro):
    return asyncio.run(coro)


def test_slots_overlap():
    assert slots_overlap("07:00-10:00", "07:00-08:45")
    assert slots_overlap("20:30-23:30", "21:00-22:00")
    assert not slots_overlap("07:00-08:45", "08:45-09:15")


def test_second_plan_version_for_same_day_is_not_stored(collection):
    first = [_session("a", "07:00-08:45"), _session("a", "08:45-09:15"), _session("b", "20:30-23:30")]
    second = [_session("c", "07:00-10:00"), _session("d", "20:30-23:30"), _session("e", "11:00-12:00")]
    assert run(StudySessionModel.snapshot("u1", first)) == 3
    # Only the session in a still-free slot is added.
    assert run(StudySessionModel.snapshot("u1", second)) == 1
    stored = sorted((d["task_id"], d["time_slot"]) for d in collection.find({"user_id": "u1"}))
    assert stored == [("a", "07:00-08:45"), ("a", "08:45-09:15"), ("b", "20:30-23:30"), ("e", "11:00-12:00")]


def test_overlap_inside_one_request_keeps_the_first(collection):
    assert run(StudySessionModel.snapshot("u1", [_session("a", "07:00-10:00"), _session("b", "07:00-08:45")])) == 1


def test_resending_same_session_is_still_a_noop(collection):
    run(StudySessionModel.snapshot("u1", [_session("a", "07:00-10:00")]))
    assert run(StudySessionModel.snapshot("u1", [_session("a", "07:00-10:00")])) == 0


def test_other_users_and_dates_are_independent(collection):
    run(StudySessionModel.snapshot("u1", [_session("a", "07:00-10:00")]))
    assert run(StudySessionModel.snapshot("u2", [_session("b", "07:00-10:00")])) == 1
    assert run(StudySessionModel.snapshot("u1", [_session("b", "07:00-10:00", date="2026-10-20")])) == 1


def test_find_marked_overlap(collection):
    run(StudySessionModel.snapshot("u1", [_session("a", "07:00-10:00")]))
    assert run(StudySessionModel.find_marked_overlap("u1", _session("b", "08:00-09:00"))) is None  # still pending
    collection.update_one({"task_id": "a"}, {"$set": {"status": "done"}})
    clash = run(StudySessionModel.find_marked_overlap("u1", _session("b", "08:00-09:00")))
    assert clash["task_id"] == "a"
    # Re-marking the same session is not a clash.
    assert run(StudySessionModel.find_marked_overlap("u1", _session("a", "07:00-10:00"))) is None
