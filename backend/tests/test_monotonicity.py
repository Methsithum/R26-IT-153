"""
The single most important regression test in this suite (PROJECT CONTEXT.md
Section 5c): the deployed OrdinalMonotonicPriorityModel must guarantee
P(High) is non-increasing and P(Low) is non-decreasing as `date` rises,
for a fixed feature vector. This is a direct port of the original
verification sweep from train_priority_model_monotonic.py Section 9, run
here against the ACTUAL deployed artifact
(app/models/study_planner/priority_model.joblib), not a freshly-trained copy -
so this test fails if a future retrain or model swap ever regresses the
guarantee, even if the training script itself still "looks" correct.
"""
import os

import joblib
import numpy as np
import pandas as pd
import pytest

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEPLOYED_MODEL_PATH = os.path.join(BACKEND_DIR, "app", "models", "study_planner", "priority_model.joblib")

FEATURE_ORDER = [
    "date", "weight", "num_of_prev_attempts", "studied_credits",
    "module_presentation_length", "date_registration", "prior_avg_score",
    "avg_weekly_clicks", "clicks_trend", "active_weeks_ratio", "has_vle_activity",
    "assessment_type_enc", "code_module_enc",
]
CLASS_ORDER = ["Low", "Medium", "High"]

TRAINED_DATE_MIN = 12
TRAINED_DATE_MAX = 261


@pytest.fixture(scope="module")
def deployed_model():
    if not os.path.exists(DEPLOYED_MODEL_PATH):
        pytest.skip(f"Deployed model not found at {DEPLOYED_MODEL_PATH} - run training first.")
    return joblib.load(DEPLOYED_MODEL_PATH)


def _base_row(**overrides):
    row = {
        "date": 100, "weight": 20.0, "num_of_prev_attempts": 0, "studied_credits": 60,
        "module_presentation_length": 240, "date_registration": -30, "prior_avg_score": 65,
        "avg_weekly_clicks": 15, "clicks_trend": 0, "active_weeks_ratio": 0.5,
        "has_vle_activity": 1, "assessment_type_enc": 2, "code_module_enc": 0,
    }
    row.update(overrides)
    return row


def test_deployed_model_is_the_ordinal_monotonic_wrapper(deployed_model):
    """
    Regression guard for the documented Section 15/16 guardrail: do not swap
    the ordinal monotonic wrapper back for a plain XGBClassifier without
    understanding why it was introduced. A plain classifier has no
    `.model_medium`/`.model_high` and would silently reintroduce the
    date-inversion bug.
    """
    assert hasattr(deployed_model, "model_medium"), (
        "Deployed priority_model.joblib is NOT an OrdinalMonotonicPriorityModel "
        "(missing .model_medium) - this would reintroduce the date-vs-priority inversion bug."
    )
    assert hasattr(deployed_model, "model_high")


def test_p_high_non_increasing_and_p_low_non_decreasing_across_full_date_range(deployed_model):
    """Direct port of the original verification sweep (30 points across the full trained range)."""
    dates = np.linspace(TRAINED_DATE_MIN, TRAINED_DATE_MAX, 30)
    rows = pd.DataFrame([_base_row(date=d) for d in dates])[FEATURE_ORDER]

    proba = deployed_model.predict_proba(rows)
    p_low = proba[:, CLASS_ORDER.index("Low")]
    p_high = proba[:, CLASS_ORDER.index("High")]

    high_diffs = np.diff(p_high)
    low_diffs = np.diff(p_low)

    assert np.all(high_diffs <= 1e-9), (
        f"P(High) is NOT non-increasing across the date sweep - monotonicity regression! "
        f"Violating diffs: {high_diffs[high_diffs > 1e-9]}"
    )
    assert np.all(low_diffs >= -1e-9), (
        f"P(Low) is NOT non-decreasing across the date sweep - monotonicity regression! "
        f"Violating diffs: {low_diffs[low_diffs < -1e-9]}"
    )


@pytest.mark.parametrize("weight,prior_avg_score", [(20, 65), (5, 30), (40, 90), (100, 0)])
def test_monotonicity_holds_across_different_fixed_feature_combinations(deployed_model, weight, prior_avg_score):
    """The guarantee must hold for ANY fixed set of other features, not just one hand-picked combination."""
    dates = np.linspace(TRAINED_DATE_MIN, TRAINED_DATE_MAX, 15)
    rows = pd.DataFrame([_base_row(date=d, weight=weight, prior_avg_score=prior_avg_score) for d in dates])[FEATURE_ORDER]
    proba = deployed_model.predict_proba(rows)
    p_high = proba[:, CLASS_ORDER.index("High")]
    assert np.all(np.diff(p_high) <= 1e-9), f"P(High) non-monotonic for weight={weight}, prior_avg_score={prior_avg_score}"


def test_the_exact_originally_reported_inversion_is_fixed(deployed_model):
    """
    The literal real-world case from the live investigation that started
    this whole fix: "Mobile Application Development assignment" (due
    tomorrow, date=13.38) vs. "dddddd" (due in 32 days, date=56.27), both
    weight=20, prior_avg_score=65, identical on every other feature. The
    near-term task's predicted priority must be >= the distant one's.
    """
    near_row = pd.DataFrame([_base_row(date=13.383333333333333)])[FEATURE_ORDER]
    far_row = pd.DataFrame([_base_row(date=56.266666666666666)])[FEATURE_ORDER]

    near_pred = CLASS_ORDER[int(deployed_model.predict(near_row)[0])]
    far_pred = CLASS_ORDER[int(deployed_model.predict(far_row)[0])]

    near_rank = CLASS_ORDER.index(near_pred)
    far_rank = CLASS_ORDER.index(far_pred)
    assert near_rank >= far_rank, (
        f"REGRESSION: the original date-inversion bug is back - near-term task predicted "
        f"'{near_pred}' but distant task predicted '{far_pred}' (near-term should be >= distant)."
    )
