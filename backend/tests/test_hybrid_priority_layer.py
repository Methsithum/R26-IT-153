"""
Regression tests for the hybrid priority layer (PROJECT CONTEXT.md Section
5d), Python side.

The canonical implementation is frontend/src/utils/priorityEngine.js, and
its own guarantees are directly unit-tested there (see
frontend/src/utils/__tests__/priorityEngine.test.js - same cases as below).
This file instead tests the STANDALONE PYTHON PORT in
ml_scripts/study-planner/sensitivity_analysis.py, which Phase 1/2's
analysis and research scripts (sensitivity_analysis.py, scheduler_baselines.py)
depend on being faithful to the real JS behavior. Without this test, that
Python port could silently drift from production behavior (e.g. someone
"fixes" a perceived bug in the port without touching the JS, or vice versa)
and every research finding built on it would be quietly wrong. Practical
choice per the task: porting was already done and cross-verified during
Phase 1/2's own manual verification, so this reuses that port rather than
introducing a third parallel implementation or a JS-calling test harness.
"""
import pytest

from sensitivity_analysis import (
    compute_base_tier_level,
    compute_final_priority_level,
    PROD_THRESHOLDS,
    LEVELS,
)


class TestBaseTierThresholds:
    def test_assignment_high_at_2_days_or_less(self):
        assert compute_base_tier_level(0, "assignment", PROD_THRESHOLDS) == LEVELS["High"]
        assert compute_base_tier_level(2, "assignment", PROD_THRESHOLDS) == LEVELS["High"]

    def test_assignment_medium_3_to_14_days(self):
        assert compute_base_tier_level(3, "assignment", PROD_THRESHOLDS) == LEVELS["Medium"]
        assert compute_base_tier_level(14, "assignment", PROD_THRESHOLDS) == LEVELS["Medium"]

    def test_assignment_low_at_15_days_or_more(self):
        assert compute_base_tier_level(15, "assignment", PROD_THRESHOLDS) == LEVELS["Low"]

    def test_exam_high_at_7_days_or_less(self):
        assert compute_base_tier_level(7, "exam", PROD_THRESHOLDS) == LEVELS["High"]

    def test_exam_low_at_31_days_or_more(self):
        assert compute_base_tier_level(31, "exam", PROD_THRESHOLDS) == LEVELS["Low"]


class TestOverdueAlwaysHigh:
    @pytest.mark.parametrize("raw_ml_level", [LEVELS["Low"], LEVELS["Medium"], LEVELS["High"], None])
    @pytest.mark.parametrize("task_type", ["assignment", "exam"])
    def test_overdue_forces_high_regardless_of_ml_input(self, raw_ml_level, task_type):
        result = compute_final_priority_level(-1, task_type, raw_ml_level, PROD_THRESHOLDS, modifier_clamp=1)
        assert result == LEVELS["High"]

    def test_far_overdue_still_high(self):
        assert compute_final_priority_level(-30, "assignment", LEVELS["Low"], PROD_THRESHOLDS, 1) == LEVELS["High"]


class TestHardFloorOver30Days:
    @pytest.mark.parametrize("raw_ml_level", [LEVELS["Low"], LEVELS["Medium"], LEVELS["High"]])
    def test_forces_low_past_30_days_even_when_ml_strongly_suggests_high(self, raw_ml_level):
        result = compute_final_priority_level(31, "assignment", raw_ml_level, PROD_THRESHOLDS, modifier_clamp=1)
        assert result == LEVELS["Low"]

    def test_the_real_dddddd_case_no_longer_inflates(self):
        # 32 days out, ML=High (the literal case from the live investigation).
        result = compute_final_priority_level(32, "assignment", LEVELS["High"], PROD_THRESHOLDS, 1)
        assert result == LEVELS["Low"]

    def test_does_not_floor_at_exactly_30_days(self):
        # base(30d, assignment) = Low(0); ML=High(2); the ±1 clamp (not the
        # >30 floor, which doesn't trigger at exactly 30) lifts it to Medium(1).
        result = compute_final_priority_level(30, "assignment", LEVELS["High"], PROD_THRESHOLDS, 1)
        assert result == LEVELS["Medium"]


class TestPlusMinusOneClamp:
    def test_never_moves_more_than_one_tier_from_base(self):
        days_for_base = {"Low": 20, "Medium": 10, "High": 1}
        for base_label, days in days_for_base.items():
            for ml_label, ml_level in LEVELS.items():
                base_level = LEVELS[base_label]
                final = compute_final_priority_level(days, "assignment", ml_level, PROD_THRESHOLDS, modifier_clamp=1)
                assert abs(final - base_level) <= 1, (
                    f"Clamp violated: base={base_label}({base_level}), ml={ml_label}({ml_level}), final={final}"
                )

    def test_two_tier_gap_clamps_to_one(self):
        # base=Low(0), ML=High(2) -> must clamp to Medium(1), not jump straight to High.
        result = compute_final_priority_level(20, "assignment", LEVELS["High"], PROD_THRESHOLDS, modifier_clamp=1)
        assert result == LEVELS["Medium"]
        # base=High(2), ML=Low(0) -> must clamp to Medium(1), not drop to Low.
        result2 = compute_final_priority_level(1, "assignment", LEVELS["Low"], PROD_THRESHOLDS, modifier_clamp=1)
        assert result2 == LEVELS["Medium"]

    def test_clamp_0_disables_ml_influence_entirely(self):
        # With clamp=0, final must always equal base regardless of ML input (Phase 1's sensitivity finding).
        for ml_level in LEVELS.values():
            assert compute_final_priority_level(20, "assignment", ml_level, PROD_THRESHOLDS, modifier_clamp=0) == LEVELS["Low"]
