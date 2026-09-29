"""
Tests for ml_scripts/journal/assessment_score/ - the offline assessment-score
training pipeline. These are pure unit tests against small synthetic
fixtures; they do not read the real OULAD CSVs or require a trained model,
except test 3 which loads the actual saved bundle (skipped if it hasn't been
trained yet).

ml_scripts/journal/assessment_score is not an installed package (folders
elsewhere under ml_scripts contain hyphens, so this project does not rely on
package-style imports across ml_scripts) - this file adds it to sys.path
itself, the same pattern backend/tests/conftest.py already uses for
ml_scripts/study-planner, without modifying that shared conftest.
"""

import os
import subprocess
import sys
import textwrap

import numpy as np
import pandas as pd
import pytest

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSESSMENT_SCORE_DIR = os.path.join(BACKEND_DIR, "ml_scripts", "journal", "assessment_score")
if ASSESSMENT_SCORE_DIR not in sys.path:
    sys.path.insert(0, ASSESSMENT_SCORE_DIR)

import data_prep  # noqa: E402
import evaluate  # noqa: E402


# ===========================================================================
# 1. Feature builder leakage guard - synthetic fixture with a deliberate
#    future-leak row that must NOT be used.
# ===========================================================================

def test_previous_score_features_exclude_future_and_same_date_assessments():
    """
    Student 1 has three assessments in the same module-presentation:
      - id_assessment=1, date=10, score=50   (earliest)
      - id_assessment=2, date=20, score=80   (the row under test)
      - id_assessment=3, date=30, score=999  (FUTURE LEAK - due strictly
        after id_assessment=2, must NOT count as "previous" for it)
    For id_assessment=2: prev_count must be exactly 1 (only assessment 1),
    prev_mean/prev_last must be 50, NOT influenced by the future score 999.
    """
    df = pd.DataFrame([
        {"id_student": 1, "code_module": "AAA", "code_presentation": "2013J",
         "id_assessment": 1, "date": 10, "score": 50},
        {"id_student": 1, "code_module": "AAA", "code_presentation": "2013J",
         "id_assessment": 2, "date": 20, "score": 80},
        {"id_student": 1, "code_module": "AAA", "code_presentation": "2013J",
         "id_assessment": 3, "date": 30, "score": 999},  # future leak row
    ])

    out, _ = data_prep.add_previous_score_features(df)
    row2 = out[out["id_assessment"] == 2].iloc[0]

    assert row2["prev_count"] == 1, "assessment 2 must only see the 1 strictly-earlier assessment"
    assert row2["prev_mean"] == 50, "prev_mean must not include the future (date=30) score"
    assert row2["prev_last"] == 50, "prev_last must not include the future (date=30) score"

    row1 = out[out["id_assessment"] == 1].iloc[0]
    assert row1["prev_count"] == 0
    assert pd.isna(row1["prev_mean"])


def test_vle_features_exclude_clicks_after_due_date():
    """
    One assessment due on date=20. VLE activity:
      - date=10, clicks=5   (before due date - must count)
      - date=25, clicks=100 (FUTURE LEAK - after the due date, must NOT count)
    clicks_total_log1p must reflect only the 5 pre-due-date clicks, and
    active_days/days_since_last_activity must be based on date=10, not 25.
    """
    df = pd.DataFrame([
        {"id_student": 1, "code_module": "AAA", "code_presentation": "2013J",
         "id_assessment": 1, "date": 20.0, "score": 70},
    ])
    vle_daily = pd.DataFrame([
        {"code_module": "AAA", "code_presentation": "2013J", "id_student": 1, "date": 10, "clicks": 5},
        {"code_module": "AAA", "code_presentation": "2013J", "id_student": 1, "date": 25, "clicks": 100},  # future leak
    ])

    out = data_prep.add_vle_features(df, vle_daily)
    row = out.iloc[0]

    assert row["_raw_clicks_before_due"] == 5, "must not include the click that happened after the due date"
    assert row["active_days"] == 1
    assert row["days_since_last_activity"] == 20 - 10
    assert row["clicks_total_log1p"] == pytest.approx(np.log1p(5))


# ===========================================================================
# 2. Conformal interval helper - stays within [0, 100], coverage close to
#    1 - alpha on synthetic data.
# ===========================================================================

def test_conformal_interval_clipped_to_valid_score_range():
    q = 30.0
    y_pred = np.array([-500.0, 0.0, 50.0, 100.0, 500.0])
    lower, upper = evaluate.conformal_interval(y_pred, q)
    assert np.all(lower >= 0) and np.all(lower <= 100)
    assert np.all(upper >= 0) and np.all(upper <= 100)
    assert np.all(upper >= lower)


def test_threshold_for_target_recall_achieves_the_requested_recall():
    """
    Regression test for a real bug: threshold_for_target_recall (formerly
    threshold_for_matched_recall) used to compute the quantile at level
    (1 - target_recall) instead of target_recall, so the achieved recall was
    the COMPLEMENT of what was asked for (e.g. asking for recall 0.40
    silently produced recall 0.60). On synthetic data with a known true
    at-risk distribution, the achieved recall must match the requested
    recall within 0.01.
    """
    rng = np.random.RandomState(0)
    n = 5000
    y_true_at_risk = rng.rand(n) < 0.1  # ~10% at-risk, similar order to the real ~4-18% rates
    predicted_score = rng.normal(50, 20, n)
    # Make at-risk rows genuinely skew toward lower predicted scores, like a real model would.
    predicted_score[y_true_at_risk] -= 15

    for target_recall in (0.20, 0.384, 0.60, 0.80):
        threshold = evaluate.threshold_for_target_recall(predicted_score, y_true_at_risk, target_recall)
        flagged = predicted_score < threshold
        achieved_recall = evaluate.at_risk_prf(y_true_at_risk, flagged)["recall"]
        assert abs(achieved_recall - target_recall) < 0.01, (
            f"target_recall={target_recall} but achieved_recall={achieved_recall:.4f} "
            f"(threshold={threshold:.2f}) - quantile direction is wrong again"
        )


def test_conformal_coverage_close_to_target_on_synthetic_data():
    rng = np.random.RandomState(0)
    n_cal, n_test, alpha = 2000, 2000, 0.10

    y_cal = rng.uniform(0, 100, n_cal)
    pred_cal = y_cal + rng.normal(0, 10, n_cal)
    q = evaluate.conformal_quantile(np.abs(y_cal - pred_cal), alpha)

    y_test = rng.uniform(0, 100, n_test)
    pred_test = y_test + rng.normal(0, 10, n_test)
    coverage, mean_width = evaluate.conformal_coverage_and_width(y_test, pred_test, q)

    assert abs(coverage - (1 - alpha)) < 0.03, f"coverage {coverage} not close to target {1 - alpha}"
    assert mean_width > 0


# ===========================================================================
# 3. Loading a saved bundle in a FRESH process, without importing ml_scripts,
#    and predict() runs on a one-row DataFrame.
# ===========================================================================

BUNDLE_PATH = os.path.join(
    BACKEND_DIR, "trained-models", "journal", "assessment_score",
    "assessment_score_journal_compatible.joblib",
)


@pytest.mark.skipif(not os.path.exists(BUNDLE_PATH), reason="assessment_score_journal_compatible.joblib not trained yet")
def test_bundle_loads_and_predicts_in_fresh_process_without_ml_scripts():
    """
    Runs in a subprocess with a clean sys.path (no ml_scripts on it) to prove
    the bundle contains only sklearn/numpy/pandas objects + plain metadata,
    not a pickled reference to a class defined in ml_scripts - the FastAPI
    app must be able to load this without importing ml_scripts at all.
    """
    script = textwrap.dedent(f"""
        import sys
        # Deliberately do NOT add ml_scripts to sys.path - simulates app/ loading the bundle.
        import joblib
        import pandas as pd

        bundle = joblib.load({BUNDLE_PATH!r})
        assert isinstance(bundle, dict)
        for key in ("model", "features", "conformal_q", "alpha", "feature_set", "pass_mark", "trained_on", "sklearn_version", "trained_at"):
            assert key in bundle, f"missing bundle key: {{key}}"

        row = pd.DataFrame([{{
            "prev_mean": 65.0, "prev_last": 60.0, "prev_count": 3, "assessment_type": "TMA",
        }}])[bundle["features"]]
        pred = bundle["model"].predict(row)
        assert len(pred) == 1
        assert 0 <= float(pred[0]) <= 150  # sanity bound, model is not clipped internally
        print("OK", float(pred[0]))
    """)
    result = subprocess.run(
        [sys.executable, "-c", script],
        capture_output=True, text=True, cwd=BACKEND_DIR,
    )
    assert result.returncode == 0, f"stdout={result.stdout}\nstderr={result.stderr}"
    assert result.stdout.strip().startswith("OK")
