"""
Tests for app/services/assessment_prediction/feature_builder.py - the
serving-side previous-score feature computation. Pure unit tests, no
database, no mocks needed (the module under test does no I/O).

Includes a parity test against the REAL training code in
ml_scripts/journal/assessment_score/data_prep.py, imported by file path
here only - app code (feature_builder.py) must never import ml_scripts.
"""

import importlib.util
import os
import sys

import pytest

from app.services.assessment_prediction.feature_builder import (
    build_previous_score_records,
    compute_previous_score_features,
    mark_to_numeric,
    to_date,
)


# ===========================================================================
# 1. compute_previous_score_features - strictly-earlier-date rules
# ===========================================================================

def test_only_strictly_earlier_dates_count():
    records = [
        {"date": "2026-01-10", "mark": 60.0, "id": "1"},
        {"date": "2026-01-20", "mark": 80.0, "id": "2"},   # same date as target - must NOT count
        {"date": "2026-01-25", "mark": 90.0, "id": "3"},   # future relative to target - must NOT count
    ]
    prev_mean, prev_last, prev_count = compute_previous_score_features(records, target_date="2026-01-20")
    assert prev_count == 1
    assert prev_mean == 60.0
    assert prev_last == 60.0


def test_prev_last_is_the_most_recent_strictly_earlier_mark():
    records = [
        {"date": "2026-01-01", "mark": 40.0, "id": "1"},
        {"date": "2026-01-15", "mark": 70.0, "id": "2"},
    ]
    prev_mean, prev_last, prev_count = compute_previous_score_features(records, target_date="2026-02-01")
    assert prev_count == 2
    assert prev_mean == pytest.approx(55.0)
    assert prev_last == 70.0


def test_cold_start_no_earlier_records():
    prev_mean, prev_last, prev_count = compute_previous_score_features([], target_date="2026-01-01")
    assert (prev_mean, prev_last, prev_count) == (None, None, 0)


def test_prev_mean_is_mean_of_individual_marks_not_mean_of_per_date_means():
    """
    Two earlier marks (60, 80) tied on ONE earlier date, plus 70 on a
    different (also earlier) date: prev_mean must be the mean of the 3
    individual marks (70), NOT the mean of per-date means
    (mean(mean(60,80), 70) = mean(70, 70) = 70 would coincidentally also be
    70 here, which is why this test also checks prev_count == 3 explicitly -
    a mean-of-per-date-means implementation would still give prev_count 3
    only if it counted rows, but would give the WRONG prev_mean whenever the
    tied values are not symmetric around the other date's value; this exact
    case is the one the training-code author specified as the parity check).
    """
    records = [
        {"date": "2026-01-10", "mark": 60.0, "id": "1"},
        {"date": "2026-01-10", "mark": 80.0, "id": "2"},  # tied with the above
        {"date": "2026-01-20", "mark": 70.0, "id": "3"},
    ]
    prev_mean, prev_last, prev_count = compute_previous_score_features(records, target_date="2026-01-30")
    assert prev_count == 3
    assert prev_mean == pytest.approx(70.0)
    assert prev_last == 70.0  # the single mark at the more recent earlier date - no tie there


def test_tie_at_most_recent_earlier_date_broken_by_ascending_id():
    """Two marks tied on the SAME most-recent-earlier date: prev_last takes the smaller id (ascending _id order)."""
    records = [
        {"date": "2026-01-01", "mark": 50.0, "id": "aaa"},
        {"date": "2026-01-10", "mark": 95.0, "id": "aaa000000000000000000002"},  # smaller id
        {"date": "2026-01-10", "mark": 90.0, "id": "bbb000000000000000000001"},  # larger id
    ]
    prev_mean, prev_last, prev_count = compute_previous_score_features(records, target_date="2026-02-01")
    assert prev_count == 3
    assert prev_mean == pytest.approx((50.0 + 95.0 + 90.0) / 3)
    assert prev_last == 95.0  # the smaller-id row at the tied date, not 90.0


# ===========================================================================
# 2. build_previous_score_records - subject/target/date/mark filtering
# ===========================================================================

def test_build_previous_score_records_filters_correctly():
    raw = [
        {"id": "1", "subject": "Databases", "date": "2026-01-01", "mark": 60},
        {"id": "2", "subject": "Networks", "date": "2026-01-02", "mark": 70},   # wrong subject
        {"id": "3", "subject": "Databases", "date": "2026-01-03", "mark": None},  # no mark
        {"id": "4", "subject": "Databases", "date": None, "mark": 80},  # no date
        {"id": "target", "subject": "Databases", "date": "2026-01-05", "mark": 99},  # the target itself
        {"id": "5", "subject": "Databases", "date": "2026-01-04", "mark": "not-a-number"},  # unparseable
        {"id": "6", "subject": "Databases", "date": "2026-01-06", "mark": "B+"},  # letter grade
    ]
    records = build_previous_score_records(raw, subject="Databases", exclude_id="target", date_field="date")
    ids = {r["id"] for r in records}
    assert ids == {"1", "6"}
    b_plus_record = next(r for r in records if r["id"] == "6")
    assert b_plus_record["mark"] == 77  # per LETTER_GRADE_TO_PERCENT


def test_mark_to_numeric_conversions():
    assert mark_to_numeric(85) == 85.0
    assert mark_to_numeric("85") == 85.0
    assert mark_to_numeric("B+") == 77
    assert mark_to_numeric("garbage") is None
    assert mark_to_numeric(None) is None
    assert mark_to_numeric("") is None


def test_to_date_handles_iso_strings_and_none():
    assert to_date("2026-01-05") is not None
    assert to_date("2026-01-05T00:00:00") is not None
    assert to_date(None) is None
    assert to_date("") is None
    assert to_date("not-a-date") is None


# ===========================================================================
# 3. PARITY TEST - serving logic must match training's data_prep.py exactly
# ===========================================================================

def _load_training_data_prep():
    """Imports ml_scripts/journal/assessment_score/data_prep.py by file path (test-only)."""
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    assessment_score_dir = os.path.join(backend_dir, "ml_scripts", "journal", "assessment_score")
    data_prep_path = os.path.join(assessment_score_dir, "data_prep.py")
    # data_prep.py's own top-level code does `import config` assuming its own
    # directory is on sys.path - satisfy that before exec'ing it.
    if assessment_score_dir not in sys.path:
        sys.path.insert(0, assessment_score_dir)
    spec = importlib.util.spec_from_file_location("training_data_prep_for_parity_test", data_prep_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_parity_with_training_data_prep_simple_case():
    """
    One student, one module-presentation, 4 assessments (dates 10, 20, 30
    strictly increasing, target at date 40). Training's
    add_previous_score_features() and the serving compute_previous_score_features()
    must agree on prev_mean/prev_last/prev_count for the target row.
    """
    import pandas as pd

    data_prep = _load_training_data_prep()

    df = pd.DataFrame([
        {"id_student": 1, "code_module": "AAA", "code_presentation": "2013J", "id_assessment": 1, "date": 10, "score": 55},
        {"id_student": 1, "code_module": "AAA", "code_presentation": "2013J", "id_assessment": 2, "date": 20, "score": 65},
        {"id_student": 1, "code_module": "AAA", "code_presentation": "2013J", "id_assessment": 3, "date": 30, "score": 75},
        {"id_student": 1, "code_module": "AAA", "code_presentation": "2013J", "id_assessment": 4, "date": 40, "score": 999},  # target
    ])
    out, _ = data_prep.add_previous_score_features(df)
    target_row = out[out["id_assessment"] == 4].iloc[0]

    raw_marks = [
        {"id": "1", "subject": "X", "date": "2026-01-10", "mark": 55},
        {"id": "2", "subject": "X", "date": "2026-01-20", "mark": 65},
        {"id": "3", "subject": "X", "date": "2026-01-30", "mark": 75},
    ]
    records = build_previous_score_records(raw_marks, subject="X", exclude_id="4", date_field="date")
    prev_mean, prev_last, prev_count = compute_previous_score_features(records, target_date="2026-02-08")

    assert prev_count == int(target_row["prev_count"])
    assert prev_mean == pytest.approx(float(target_row["prev_mean"]))
    assert prev_last == pytest.approx(float(target_row["prev_last"]))


def test_parity_with_training_data_prep_same_date_tie_case():
    """
    The approved parity case: two earlier marks (60, 80) tied on ONE earlier
    date, plus 70 on a different (also earlier) date. Both training and
    serving must give prev_mean=70 (mean of the 3 individual marks, NOT a
    mean of per-date means) and prev_count=3.
    """
    import pandas as pd

    data_prep = _load_training_data_prep()

    df = pd.DataFrame([
        {"id_student": 1, "code_module": "AAA", "code_presentation": "2013J", "id_assessment": 1, "date": 10, "score": 60},
        {"id_student": 1, "code_module": "AAA", "code_presentation": "2013J", "id_assessment": 2, "date": 10, "score": 80},  # tied date with #1
        {"id_student": 1, "code_module": "AAA", "code_presentation": "2013J", "id_assessment": 3, "date": 20, "score": 70},
        {"id_student": 1, "code_module": "AAA", "code_presentation": "2013J", "id_assessment": 4, "date": 30, "score": 999},  # target
    ])
    out, _ = data_prep.add_previous_score_features(df)
    target_row = out[out["id_assessment"] == 4].iloc[0]

    assert int(target_row["prev_count"]) == 3
    assert float(target_row["prev_mean"]) == pytest.approx(70.0)

    raw_marks = [
        {"id": "1", "subject": "X", "date": "2026-01-10", "mark": 60},
        {"id": "2", "subject": "X", "date": "2026-01-10", "mark": 80},
        {"id": "3", "subject": "X", "date": "2026-01-20", "mark": 70},
    ]
    records = build_previous_score_records(raw_marks, subject="X", exclude_id="4", date_field="date")
    prev_mean, prev_last, prev_count = compute_previous_score_features(records, target_date="2026-01-30")

    assert prev_count == 3
    assert prev_mean == pytest.approx(70.0)
    assert prev_count == int(target_row["prev_count"])
    assert prev_mean == pytest.approx(float(target_row["prev_mean"]))
    assert prev_last == pytest.approx(float(target_row["prev_last"]))
