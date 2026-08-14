"""
build_features.py

Builds two clean, model-ready feature tables for the at-risk student predictor:
  1. OULAD (Open University Learning Analytics Dataset) -> features/oulad_features.csv
  2. Students Performance Dataset               -> features/performance_features.csv

The two datasets have incompatible schemas (different populations, different
signals) so they are kept as two separate feature tables / two separate model
families rather than force-merged into one.

Run from anywhere:
    python build_features.py
"""

import os
import time

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, "..", "..", "datasets", "study-planner"))
FEATURES_DIR = os.path.join(SCRIPT_DIR, "features")
os.makedirs(FEATURES_DIR, exist_ok=True)

PERFORMANCE_CSV = os.path.join(DATA_DIR, "Students Performance Dataset.csv")
STUDENT_INFO_CSV = os.path.join(DATA_DIR, "studentInfo.csv")
ASSESSMENTS_CSV = os.path.join(DATA_DIR, "assessments.csv")
STUDENT_ASSESSMENT_CSV = os.path.join(DATA_DIR, "studentAssessment.csv")
STUDENT_VLE_CSV = os.path.join(DATA_DIR, "studentVle.csv")
STUDENT_REGISTRATION_CSV = os.path.join(DATA_DIR, "studentRegistration.csv")

VLE_CHUNKSIZE = 500_000  # studentVle.csv is ~450MB; read it in chunks

KEY_COLS = ["code_module", "code_presentation", "id_student"]


def log(msg):
    print(f"[build_features] {msg}", flush=True)


# ---------------------------------------------------------------------------
# 1. OULAD pipeline
# ---------------------------------------------------------------------------
def build_oulad_assessment_features():
    """Merge assessments + studentAssessment, compute per-submission lateness,
    then aggregate to one row per (code_module, code_presentation, id_student)."""
    log("Loading assessments.csv and studentAssessment.csv ...")
    assessments = pd.read_csv(ASSESSMENTS_CSV)
    student_assessment = pd.read_csv(STUDENT_ASSESSMENT_CSV)

    # "date" (deadline) and "score" can contain "?" for missing -> coerce to numeric
    assessments["date"] = pd.to_numeric(assessments["date"], errors="coerce")
    student_assessment["date_submitted"] = pd.to_numeric(
        student_assessment["date_submitted"], errors="coerce"
    )
    student_assessment["score"] = pd.to_numeric(student_assessment["score"], errors="coerce")

    merged = student_assessment.merge(
        assessments[["id_assessment", "code_module", "code_presentation", "date", "weight", "assessment_type"]],
        on="id_assessment",
        how="left",
    )

    merged["days_late"] = merged["date_submitted"] - merged["date"]
    merged["is_late"] = (merged["days_late"] > 0).astype(int)

    agg = (
        merged.groupby(KEY_COLS)
        .agg(
            num_assessments_submitted=("id_assessment", "count"),
            avg_score=("score", "mean"),
            avg_days_late=("days_late", "mean"),
            num_late_submissions=("is_late", "sum"),
            avg_assessment_weight=("weight", "mean"),
        )
        .reset_index()
    )
    log(f"Assessment features built for {len(agg)} student-module rows.")
    return agg


def build_oulad_vle_features():
    """Aggregate studentVle.csv (large file) into per-student weekly click
    totals using chunked reading so the whole 450MB file is never held in
    memory at once."""
    log(f"Aggregating studentVle.csv in chunks of {VLE_CHUNKSIZE:,} rows ...")

    partial_frames = []
    rows_seen = 0
    t0 = time.time()

    reader = pd.read_csv(
        STUDENT_VLE_CSV,
        usecols=["code_module", "code_presentation", "id_student", "date", "sum_click"],
        chunksize=VLE_CHUNKSIZE,
    )

    for i, chunk in enumerate(reader):
        chunk["date"] = pd.to_numeric(chunk["date"], errors="coerce")
        chunk["week"] = chunk["date"] // 7

        chunk_agg = (
            chunk.groupby(KEY_COLS)
            .agg(
                total_clicks=("sum_click", "sum"),
                num_active_days=("date", "nunique"),
                num_active_weeks=("week", "nunique"),
                first_active_date=("date", "min"),
                last_active_date=("date", "max"),
            )
            .reset_index()
        )
        partial_frames.append(chunk_agg)
        rows_seen += len(chunk)
        log(f"  ... processed chunk {i + 1} ({rows_seen:,} rows so far)")

    # Combine partial per-chunk aggregates with a second groupby pass.
    combined = pd.concat(partial_frames, ignore_index=True)
    vle_features = (
        combined.groupby(KEY_COLS)
        .agg(
            total_clicks=("total_clicks", "sum"),
            num_active_days=("num_active_days", "sum"),
            num_active_weeks=("num_active_weeks", "sum"),
            first_active_date=("first_active_date", "min"),
            last_active_date=("last_active_date", "max"),
        )
        .reset_index()
    )
    vle_features["avg_weekly_clicks"] = vle_features["total_clicks"] / vle_features[
        "num_active_weeks"
    ].replace(0, np.nan)
    vle_features["engagement_span_days"] = (
        vle_features["last_active_date"] - vle_features["first_active_date"]
    )

    log(f"VLE engagement features built for {len(vle_features)} student-module rows "
        f"in {time.time() - t0:.1f}s.")
    return vle_features


def build_oulad_features():
    log("=" * 70)
    log("Building OULAD feature table")
    log("=" * 70)

    log("Loading studentInfo.csv ...")
    student_info = pd.read_csv(STUDENT_INFO_CSV)

    log("Loading studentRegistration.csv ...")
    registration = pd.read_csv(STUDENT_REGISTRATION_CSV)
    registration["date_registration"] = pd.to_numeric(
        registration["date_registration"], errors="coerce"
    )

    assessment_features = build_oulad_assessment_features()
    vle_features = build_oulad_vle_features()

    df = student_info.merge(assessment_features, on=KEY_COLS, how="left")
    df = df.merge(vle_features, on=KEY_COLS, how="left")
    df = df.merge(
        registration[KEY_COLS + ["date_registration"]], on=KEY_COLS, how="left"
    )

    # imd_band uses "?" for missing -> treat as its own "Unknown" category
    df["imd_band"] = df["imd_band"].replace("?", "Unknown").fillna("Unknown")

    # Students who never submitted anything / never clicked anything are
    # genuinely at-risk signals, not data errors -> fill engagement counts
    # with 0 rather than dropping the rows.
    zero_fill_cols = [
        "num_assessments_submitted",
        "num_late_submissions",
        "total_clicks",
        "num_active_days",
        "num_active_weeks",
    ]
    df[zero_fill_cols] = df[zero_fill_cols].fillna(0)

    df["num_of_prev_attempts"] = pd.to_numeric(df["num_of_prev_attempts"], errors="coerce")
    df["studied_credits"] = pd.to_numeric(df["studied_credits"], errors="coerce")

    df["at_risk"] = df["final_result"].isin(["Fail", "Withdrawn"]).astype(int)

    # final_result is the raw label at_risk was derived from (a direct
    # restatement of it) -> drop so it can't leak back in as a feature.
    # code_module/code_presentation/id_student are kept: they're the group
    # keys StratifiedGroupKFold needs in train_models.py, not features.
    df = df.drop(columns=["final_result"])

    log(f"OULAD feature table complete: {df.shape[0]} rows, {df.shape[1]} columns.")
    log(f"at_risk positive rate: {df['at_risk'].mean():.3f}")
    return df


# ---------------------------------------------------------------------------
# 2. Students Performance Dataset pipeline
# ---------------------------------------------------------------------------
def build_performance_features():
    log("=" * 70)
    log("Building Students Performance feature table")
    log("=" * 70)

    log("Loading Students Performance Dataset.csv ...")
    df = pd.read_csv(PERFORMANCE_CSV)

    # ~1,025 rows are missing Parent_Education_Level. Rather than imputing
    # with the mode (which would fabricate a specific education level for
    # ~20% of the data), we keep "Unknown" as its own category so the model
    # can learn whether missingness itself is informative.
    df["Parent_Education_Level"] = df["Parent_Education_Level"].fillna("Unknown")

    df["at_risk"] = df["Grade"].isin(["D", "F"]).astype(int)

    # Drop columns that don't belong in a model-ready feature table:
    #   - Student_ID / First_Name / Last_Name / Email: identifiers/PII, no
    #     predictive value and shouldn't be persisted alongside a risk label.
    #   - Grade / Total_Score / Final_Score: Grade is a deterministic
    #     threshold of Total_Score, and Total_Score is itself a weighted sum
    #     of Final_Score + the other score columns. Keeping any of the three
    #     would let a model trivially reconstruct at_risk instead of learning
    #     a genuine early-warning signal from mid-course indicators.
    unwanted_cols = [
        "Student_ID", "First_Name", "Last_Name", "Email",
        "Grade", "Total_Score", "Final_Score",
    ]
    df = df.drop(columns=[c for c in unwanted_cols if c in df.columns])

    log(f"Dropped identifier/leakage columns: {unwanted_cols}")
    log(f"Performance feature table complete: {df.shape[0]} rows, {df.shape[1]} columns.")
    log(f"at_risk positive rate: {df['at_risk'].mean():.3f}")
    return df


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    t_start = time.time()

    performance_df = build_performance_features()
    perf_out = os.path.join(FEATURES_DIR, "performance_features.csv")
    performance_df.to_csv(perf_out, index=False)
    log(f"Saved -> {perf_out}")

    print()
    print("Performance feature table shape:", performance_df.shape)
    print(performance_df.head())
    print()

    oulad_df = build_oulad_features()
    oulad_out = os.path.join(FEATURES_DIR, "oulad_features.csv")
    oulad_df.to_csv(oulad_out, index=False)
    log(f"Saved -> {oulad_out}")

    print()
    print("OULAD feature table shape:", oulad_df.shape)
    print(oulad_df.head())

    log(f"Done in {time.time() - t_start:.1f}s total.")
