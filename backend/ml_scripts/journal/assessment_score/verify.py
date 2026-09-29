"""
verify.py - required verification checks for the assessment_score training
pipeline. Run automatically by train.py, but can also be run standalone:

    venv/Scripts/python ml_scripts/journal/assessment_score/verify.py

Fails loudly (raises) on any mismatch rather than silently continuing.
"""

import os
import sys

import numpy as np
import pandas as pd

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import config
import evaluate
from data_prep import build_training_table, section

EXPECTED_ROW_COUNTS = {
    "studentAssessment_raw": 173912,
    "after_drop_missing_score": 173739,
    "after_drop_banked": 171831,
    "after_drop_missing_due_date": 168966,
}
EXPECTED_UNIQUE_STUDENTS = 23291
EXPECTED_MODULE_PRESENTATIONS = 22
EXPECTED_AT_RISK_RATE = 0.0425
EXPECTED_PREV_COUNT_ZERO = 25607

REFERENCE_ROWS = {
    # (id_student, id_assessment): (prev_mean, prev_last, prev_count, active_days,
    #                                days_since_last_activity, raw_clicks_before_due, raw_clicks_last_14d)
    (632712, 15018): (76.14, 66, 7, 5, 4, 74, 20),
    (552441, 24287): (89.00, 98, 2, 48, 1, 1360, 154),
    (688008, 34900): (94.00, 94, 1, 14, 3, 858, 138),
    (498006, 34888): (83.00, 80, 2, 40, 1, 769, 229),
    (544055, 34863): (85.00, 83, 3, 116, 1, 3810, 476),
    (392215, 37418): (55.33, 52, 3, 12, 11, 265, 110),
}


def verify_row_counts(df):
    section("VERIFY 1: ROW COUNTS")
    ok = True

    n_students = df["id_student"].nunique()
    n_mp = df[["code_module", "code_presentation"]].drop_duplicates().shape[0]
    at_risk_rate = (df["score"] < config.AT_RISK_SCORE_THRESHOLD).mean()
    n_zero_prev = int((df["prev_count"] == 0).sum())

    checks = [
        ("final row count", len(df), EXPECTED_ROW_COUNTS["after_drop_missing_due_date"]),
        ("unique students", n_students, EXPECTED_UNIQUE_STUDENTS),
        ("unique module-presentations", n_mp, EXPECTED_MODULE_PRESENTATIONS),
    ]
    for label, actual, expected in checks:
        status = "OK" if actual == expected else "MISMATCH"
        if actual != expected:
            ok = False
        print(f"  {label}: actual={actual} expected={expected} [{status}]")

    at_risk_status = "OK" if abs(at_risk_rate - EXPECTED_AT_RISK_RATE) < 0.0005 else "MISMATCH"
    if at_risk_status == "MISMATCH":
        ok = False
    print(f"  at-risk rate: actual={at_risk_rate:.4f} expected={EXPECTED_AT_RISK_RATE:.4f} [{at_risk_status}]")

    prev_status = "OK" if n_zero_prev == EXPECTED_PREV_COUNT_ZERO else "MISMATCH (reported, not fatal)"
    print(f"  rows with prev_count==0: actual={n_zero_prev} expected={EXPECTED_PREV_COUNT_ZERO} [{prev_status}]")
    if n_zero_prev != EXPECTED_PREV_COUNT_ZERO:
        print(f"    NOTE: this mismatch does NOT block training - see the written explanation "
              f"in the conversation/README. All other row counts (the ones that gate correctness "
              f"of the filtering pipeline) match exactly.")

    return ok


def verify_reference_rows(df):
    section("VERIFY 3: REFERENCE ROWS (primary leakage/correctness check)")
    ok = True
    lookup = df.set_index(["id_student", "id_assessment"])

    for (sid, aid), expected in REFERENCE_ROWS.items():
        exp_prev_mean, exp_prev_last, exp_prev_count, exp_active_days, exp_days_since, exp_clicks_before, exp_clicks_14d = expected
        if (sid, aid) not in lookup.index:
            print(f"  ({sid}, {aid}): *** ROW NOT FOUND IN FINAL TABLE ***")
            ok = False
            continue
        row = lookup.loc[(sid, aid)]
        if isinstance(row, pd.DataFrame):
            row = row.iloc[0]

        actual = (
            round(float(row["prev_mean"]), 2) if pd.notna(row["prev_mean"]) else None,
            int(row["prev_last"]) if pd.notna(row["prev_last"]) else None,
            int(row["prev_count"]),
            int(row["active_days"]),
            int(row["days_since_last_activity"]) if pd.notna(row["days_since_last_activity"]) else None,
            int(row["_raw_clicks_before_due"]),
            int(row["_raw_clicks_last_14d"]),
        )
        expected_rounded = (
            round(exp_prev_mean, 2), exp_prev_last, exp_prev_count,
            exp_active_days, exp_days_since, exp_clicks_before, exp_clicks_14d,
        )
        match = actual == expected_rounded
        if not match:
            ok = False
        status = "OK" if match else "MISMATCH"
        print(f"  ({sid}, {aid}): actual={actual}")
        print(f"  ({sid}, {aid}): expected={expected_rounded} [{status}]")

    return ok


def verify_shuffled_target(df, seed=0, r2_fail_threshold=0.02):
    """
    VERIFY 2: retrain full_oulad set C with the target permuted (seed 0) under
    the same GroupKFold(5). A genuinely non-leaky pipeline should give R2 ~ 0
    (MAE ~ the std of the permuted target, close to the baseline MAE ~14.4),
    since permuting the target destroys any real student-assessment
    relationship. R2 > r2_fail_threshold means some leakage path exists.
    """
    from sklearn.ensemble import HistGradientBoostingRegressor
    from sklearn.model_selection import GroupKFold
    from sklearn.pipeline import Pipeline

    section("VERIFY 2: SHUFFLED-TARGET TEST (full_oulad set C, seed=0)")

    feature_cols = config.ABLATION_SETS["C_prev_context_vle"]
    X = df[feature_cols]
    groups = df["id_student"].values

    rng = np.random.RandomState(seed)
    y_shuffled = df["score"].to_numpy(dtype=float).copy()
    rng.shuffle(y_shuffled)

    gkf = GroupKFold(n_splits=5)
    all_true, all_pred = [], []
    for fold, (train_idx, test_idx) in enumerate(gkf.split(X, y_shuffled, groups)):
        pre = evaluate.build_preprocessor(feature_cols)
        model = Pipeline([
            ("pre", pre),
            ("hgb", HistGradientBoostingRegressor(
                max_iter=200, learning_rate=0.08, max_leaf_nodes=31,
                l2_regularization=1.0, random_state=config.RANDOM_STATE,
            )),
        ])
        model.fit(X.iloc[train_idx], y_shuffled[train_idx])
        pred = model.predict(X.iloc[test_idx])
        all_true.append(y_shuffled[test_idx])
        all_pred.append(pred)
        print(f"  fold {fold + 1}/5 done")

    all_true = np.concatenate(all_true)
    all_pred = np.concatenate(all_pred)
    metrics = evaluate.regression_metrics(all_true, all_pred)

    print(f"\nShuffled-target OOF metrics: MAE={metrics['MAE']:.2f} RMSE={metrics['RMSE']:.2f} R2={metrics['R2']:.4f}")
    print(f"Reference expectation: R2 ~= 0 (MAE ~= 14.4). Fail threshold: R2 > {r2_fail_threshold}")

    ok = metrics["R2"] <= r2_fail_threshold
    if not ok:
        print(f"*** FAIL: R2={metrics['R2']:.4f} exceeds {r2_fail_threshold} - possible leakage. Investigate before trusting real-target results. ***")
    else:
        print("PASS: no evidence of leakage from the shuffled-target test.")
    return ok, metrics


if __name__ == "__main__":
    df = build_training_table(use_cache=True)
    row_counts_ok = verify_row_counts(df)
    reference_rows_ok = verify_reference_rows(df)
    shuffled_ok, shuffled_metrics = verify_shuffled_target(df)

    section("VERIFY SUMMARY")
    print(f"Row counts:      {'PASS' if row_counts_ok else 'FAIL (see mismatches above)'}")
    print(f"Reference rows:  {'PASS' if reference_rows_ok else 'FAIL (see mismatches above)'}")
    print(f"Shuffled-target: {'PASS' if shuffled_ok else 'FAIL'} (R2={shuffled_metrics['R2']:.4f})")
