"""
evaluate.py - shared preprocessing, metrics, baseline, and conformal helpers
for the assessment_score training pipeline. Imported by train.py; not meant
to be run standalone.
"""

import os
import sys

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import config


def split_feature_types(feature_cols):
    numeric = [c for c in feature_cols if c in config.NUMERIC_FEATURES_ALL]
    categorical = [c for c in feature_cols if c in config.CATEGORICAL_FEATURES_ALL]
    unknown = [c for c in feature_cols if c not in numeric and c not in categorical]
    if unknown:
        raise ValueError(f"Feature(s) not classified as numeric or categorical in config: {unknown}")
    return numeric, categorical


def build_preprocessor(feature_cols):
    numeric, categorical = split_feature_types(feature_cols)
    transformers = []
    if numeric:
        numeric_pipe = Pipeline([
            ("impute", SimpleImputer(strategy="median", add_indicator=True)),
            ("scale", StandardScaler()),
        ])
        transformers.append(("num", numeric_pipe, numeric))
    if categorical:
        categorical_pipe = Pipeline([
            ("impute", SimpleImputer(strategy="constant", fill_value="missing")),
            ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
        ])
        transformers.append(("cat", categorical_pipe, categorical))
    return ColumnTransformer(transformers)


def regression_metrics(y_true, y_pred):
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    mae = mean_absolute_error(y_true, y_pred)
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    r2 = r2_score(y_true, y_pred)
    return {"MAE": mae, "RMSE": rmse, "R2": r2}


# ===========================================================================
# BASELINES
# ===========================================================================

def baseline_predictions(X_train, y_train, X_eval):
    """Returns {baseline_name: predictions_on_X_eval} for the 3 required baselines."""
    train_mean = float(y_train.mean())

    last_prev = X_eval["prev_last"].astype(float)
    last_prev_pred = last_prev.fillna(train_mean).to_numpy()

    prev_mean_col = X_eval["prev_mean"].astype(float)
    prev_mean_pred = prev_mean_col.fillna(train_mean).to_numpy()

    training_mean_pred = np.full(len(X_eval), train_mean)

    return {
        "baseline_training_mean": training_mean_pred,
        "baseline_last_prev_score": last_prev_pred,
        "baseline_mean_prev_scores": prev_mean_pred,
    }


# ===========================================================================
# CONFORMAL (split conformal, absolute-residual score)
# ===========================================================================

def conformal_quantile(abs_errors, alpha):
    """
    q = quantile of calibration |errors| at level ceil((n+1)(1-alpha))/n,
    method='higher' (i.e. take the ceiling-indexed order statistic, matching
    the standard split-conformal finite-sample guarantee).
    """
    n = len(abs_errors)
    level = np.ceil((n + 1) * (1 - alpha)) / n
    level = min(level, 1.0)
    return float(np.quantile(abs_errors, level, method="higher"))


def conformal_interval(y_pred, q):
    lower = np.clip(y_pred - q, 0, 100)
    upper = np.clip(y_pred + q, 0, 100)
    return lower, upper


def conformal_coverage_and_width(y_true, y_pred, q):
    lower, upper = conformal_interval(y_pred, q)
    covered = (y_true >= lower) & (y_true <= upper)
    coverage = float(np.mean(covered))
    mean_width = float(np.mean(upper - lower))
    return coverage, mean_width


# ===========================================================================
# AT-RISK CLASSIFICATION METRICS (from a continuous score, at a threshold)
# ===========================================================================

def at_risk_prf(y_true_at_risk, flagged):
    """y_true_at_risk, flagged: boolean arrays. Returns precision, recall, F1, flagged_share."""
    y_true_at_risk = np.asarray(y_true_at_risk, dtype=bool)
    flagged = np.asarray(flagged, dtype=bool)
    tp = int(np.sum(flagged & y_true_at_risk))
    fp = int(np.sum(flagged & ~y_true_at_risk))
    fn = int(np.sum(~flagged & y_true_at_risk))
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
    flagged_share = float(np.mean(flagged))
    return {"precision": precision, "recall": recall, "F1": f1, "flagged_share": flagged_share}


def threshold_for_target_recall(predicted_score, y_true_at_risk, target_recall):
    """
    Find the predicted-score threshold T such that flagging (predicted_score < T)
    gives approximately `target_recall` recall.

    Flagging is "predicted_score < T", so recall = fraction of TRUE at-risk
    rows whose predicted_score falls below T. To make that fraction equal
    target_recall, T must be the target_recall-th quantile of predicted_score
    among the true at-risk rows (NOT the (1 - target_recall)-th quantile -
    that was the original bug here: it produced a threshold whose recall was
    1 - target_recall instead of target_recall).
    """
    true_at_risk_scores = np.asarray(predicted_score)[np.asarray(y_true_at_risk, dtype=bool)]
    if len(true_at_risk_scores) == 0:
        return float(np.min(predicted_score))
    q = min(max(target_recall, 0.0), 1.0)
    return float(np.quantile(true_at_risk_scores, q))
