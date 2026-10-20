"""
Engagement features from the journal's study logs (engagement_service.py):
anchored on the student's own plan - studying exactly as planned maps to the
median OULAD student.
"""
from datetime import date, datetime

import pytest

from app.services.study_planner.engagement_service import (
    OULAD_MEDIAN_CLICKS_TREND,
    OULAD_MEDIAN_WEEKLY_CLICKS,
    OULAD_P90_WEEKLY_CLICKS,
    compute_engagement_features,
    minutes_by_subject_week,
)

TODAY = date(2026, 10, 14)  # Wednesday; last completed week = Mon 5 .. Sun 11 Oct


def s(day, minutes, focus=None, today_subjects=None):
    return {"date": datetime(2026, 10, day), "study_duration_minutes": minutes,
            "subject_focus": focus, "today_subjects": today_subjects or []}


def test_minutes_follow_subject_focus_or_split_across_todays_subjects():
    weeks = minutes_by_subject_week([s(6, 120, "OS"), s(7, 60, None, ["OS", "DB"])])
    assert weeks["OS"][date(2026, 10, 5)] == 150
    assert weeks["DB"][date(2026, 10, 5)] == 30


def test_studying_exactly_as_planned_is_the_median_oulad_student():
    sessions = [s(d, 60, "OS") for d in (6, 8, 10)] + [s(d, 60, "OS") for d in (1, 2, 3)]  # 180/week, two weeks
    f = compute_engagement_features(sessions, {"OS": 180}, TODAY)["OS"]
    assert f["avg_weekly_clicks"] == pytest.approx(OULAD_MEDIAN_WEEKLY_CLICKS)
    assert f["clicks_trend"] == pytest.approx(OULAD_MEDIAN_CLICKS_TREND)  # steady
    assert f["active_weeks_ratio"] == 1.0 and f["has_vle_activity"] == 1


def test_half_the_plan_is_half_the_median_and_capped_at_p90():
    sessions = [s(6, 90, "OS"), s(6, 2000, "DB")]
    f = compute_engagement_features(sessions, {"OS": 180, "DB": 180}, TODAY)
    assert f["OS"]["avg_weekly_clicks"] == pytest.approx(OULAD_MEDIAN_WEEKLY_CLICKS / 2, abs=0.01)
    assert f["DB"]["avg_weekly_clicks"] == OULAD_P90_WEEKLY_CLICKS


def test_dropping_off_lowers_the_trend():
    sessions = [s(1, 180, "OS")]  # studied in week of Sep 28-Oct 4, nothing last week
    f = compute_engagement_features(sessions, {"OS": 180}, TODAY)["OS"]
    assert f["clicks_trend"] < OULAD_MEDIAN_CLICKS_TREND
    assert f["active_weeks_ratio"] == 0.5


def test_planned_subject_never_studied_has_no_activity():
    f = compute_engagement_features([s(6, 60, "OS")], {"OS": 180, "AI": 180}, TODAY)["AI"]
    assert f["has_vle_activity"] == 0 and f["avg_weekly_clicks"] == 0


def test_current_unfinished_week_is_ignored_and_no_history_means_no_features():
    # Only this week's logs (Oct 12-14): no COMPLETED week yet -> nothing,
    # so the caller keeps neutral defaults instead of reading "no study".
    assert compute_engagement_features([s(13, 60, "OS")], {"OS": 180}, TODAY) == {}
    assert compute_engagement_features([], {"OS": 180}, TODAY) == {}


def test_missing_plan_uses_the_default_three_hours():
    f = compute_engagement_features([s(6, 180, "OS")], {"OS": 0}, TODAY)["OS"]
    assert f["avg_weekly_clicks"] == pytest.approx(OULAD_MEDIAN_WEEKLY_CLICKS)
