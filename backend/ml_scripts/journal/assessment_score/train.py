"""
train.py - trains and evaluates the assessment_score models, then saves a
joblib bundle per feature set.

Run as a file:
    venv/Scripts/python ml_scripts/journal/assessment_score/train.py --feature-set journal_compatible
    venv/Scripts/python ml_scripts/journal/assessment_score/train.py --feature-set full_oulad
    venv/Scripts/python ml_scripts/journal/assessment_score/train.py --all
"""

import argparse
import datetime
import os
import sys

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import GroupKFold, GroupShuffleSplit
from sklearn.pipeline import Pipeline

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import config
import evaluate
from data_prep import build_training_table, section
from verify import verify_reference_rows, verify_row_counts, verify_shuffled_target


def make_hgb_pipeline(feature_cols):
    return Pipeline([
        ("pre", evaluate.build_preprocessor(feature_cols)),
        ("model", HistGradientBoostingRegressor(
            max_iter=200, learning_rate=0.08, max_leaf_nodes=31,
            l2_regularization=1.0, random_state=config.RANDOM_STATE,
        )),
    ])


def make_ridge_pipeline(feature_cols):
    return Pipeline([
        ("pre", evaluate.build_preprocessor(feature_cols)),
        ("model", Ridge(alpha=1)),
    ])


def make_rf_pipeline(feature_cols):
    return Pipeline([
        ("pre", evaluate.build_preprocessor(feature_cols)),
        ("model", RandomForestRegressor(
            n_estimators=60, max_samples=0.25, min_samples_leaf=30,
            random_state=config.RANDOM_STATE, n_jobs=-1,
        )),
    ])


MODEL_FACTORIES = {
    "Ridge": make_ridge_pipeline,
    "RandomForest": make_rf_pipeline,
    "HistGradientBoosting": make_hgb_pipeline,
}


# ===========================================================================
# GROUPKFOLD OOF HELPER (shared by baselines/models comparison and ablation)
# ===========================================================================

def gkf_oof(df, feature_cols, model_factory, n_splits=5):
    """Returns (oof_pred array aligned to df.index, list of per-fold metrics dicts)."""
    X = df[feature_cols]
    y = df["score"].to_numpy(dtype=float)
    groups = df["id_student"].values

    gkf = GroupKFold(n_splits=n_splits)
    oof_pred = np.full(len(df), np.nan)
    fold_metrics = []
    for fold, (train_idx, test_idx) in enumerate(gkf.split(X, y, groups)):
        model = model_factory(feature_cols)
        model.fit(X.iloc[train_idx], y[train_idx])
        pred = model.predict(X.iloc[test_idx])
        oof_pred[test_idx] = pred
        fold_metrics.append(evaluate.regression_metrics(y[test_idx], pred))
    return oof_pred, fold_metrics


def summarize_fold_metrics(fold_metrics):
    df_m = pd.DataFrame(fold_metrics)
    return {f"{col}_mean": df_m[col].mean() for col in df_m.columns} | \
           {f"{col}_std": df_m[col].std() for col in df_m.columns}


# ===========================================================================
# STEP A: BASELINES + MODEL COMPARISON (on the target feature set)
# ===========================================================================

def run_baselines_and_models(df, feature_cols, feature_set_name):
    section(f"BASELINES + MODEL COMPARISON ({feature_set_name}, GroupKFold(5))")

    X = df[feature_cols]
    y = df["score"].to_numpy(dtype=float)
    groups = df["id_student"].values
    gkf = GroupKFold(n_splits=5)

    rows = []

    # --- baselines (recomputed per fold using only that fold's train split) ---
    baseline_fold_metrics = {"baseline_training_mean": [], "baseline_last_prev_score": [], "baseline_mean_prev_scores": []}
    for train_idx, test_idx in gkf.split(X, y, groups):
        preds = evaluate.baseline_predictions(X.iloc[train_idx], pd.Series(y[train_idx]), X.iloc[test_idx])
        for name, pred in preds.items():
            baseline_fold_metrics[name].append(evaluate.regression_metrics(y[test_idx], pred))
    for name, folds in baseline_fold_metrics.items():
        summary = summarize_fold_metrics(folds)
        rows.append({"name": name, **summary})
        print(f"  {name}: MAE={summary['MAE_mean']:.2f}(+/-{summary['MAE_std']:.2f}) "
              f"RMSE={summary['RMSE_mean']:.2f} R2={summary['R2_mean']:.3f}")

    # --- models ---
    oof_by_model = {}
    for model_name, factory in MODEL_FACTORIES.items():
        oof_pred, fold_metrics = gkf_oof(df, feature_cols, factory)
        oof_by_model[model_name] = oof_pred
        summary = summarize_fold_metrics(fold_metrics)
        rows.append({"name": model_name, **summary})
        print(f"  {model_name}: MAE={summary['MAE_mean']:.2f}(+/-{summary['MAE_std']:.2f}) "
              f"RMSE={summary['RMSE_mean']:.2f} R2={summary['R2_mean']:.3f}")

    report = pd.DataFrame(rows)
    report.to_csv(os.path.join(config.REPORTS_DIR, f"baselines_and_models_{feature_set_name}.csv"), index=False)
    return report, oof_by_model


# ===========================================================================
# STEP B: ABLATION (full_oulad only) - A/B/C/D via HistGradientBoosting
# ===========================================================================

def run_ablation(df):
    section("ABLATION (full_oulad, GroupKFold(5), HistGradientBoosting)")

    rows = []
    oof_by_config = {}
    for config_name, feature_cols in config.ABLATION_SETS.items():
        oof_pred, fold_metrics = gkf_oof(df, feature_cols, make_hgb_pipeline)
        oof_by_config[config_name] = oof_pred
        summary = summarize_fold_metrics(fold_metrics)

        y = df["score"].to_numpy(dtype=float)
        cold_mask = (df["prev_count"] == 0).to_numpy()
        mae_cold = evaluate.regression_metrics(y[cold_mask], oof_pred[cold_mask])["MAE"] if cold_mask.any() else np.nan
        mae_history = evaluate.regression_metrics(y[~cold_mask], oof_pred[~cold_mask])["MAE"] if (~cold_mask).any() else np.nan

        row = {
            "config": config_name,
            "n_features": len(feature_cols),
            **summary,
            "MAE_cold_start": mae_cold,
            "MAE_has_history": mae_history,
        }
        for atype in sorted(df["assessment_type"].dropna().unique()):
            mask = (df["assessment_type"] == atype).to_numpy()
            row[f"MAE_{atype}"] = evaluate.regression_metrics(y[mask], oof_pred[mask])["MAE"] if mask.any() else np.nan
        rows.append(row)

        print(f"  {config_name} ({len(feature_cols)} features): "
              f"MAE={summary['MAE_mean']:.2f}(+/-{summary['MAE_std']:.2f}) R2={summary['R2_mean']:.3f} | "
              f"cold-start MAE={mae_cold:.2f} has-history MAE={mae_history:.2f}")

    report = pd.DataFrame(rows)
    report.to_csv(os.path.join(config.REPORTS_DIR, "ablation_full_oulad.csv"), index=False)
    return report, oof_by_config


# ===========================================================================
# STEP C: AT-RISK (full_oulad, config C) - rule-based vs ML(OOF)
# ===========================================================================

def run_at_risk(df, oof_pred_C):
    section("AT-RISK COMPARISON (full_oulad config C): rule-based vs ML out-of-fold")

    y_true_at_risk = (df["score"] < config.AT_RISK_SCORE_THRESHOLD).to_numpy()

    # Fixed rule (NOT tuned): mean previous score < 50 OR no VLE clicks in last
    # 14 days OR num_of_prev_attempts >= 1.
    prev_mean_low = (df["prev_mean"] < 50).fillna(False).to_numpy()
    no_recent_clicks = (df["_raw_clicks_last_14d"] <= 0).to_numpy()
    repeat_attempt = (df["num_of_prev_attempts"].fillna(0) >= 1).to_numpy()
    rule_flag = prev_mean_low | no_recent_clicks | repeat_attempt

    rule_metrics = evaluate.at_risk_prf(y_true_at_risk, rule_flag)
    print(f"  Rule-based: precision={rule_metrics['precision']:.3f} recall={rule_metrics['recall']:.3f} "
          f"F1={rule_metrics['F1']:.3f} flagged_share={rule_metrics['flagged_share']:.3f}")

    ml_flag_default = oof_pred_C < config.AT_RISK_SCORE_THRESHOLD
    ml_metrics_default = evaluate.at_risk_prf(y_true_at_risk, ml_flag_default)
    print(f"  ML (predicted score < {config.AT_RISK_SCORE_THRESHOLD}): "
          f"precision={ml_metrics_default['precision']:.3f} recall={ml_metrics_default['recall']:.3f} "
          f"F1={ml_metrics_default['F1']:.3f} flagged_share={ml_metrics_default['flagged_share']:.3f}")

    # Threshold chosen so ML recall matches the rule's recall exactly (within
    # tolerance) - the fair precision comparison "at the same recall".
    threshold_matched = evaluate.threshold_for_target_recall(oof_pred_C, y_true_at_risk, rule_metrics["recall"])
    ml_flag_matched = oof_pred_C < threshold_matched
    ml_metrics_matched = evaluate.at_risk_prf(y_true_at_risk, ml_flag_matched)
    recall_diff = abs(ml_metrics_matched["recall"] - rule_metrics["recall"])
    print(f"  ML (matched recall, threshold={threshold_matched:.2f}): "
          f"precision={ml_metrics_matched['precision']:.3f} recall={ml_metrics_matched['recall']:.3f} "
          f"F1={ml_metrics_matched['F1']:.3f} flagged_share={ml_metrics_matched['flagged_share']:.3f} "
          f"(|recall - rule_recall| = {recall_diff:.4f})")
    assert recall_diff < 0.01, (
        f"Matched-recall threshold failed to match rule recall: "
        f"achieved recall={ml_metrics_matched['recall']:.4f} vs rule recall={rule_metrics['recall']:.4f} "
        f"(diff={recall_diff:.4f} >= 0.01). This must fail loudly, not silently report a wrong operating point."
    )

    # The OTHER operating point this threshold formula can hit at the
    # complementary quantile level (1 - rule_recall) - this happens to be
    # the value an earlier, buggy version of this function produced by
    # accident when asked for "matched recall". Kept here as a second,
    # honestly-labeled data point on the precision-recall curve, NOT as a
    # matched-recall claim.
    threshold_complement = evaluate.threshold_for_target_recall(oof_pred_C, y_true_at_risk, 1 - rule_metrics["recall"])
    ml_flag_complement = oof_pred_C < threshold_complement
    ml_metrics_complement = evaluate.at_risk_prf(y_true_at_risk, ml_flag_complement)
    print(f"  ML (extra operating point, threshold={threshold_complement:.2f}): "
          f"precision={ml_metrics_complement['precision']:.3f} recall={ml_metrics_complement['recall']:.3f} "
          f"F1={ml_metrics_complement['F1']:.3f} flagged_share={ml_metrics_complement['flagged_share']:.3f}")

    roc_auc = roc_auc_score(y_true_at_risk, -oof_pred_C)
    print(f"  ROC-AUC of -predicted_score: {roc_auc:.4f}")

    report = pd.DataFrame([
        {"method": "rule_based", "operating_point": "Fixed rule: prev_mean<50 OR no VLE clicks in last 14 days OR num_of_prev_attempts>=1", **rule_metrics},
        {"method": "ml_default_threshold_40", "operating_point": f"ML: flag if predicted score < {config.AT_RISK_SCORE_THRESHOLD} (same as the pass-mark threshold)", **ml_metrics_default},
        {"method": "ml_matched_recall", "operating_point": f"ML: threshold={threshold_matched:.2f}, chosen so recall matches rule_based recall ({rule_metrics['recall']:.3f})", **ml_metrics_matched},
        {"method": f"ml_threshold_{threshold_complement:.2f}_recall_{ml_metrics_complement['recall']:.3f}", "operating_point": f"ML: threshold={threshold_complement:.2f} - an additional operating point (NOT matched to the rule's recall)", **ml_metrics_complement},
    ])
    report["roc_auc"] = roc_auc
    report.to_csv(os.path.join(config.REPORTS_DIR, "at_risk_comparison.csv"), index=False)
    return report


# ===========================================================================
# STEP D: SPLIT CONFORMAL (both feature sets)
# ===========================================================================

def run_conformal(df, feature_cols, feature_set_name):
    section(f"SPLIT CONFORMAL ({feature_set_name}): 60/20/20 fit/calibration/test, alpha={config.CONFORMAL_ALPHA}")

    groups = df["id_student"].values
    gss1 = GroupShuffleSplit(n_splits=1, test_size=0.4, random_state=config.RANDOM_STATE)
    fit_idx, rest_idx = next(gss1.split(df, groups=groups))

    rest_groups = groups[rest_idx]
    gss2 = GroupShuffleSplit(n_splits=1, test_size=0.5, random_state=config.RANDOM_STATE)
    cal_rel_idx, test_rel_idx = next(gss2.split(df.iloc[rest_idx], groups=rest_groups))
    cal_idx = rest_idx[cal_rel_idx]
    test_idx = rest_idx[test_rel_idx]

    print(f"  fit: {len(fit_idx)} rows / {df.iloc[fit_idx]['id_student'].nunique()} students")
    print(f"  calibration: {len(cal_idx)} rows / {df.iloc[cal_idx]['id_student'].nunique()} students")
    print(f"  test: {len(test_idx)} rows / {df.iloc[test_idx]['id_student'].nunique()} students")

    X, y = df[feature_cols], df["score"].to_numpy(dtype=float)
    model = make_hgb_pipeline(feature_cols)
    model.fit(X.iloc[fit_idx], y[fit_idx])

    cal_pred = model.predict(X.iloc[cal_idx])
    cal_abs_err = np.abs(y[cal_idx] - cal_pred)
    q = evaluate.conformal_quantile(cal_abs_err, config.CONFORMAL_ALPHA)
    print(f"  conformal q = {q:.2f} (alpha={config.CONFORMAL_ALPHA})")

    test_pred = model.predict(X.iloc[test_idx])
    coverage, mean_width = evaluate.conformal_coverage_and_width(y[test_idx], test_pred, q)
    test_metrics = evaluate.regression_metrics(y[test_idx], test_pred)
    print(f"  TEST: coverage={coverage:.4f} (target {1 - config.CONFORMAL_ALPHA:.2f}) mean_width={mean_width:.2f}")
    print(f"  TEST: MAE={test_metrics['MAE']:.2f} RMSE={test_metrics['RMSE']:.2f} R2={test_metrics['R2']:.3f}")

    rows = [{"assessment_type": "ALL", "coverage": coverage, "mean_width": mean_width, "n": len(test_idx)}]
    for atype in sorted(df["assessment_type"].dropna().unique()):
        mask = (df.iloc[test_idx]["assessment_type"] == atype).to_numpy()
        if mask.sum() == 0:
            continue
        cov_a, width_a = evaluate.conformal_coverage_and_width(y[test_idx][mask], test_pred[mask], q)
        rows.append({"assessment_type": atype, "coverage": cov_a, "mean_width": width_a, "n": int(mask.sum())})
        print(f"    {atype}: coverage={cov_a:.4f} mean_width={width_a:.2f} (n={int(mask.sum())})")

    report = pd.DataFrame(rows)
    report.to_csv(os.path.join(config.REPORTS_DIR, f"conformal_{feature_set_name}.csv"), index=False)

    return {"model": model, "q": q, "alpha": config.CONFORMAL_ALPHA, "test_metrics": test_metrics,
            "coverage": coverage, "mean_width": mean_width}


# ===========================================================================
# STEP E: TEMPORAL VALIDATION (train on 2013B/2013J/2014B, test on 2014J)
# ===========================================================================

def run_temporal(df, feature_set_name):
    section(f"TEMPORAL VALIDATION ({feature_set_name}): train 2013B/2013J/2014B -> test 2014J")

    train_presentations = {"2013B", "2013J", "2014B"}
    test_presentation = "2014J"

    test_students = set(df.loc[df["code_presentation"] == test_presentation, "id_student"])
    train_mask = df["code_presentation"].isin(train_presentations) & ~df["id_student"].isin(test_students)
    test_mask = df["code_presentation"] == test_presentation

    train_df = df[train_mask]
    test_df = df[test_mask]
    print(f"  train rows: {len(train_df)} ({train_df['id_student'].nunique()} students, "
          f"presentations {sorted(train_df['code_presentation'].unique())})")
    print(f"  test rows: {len(test_df)} ({test_df['id_student'].nunique()} students, presentation {test_presentation})")
    print(f"  (train students overlapping with {test_presentation} were removed from train)")

    y_train = train_df["score"].to_numpy(dtype=float)
    y_test = test_df["score"].to_numpy(dtype=float)

    baseline_preds = evaluate.baseline_predictions(train_df, pd.Series(y_train), test_df)
    baseline_metrics = evaluate.regression_metrics(y_test, baseline_preds["baseline_mean_prev_scores"])
    print(f"  baseline (mean of previous scores): MAE={baseline_metrics['MAE']:.2f} "
          f"RMSE={baseline_metrics['RMSE']:.2f} R2={baseline_metrics['R2']:.3f}")

    rows = [{"config": "baseline_mean_prev_scores", **baseline_metrics}]

    if feature_set_name == "full_oulad":
        configs_to_run = [(k, v) for k, v in config.ABLATION_SETS.items() if k != "D_context_vle_no_prev"]
    else:
        configs_to_run = [("journal_compatible", config.JOURNAL_COMPATIBLE_FEATURES)]

    for cfg_name, feature_cols in configs_to_run:
        model = make_hgb_pipeline(feature_cols)
        model.fit(train_df[feature_cols], y_train)
        pred = model.predict(test_df[feature_cols])
        m = evaluate.regression_metrics(y_test, pred)
        rows.append({"config": cfg_name, **m})
        print(f"  {cfg_name}: MAE={m['MAE']:.2f} RMSE={m['RMSE']:.2f} R2={m['R2']:.3f}")

    report = pd.DataFrame(rows)
    report.to_csv(os.path.join(config.REPORTS_DIR, f"temporal_{feature_set_name}.csv"), index=False)
    return report


# ===========================================================================
# STEP F: SAVE FINAL BUNDLE
# ===========================================================================

def save_bundle(conformal_result, feature_cols, feature_set_name, trained_on_note):
    section(f"SAVE BUNDLE ({feature_set_name})")

    bundle = {
        "model": conformal_result["model"],
        "features": list(feature_cols),
        "conformal_q": conformal_result["q"],
        "alpha": conformal_result["alpha"],
        "feature_set": feature_set_name,
        "pass_mark": config.AT_RISK_SCORE_THRESHOLD,
        "trained_on": trained_on_note,
        "sklearn_version": sklearn.__version__,
        "trained_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
    path = os.path.join(config.MODELS_DIR, f"assessment_score_{feature_set_name}.joblib")
    joblib.dump(bundle, path)
    print(f"  Saved: {path}")
    print(f"  metadata (excluding model object): "
          f"{ {k: v for k, v in bundle.items() if k != 'model'} }")
    return path


# ===========================================================================
# ORCHESTRATION
# ===========================================================================

def print_cold_start_split(df, oof_pred, feature_set_name):
    y = df["score"].to_numpy(dtype=float)
    cold_mask = (df["prev_count"] == 0).to_numpy()
    mae_cold = evaluate.regression_metrics(y[cold_mask], oof_pred[cold_mask])["MAE"]
    mae_history = evaluate.regression_metrics(y[~cold_mask], oof_pred[~cold_mask])["MAE"]
    print(f"  [HistGradientBoosting OOF] cold-start MAE={mae_cold:.2f}  has-history MAE={mae_history:.2f}")
    pd.DataFrame([{"feature_set": feature_set_name, "MAE_cold_start": mae_cold, "MAE_has_history": mae_history}]).to_csv(
        os.path.join(config.REPORTS_DIR, f"cold_start_split_{feature_set_name}.csv"), index=False
    )


def run_feature_set(df, feature_set_name):
    feature_cols = config.FULL_OULAD_FEATURES if feature_set_name == "full_oulad" else config.JOURNAL_COMPATIBLE_FEATURES

    if feature_set_name == "full_oulad":
        _, oof_by_model = run_baselines_and_models(df, feature_cols, feature_set_name)
        ablation_report, oof_by_config = run_ablation(df)
        run_at_risk(df, oof_by_config["C_prev_context_vle"])
    else:
        _, oof_by_model = run_baselines_and_models(df, feature_cols, feature_set_name)
        print_cold_start_split(df, oof_by_model["HistGradientBoosting"], feature_set_name)

    conformal_result = run_conformal(df, feature_cols, feature_set_name)
    run_temporal(df, feature_set_name)

    trained_on = (
        f"OULAD 2013-2014 presentations (all 22 module-presentations), "
        f"conformal fit split (~60% of students, GroupShuffleSplit random_state={config.RANDOM_STATE})"
    )
    save_bundle(conformal_result, feature_cols, feature_set_name, trained_on)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--feature-set", choices=config.FEATURE_SETS, default=None)
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--skip-verify", action="store_true", help="skip the automatic verify.py checks (debug only)")
    args = parser.parse_args()

    if not args.all and not args.feature_set:
        parser.error("pass --feature-set {full_oulad,journal_compatible} or --all")

    df = build_training_table(use_cache=True)

    if not args.skip_verify:
        section("AUTOMATIC VERIFICATION (verify.py)")
        row_counts_ok = verify_row_counts(df)
        reference_rows_ok = verify_reference_rows(df)
        shuffled_ok, shuffled_metrics = verify_shuffled_target(df)
        if not (row_counts_ok and reference_rows_ok and shuffled_ok):
            raise SystemExit("VERIFICATION FAILED - see output above. Refusing to train until this is resolved.")
        print("\nAll verification checks passed. Proceeding to training.")

    targets = list(config.FEATURE_SETS) if args.all else [args.feature_set]
    for feature_set_name in targets:
        section(f"##### FEATURE SET: {feature_set_name} #####")
        run_feature_set(df, feature_set_name)


if __name__ == "__main__":
    main()
