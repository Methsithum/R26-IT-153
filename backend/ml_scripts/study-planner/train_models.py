"""
train_models.py

Trains Logistic Regression, Random Forest, and XGBoost at-risk classifiers
for both feature tables produced by build_features.py.

- OULAD: split with StratifiedGroupKFold grouped on id_student so the same
  student never appears in more than one of train/validation/test.
- Students Performance Dataset: plain stratified train/val/test split (each
  row is already a unique student).

For each dataset, hyperparameters for Random Forest and XGBoost are searched
with RandomizedSearchCV using a PredefinedSplit that scores candidates only
on the validation fold. The test set is never touched during search.

Run from anywhere:
    python train_models.py
"""

import json
import os
import time

import joblib
import numpy as np
import pandas as pd
from scipy.stats import randint, uniform
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import (
    PredefinedSplit,
    RandomizedSearchCV,
    StratifiedGroupKFold,
    train_test_split,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from xgboost import XGBClassifier

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FEATURES_DIR = os.path.join(SCRIPT_DIR, "features")
MODELS_DIR = os.path.normpath(
    os.path.join(SCRIPT_DIR, "..", "..", "trained-models", "study-planner", "models")
)
RESULTS_DIR = os.path.normpath(
    os.path.join(SCRIPT_DIR, "..", "..", "trained-models", "study-planner", "results")
)
os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(RESULTS_DIR, exist_ok=True)

RANDOM_STATE = 42
N_SEARCH_ITER = 20


def log(msg):
    print(f"[train_models] {msg}", flush=True)


# ---------------------------------------------------------------------------
# Column definitions per dataset
# ---------------------------------------------------------------------------
OULAD_TARGET = "at_risk"
OULAD_GROUP = "id_student"
OULAD_CATEGORICAL = ["gender", "region", "highest_education", "imd_band", "age_band", "disability"]
OULAD_NUMERIC = [
    "num_of_prev_attempts",
    "studied_credits",
    "num_assessments_submitted",
    "avg_score",
    "avg_days_late",
    "num_late_submissions",
    "avg_assessment_weight",
    "total_clicks",
    "num_active_days",
    "num_active_weeks",
    "first_active_date",
    "last_active_date",
    "avg_weekly_clicks",
    "engagement_span_days",
    "date_registration",
]

PERF_TARGET = "at_risk"
# Student_ID/First_Name/Last_Name/Email (PII) and Grade/Total_Score/Final_Score
# (leakage source of at_risk) are already stripped out in build_features.py.
# Only mid-course signals (available before finals) remain as features.
PERF_CATEGORICAL = [
    "Gender",
    "Department",
    "Extracurricular_Activities",
    "Internet_Access_at_Home",
    "Parent_Education_Level",
    "Family_Income_Level",
]
PERF_NUMERIC = [
    "Age",
    "Attendance (%)",
    "Midterm_Score",
    "Assignments_Avg",
    "Quizzes_Avg",
    "Participation_Score",
    "Projects_Score",
    "Study_Hours_per_Week",
    "Stress_Level (1-10)",
    "Sleep_Hours_per_Night",
]


def make_preprocessor(numeric_cols, categorical_cols, scale_numeric):
    numeric_steps = [("impute", SimpleImputer(strategy="median"))]
    if scale_numeric:
        numeric_steps.append(("scale", StandardScaler()))
    numeric_pipe = Pipeline(numeric_steps)

    categorical_pipe = Pipeline(
        [
            ("impute", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
        ]
    )

    return ColumnTransformer(
        [
            ("num", numeric_pipe, numeric_cols),
            ("cat", categorical_pipe, categorical_cols),
        ]
    )


# ---------------------------------------------------------------------------
# Splitting
# ---------------------------------------------------------------------------
def split_oulad(df):
    """Two-stage StratifiedGroupKFold to approximate a 70/15/15 split while
    keeping every id_student entirely inside one of train/val/test."""
    X = df.drop(columns=[OULAD_TARGET])
    y = df[OULAD_TARGET].values
    groups = df[OULAD_GROUP].values

    # Stage 1: carve off ~1/7 (~14.3%) as test.
    sgkf_test = StratifiedGroupKFold(n_splits=7, shuffle=True, random_state=RANDOM_STATE)
    trainval_idx, test_idx = next(sgkf_test.split(X, y, groups))

    # Stage 2: from the remaining ~85.7%, carve off ~1/6 (~14.3% of total) as validation.
    X_trainval = X.iloc[trainval_idx]
    y_trainval = y[trainval_idx]
    groups_trainval = groups[trainval_idx]

    sgkf_val = StratifiedGroupKFold(n_splits=6, shuffle=True, random_state=RANDOM_STATE)
    train_idx_rel, val_idx_rel = next(sgkf_val.split(X_trainval, y_trainval, groups_trainval))

    train_idx = trainval_idx[train_idx_rel]
    val_idx = trainval_idx[val_idx_rel]

    assert set(groups[train_idx]) & set(groups[val_idx]) == set()
    assert set(groups[train_idx]) & set(groups[test_idx]) == set()
    assert set(groups[val_idx]) & set(groups[test_idx]) == set()

    return (
        X.iloc[train_idx], y[train_idx],
        X.iloc[val_idx], y[val_idx],
        X.iloc[test_idx], y[test_idx],
    )


def split_performance(df):
    X = df.drop(columns=[PERF_TARGET])
    y = df[PERF_TARGET].values

    X_trainval, X_test, y_trainval, y_test = train_test_split(
        X, y, test_size=0.15, stratify=y, random_state=RANDOM_STATE
    )
    # 0.15 / 0.85 = ~0.1765 -> leaves 70% train, 15% val of the original whole.
    X_train, X_val, y_train, y_val = train_test_split(
        X_trainval, y_trainval, test_size=0.15 / 0.85, stratify=y_trainval, random_state=RANDOM_STATE
    )
    return X_train, y_train, X_val, y_val, X_test, y_test


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------
def tune_with_validation(estimator, param_distributions, X_train, y_train, X_val, y_val, name):
    """RandomizedSearchCV scored only on the validation fold via PredefinedSplit,
    so the test set is never seen during hyperparameter search."""
    X_combined = pd.concat([X_train, X_val], axis=0).reset_index(drop=True)
    y_combined = np.concatenate([y_train, y_val])
    # -1 = always in the training fold, 0 = held out as the single validation fold
    test_fold = np.concatenate([np.full(len(y_train), -1), np.full(len(y_val), 0)])
    ps = PredefinedSplit(test_fold)

    search = RandomizedSearchCV(
        estimator,
        param_distributions=param_distributions,
        n_iter=N_SEARCH_ITER,
        scoring="f1",
        cv=ps,
        refit=False,
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    t0 = time.time()
    search.fit(X_combined, y_combined)
    log(f"  {name} search done in {time.time() - t0:.1f}s. Best val F1={search.best_score_:.4f}, "
        f"params={search.best_params_}")
    return search.best_params_


def train_dataset(dataset_name, X_train, y_train, X_val, y_val, X_test, y_test,
                   numeric_cols, categorical_cols):
    log(f"Training set: {len(X_train)} rows | Validation: {len(X_val)} | Test: {len(X_test)}")
    log(f"Train at_risk rate: {y_train.mean():.3f}")

    trained = {}
    feature_columns = numeric_cols + categorical_cols

    # ---- Logistic Regression (baseline) -----------------------------------
    log("Training Logistic Regression ...")
    lr_preprocessor = make_preprocessor(numeric_cols, categorical_cols, scale_numeric=True)
    lr_pipe = Pipeline(
        [
            ("preprocess", lr_preprocessor),
            ("clf", LogisticRegression(
                class_weight="balanced", max_iter=1000, random_state=RANDOM_STATE
            )),
        ]
    )
    lr_pipe.fit(X_train[feature_columns], y_train)
    trained["logistic_regression"] = lr_pipe
    log("  Logistic Regression trained.")

    # ---- Random Forest ------------------------------------------------------
    log("Tuning Random Forest on validation fold ...")
    rf_preprocessor = make_preprocessor(numeric_cols, categorical_cols, scale_numeric=False)
    rf_base = Pipeline(
        [
            ("preprocess", rf_preprocessor),
            ("clf", RandomForestClassifier(
                class_weight="balanced", random_state=RANDOM_STATE, n_jobs=-1
            )),
        ]
    )
    rf_param_dist = {
        "clf__n_estimators": randint(100, 600),
        "clf__max_depth": randint(3, 30),
        "clf__min_samples_split": randint(2, 20),
    }
    rf_best_params = tune_with_validation(
        rf_base, rf_param_dist,
        X_train[feature_columns], y_train, X_val[feature_columns], y_val,
        "Random Forest",
    )
    rf_final = Pipeline(
        [
            ("preprocess", make_preprocessor(numeric_cols, categorical_cols, scale_numeric=False)),
            ("clf", RandomForestClassifier(
                class_weight="balanced", random_state=RANDOM_STATE, n_jobs=-1,
                **{k.replace("clf__", ""): v for k, v in rf_best_params.items()}
            )),
        ]
    )
    rf_final.fit(X_train[feature_columns], y_train)
    trained["random_forest"] = rf_final
    log("  Random Forest trained with tuned hyperparameters.")

    # ---- XGBoost --------------------------------------------------------------
    log("Tuning XGBoost on validation fold ...")
    scale_pos_weight = (y_train == 0).sum() / max((y_train == 1).sum(), 1)
    xgb_preprocessor = make_preprocessor(numeric_cols, categorical_cols, scale_numeric=False)
    xgb_base = Pipeline(
        [
            ("preprocess", xgb_preprocessor),
            ("clf", XGBClassifier(
                objective="binary:logistic",
                eval_metric="logloss",
                scale_pos_weight=scale_pos_weight,
                random_state=RANDOM_STATE,
                n_jobs=-1,
            )),
        ]
    )
    xgb_param_dist = {
        "clf__n_estimators": randint(100, 600),
        "clf__max_depth": randint(2, 12),
        "clf__learning_rate": uniform(0.01, 0.29),
    }
    xgb_best_params = tune_with_validation(
        xgb_base, xgb_param_dist,
        X_train[feature_columns], y_train, X_val[feature_columns], y_val,
        "XGBoost",
    )
    xgb_final = Pipeline(
        [
            ("preprocess", make_preprocessor(numeric_cols, categorical_cols, scale_numeric=False)),
            ("clf", XGBClassifier(
                objective="binary:logistic",
                eval_metric="logloss",
                scale_pos_weight=scale_pos_weight,
                random_state=RANDOM_STATE,
                n_jobs=-1,
                **{k.replace("clf__", ""): v for k, v in xgb_best_params.items()}
            )),
        ]
    )
    xgb_final.fit(X_train[feature_columns], y_train)
    trained["xgboost"] = xgb_final
    log("  XGBoost trained with tuned hyperparameters.")

    # ---- Save models + feature schema ----------------------------------------
    for model_name, pipe in trained.items():
        model_path = os.path.join(MODELS_DIR, f"{dataset_name}_{model_name}.pkl")
        joblib.dump(pipe, model_path)
        log(f"  Saved -> {model_path}")

    schema = {
        "numeric_columns": numeric_cols,
        "categorical_columns": categorical_cols,
        "feature_columns": feature_columns,
    }
    schema_path = os.path.join(MODELS_DIR, f"{dataset_name}_feature_schema.json")
    with open(schema_path, "w") as f:
        json.dump(schema, f, indent=2)
    log(f"  Saved feature schema -> {schema_path}")

    return trained, {
        "X_test": X_test[feature_columns], "y_test": y_test,
        "X_val": X_val[feature_columns], "y_val": y_val,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    t_start = time.time()

    log("=" * 70)
    log("Students Performance Dataset")
    log("=" * 70)
    perf_df = pd.read_csv(os.path.join(FEATURES_DIR, "performance_features.csv"))
    perf_splits = split_performance(perf_df)
    perf_models, perf_holdout = train_dataset(
        "performance", *perf_splits, PERF_NUMERIC, PERF_CATEGORICAL
    )
    joblib.dump(perf_holdout, os.path.join(MODELS_DIR, "performance_holdout_data.pkl"))

    log("=" * 70)
    log("OULAD Dataset")
    log("=" * 70)
    oulad_df = pd.read_csv(os.path.join(FEATURES_DIR, "oulad_features.csv"))
    oulad_splits = split_oulad(oulad_df)
    oulad_models, oulad_holdout = train_dataset(
        "oulad", *oulad_splits, OULAD_NUMERIC, OULAD_CATEGORICAL
    )
    joblib.dump(oulad_holdout, os.path.join(MODELS_DIR, "oulad_holdout_data.pkl"))

    log(f"All training complete in {time.time() - t_start:.1f}s.")
    log("Run evaluate.py next to score models on the test set and generate reports/plots.")
