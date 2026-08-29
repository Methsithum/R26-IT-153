"""
Regression tests for the exam-prep escalation model (Section 8a/8b), Python
port side - see test_hybrid_priority_layer.py's docstring for why this tests
the sensitivity_analysis.py port rather than duplicating the frontend's own
vitest coverage (frontend/src/utils/__tests__/examPrepConfig.test.js) of the
canonical JS implementation.
"""
from sensitivity_analysis import (
    compute_exam_prep_hours_for_day,
    compute_performance_multiplier,
    PROD_EXAM_CURVE,
    PROD_PERF_MULT,
)


class TestEscalatingCurve:
    def test_hours_increase_as_days_remaining_decreases(self):
        exam_days_from_today = 30
        far_hours = compute_exam_prep_hours_for_day(exam_days_from_today, 0, 12, PROD_EXAM_CURVE)  # 30d out
        near_hours = compute_exam_prep_hours_for_day(exam_days_from_today, 25, 12, PROD_EXAM_CURVE)  # 5d out
        assert near_hours > far_hours

    def test_non_decreasing_across_the_full_runway(self):
        exam_days_from_today = 30
        values = [compute_exam_prep_hours_for_day(exam_days_from_today, d, 12, PROD_EXAM_CURVE) for d in range(31)]
        for i in range(1, len(values)):
            assert values[i] >= values[i - 1] - 1e-9, f"Regression: hours decreased from day {i-1} to day {i}"

    def test_zero_after_the_exam_has_passed(self):
        assert compute_exam_prep_hours_for_day(5, 6, 12, PROD_EXAM_CURVE) == 0.0


class TestPerformanceMultiplierNoDataDefault:
    """The explicit, deliberately-tested Part D design decision: absent data
    must default to baseline (1.0), never penalize (1.4) nor reward (0.75)."""

    def test_defaults_to_baseline_when_has_data_is_false(self):
        assert compute_performance_multiplier(0, False, PROD_PERF_MULT) == PROD_PERF_MULT["baseline"]
        assert compute_performance_multiplier(None, False, PROD_PERF_MULT) == PROD_PERF_MULT["baseline"]

    def test_the_real_sample_data_case_all_four_exams_at_0_percent_no_data(self):
        # All 4 sample exam modules showed 0% because no marks were recorded
        # yet - this must read as "no signal", not "failing".
        for _ in range(4):
            assert compute_performance_multiplier(0, False, PROD_PERF_MULT) == 1.0


class TestPerformanceMultiplierBands:
    def test_weak_below_50(self):
        assert compute_performance_multiplier(0, True, PROD_PERF_MULT) == PROD_PERF_MULT["weak"]
        assert compute_performance_multiplier(49, True, PROD_PERF_MULT) == PROD_PERF_MULT["weak"]

    def test_baseline_50_to_70_inclusive(self):
        assert compute_performance_multiplier(50, True, PROD_PERF_MULT) == PROD_PERF_MULT["baseline"]
        assert compute_performance_multiplier(70, True, PROD_PERF_MULT) == PROD_PERF_MULT["baseline"]

    def test_strong_above_70(self):
        assert compute_performance_multiplier(71, True, PROD_PERF_MULT) == PROD_PERF_MULT["strong"]
        assert compute_performance_multiplier(100, True, PROD_PERF_MULT) == PROD_PERF_MULT["strong"]

    def test_documented_production_values(self):
        assert PROD_PERF_MULT == {"weak": 1.4, "baseline": 1.0, "strong": 0.75}
