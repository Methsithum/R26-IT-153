"""
data_prep.py - loads OULAD, builds the leakage-free (student, assessment)
training table for assessment score prediction.

One training row = one (student, assessment) submission with a real score.
See README.md for the full leakage-avoidance rules. In short:
  - `final_result` is never used anywhere.
  - VLE features use only clicks strictly BEFORE the assessment's due date.
  - Previous-score features use only the same student's assessments in the
    same module-presentation with a strictly earlier due date.

Run as a file:
    venv/Scripts/python ml_scripts/journal/assessment_score/data_prep.py
"""

import os
import sys
import time

import numpy as np
import pandas as pd

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import config


def section(title):
    print("\n" + "=" * 90)
    print(title)
    print("=" * 90)


# ===========================================================================
# 1. LOAD + SCHEMA CHECK
# ===========================================================================

def load_raw_frames():
    section("1. LOAD RAW CSVs AND PRINT SCHEMA")
    frames = {}
    for name, path in [
        ("assessments", config.ASSESSMENTS_CSV),
        ("studentAssessment", config.STUDENT_ASSESSMENT_CSV),
        ("studentInfo", config.STUDENT_INFO_CSV),
        ("studentRegistration", config.STUDENT_REGISTRATION_CSV),
    ]:
        df = pd.read_csv(path, na_values=["?"])
        frames[name] = df
        print(f"\n--- {name} ({path}) ---")
        print(f"shape: {df.shape}")
        print(df.dtypes)
    return frames


def verify_expected_columns(frames):
    expected = {
        "assessments": ["id_assessment", "code_module", "code_presentation", "assessment_type", "date", "weight"],
        "studentAssessment": ["id_assessment", "id_student", "date_submitted", "is_banked", "score"],
        "studentInfo": [
            "code_module", "code_presentation", "id_student", "gender", "region",
            "highest_education", "imd_band", "age_band", "num_of_prev_attempts",
            "studied_credits", "disability", "final_result",
        ],
        "studentRegistration": [
            "code_module", "code_presentation", "id_student",
            "date_registration", "date_unregistration",
        ],
    }
    section("VERIFY EXPECTED COLUMNS EXIST")
    ok = True
    for name, cols in expected.items():
        missing = [c for c in cols if c not in frames[name].columns]
        if missing:
            ok = False
            print(f"*** MISSING in {name}: {missing} ***")
        else:
            print(f"{name}: all {len(cols)} expected columns present.")
    if not ok:
        raise SystemExit("Schema verification FAILED - see missing columns above. Stopping before any data prep.")
    print("\nSchema verification PASSED.")


# ===========================================================================
# 2. FILTER (score -> is_banked -> missing due date) THEN JOIN CONTEXT
# ===========================================================================

def filter_and_join(frames):
    section("2. FILTER ROWS (score -> is_banked -> missing due date), THEN JOIN CONTEXT")

    sa = frames["studentAssessment"].copy()
    print(f"studentAssessment rows: {len(sa)}")

    before = len(sa)
    sa = sa[sa["score"].notna()].copy()
    print(f"After dropping missing score: {len(sa)} (dropped {before - len(sa)})")

    before = len(sa)
    sa = sa[sa["is_banked"] != 1].copy()
    print(f"After dropping is_banked==1: {len(sa)} (dropped {before - len(sa)})")

    assessments = frames["assessments"]
    df = sa.merge(assessments, on="id_assessment", how="left")
    before = len(df)
    df = df[df["date"].notna()].copy()
    print(f"After dropping assessments with missing due date (date): {len(df)} (dropped {before - len(df)})")

    # --- Context joins (left - a submission with no matching demographic row
    # is still a valid training row; missing context features are imputed) ---
    student_info_cols = [
        "code_module", "code_presentation", "id_student", "gender",
        "highest_education", "imd_band", "age_band", "disability",
        "num_of_prev_attempts", "studied_credits",
    ]
    df = df.merge(frames["studentInfo"][student_info_cols],
                   on=["code_module", "code_presentation", "id_student"], how="left")

    reg_cols = ["code_module", "code_presentation", "id_student", "date_registration"]
    df = df.merge(frames["studentRegistration"][reg_cols],
                   on=["code_module", "code_presentation", "id_student"], how="left")

    print(f"After joining studentInfo + studentRegistration context: {df.shape}")

    n_students = df["id_student"].nunique()
    n_module_presentations = df[["code_module", "code_presentation"]].drop_duplicates().shape[0]
    at_risk_rate = (df["score"] < config.AT_RISK_SCORE_THRESHOLD).mean()
    n_zero_prev = None  # computed after previous-score features exist

    print(f"\nUnique students: {n_students}")
    print(f"Unique module-presentations: {n_module_presentations}")
    print(f"At-risk rate (score < {config.AT_RISK_SCORE_THRESHOLD}): {at_risk_rate:.4f} ({at_risk_rate*100:.2f}%)")

    return df


# ===========================================================================
# 3. PREVIOUS-SCORE FEATURES (leakage-free: strictly earlier due date only)
# ===========================================================================

def add_previous_score_features(df):
    section("3. PREVIOUS-SCORE FEATURES (prev_mean, prev_last, prev_count)")

    group_keys = ["id_student", "code_module", "code_presentation"]
    df = df.sort_values(group_keys + ["date", "id_assessment"]).reset_index(drop=True)

    # A student can have >1 assessment tied on the exact same due date (e.g. a
    # TMA and a CMA both due on day 152). Those are simultaneous, not
    # sequential - neither is "strictly earlier" than the other, so a plain
    # positional shift(1) would wrongly treat one as the other's "previous"
    # assessment. Instead, aggregate to one row per (group, date) first, then
    # compute cumulative stats over PRIOR DISTINCT DATES only, and broadcast
    # those back to every row sharing a date (they all see the same history).
    date_level = (
        df.groupby(group_keys + ["date"])["score"]
        .agg(count="count", sum="sum")
        .reset_index()
        .sort_values(group_keys + ["date"])
    )
    g = date_level.groupby(group_keys)
    # cumsum() includes the current date's own count/sum; subtracting it
    # leaves the cumulative total over strictly-earlier dates only.
    date_level["prev_count"] = g["count"].cumsum() - date_level["count"]
    prev_sum = g["sum"].cumsum() - date_level["sum"]
    date_level["prev_mean"] = np.where(date_level["prev_count"] > 0, prev_sum / date_level["prev_count"], np.nan)

    # prev_last: the score of the assessment at the most recent STRICTLY
    # earlier date. When that earlier date itself has >1 tied assessment, the
    # one with the smallest id_assessment is used as the deterministic
    # tie-break (matches the reference values this was verified against).
    first_by_id = (
        df.sort_values(group_keys + ["date", "id_assessment"])
        .groupby(group_keys + ["date"], as_index=False)["score"]
        .first()
        .rename(columns={"score": "_first_score_at_date"})
    )
    date_level = date_level.merge(first_by_id, on=group_keys + ["date"], how="left")
    date_level["prev_last"] = date_level.groupby(group_keys)["_first_score_at_date"].shift(1)

    df = df.merge(
        date_level[group_keys + ["date", "prev_mean", "prev_last", "prev_count"]],
        on=group_keys + ["date"], how="left",
    )

    n_zero_prev = int((df["prev_count"] == 0).sum())
    print(f"Rows with prev_count == 0 (first graded assessment in that module-presentation): {n_zero_prev}")
    print(f"prev_mean / prev_last are NaN for those rows (no earlier assessment exists yet) - "
          f"left as NaN for the imputer, not filled here.")

    return df, n_zero_prev


# ===========================================================================
# 4. VLE DAILY AGGREGATION (chunked, cached) + PRE-DUE-DATE VLE FEATURES
# ===========================================================================

def build_vle_daily(force=False):
    section("4. AGGREGATE studentVle.csv TO DAILY CLICKS (chunked, cached)")

    if os.path.exists(config.VLE_DAILY_CACHE) and not force:
        vle_daily = pd.read_pickle(config.VLE_DAILY_CACHE)
        print(f"Loaded cached daily VLE aggregate: {config.VLE_DAILY_CACHE} (shape {vle_daily.shape})")
        return vle_daily

    t0 = time.time()
    parts = []
    n_rows = 0
    for i, chunk in enumerate(pd.read_csv(config.STUDENT_VLE_CSV, chunksize=config.VLE_CHUNK_SIZE)):
        grp = (
            chunk.groupby(["code_module", "code_presentation", "id_student", "date"])["sum_click"]
            .sum()
            .reset_index()
        )
        parts.append(grp)
        n_rows += len(chunk)
        print(f"  chunk {i + 1}: processed {n_rows:,} raw rows so far ({time.time() - t0:.1f}s elapsed)")

    vle_daily = (
        pd.concat(parts, ignore_index=True)
        .groupby(["code_module", "code_presentation", "id_student", "date"])["sum_click"]
        .sum()
        .reset_index()
        .rename(columns={"sum_click": "clicks"})
    )
    vle_daily = vle_daily.sort_values(["code_module", "code_presentation", "id_student", "date"]).reset_index(drop=True)
    print(f"\nFinished chunked read: {n_rows:,} raw rows -> daily aggregate shape {vle_daily.shape} "
          f"in {time.time() - t0:.1f}s")

    vle_daily.to_pickle(config.VLE_DAILY_CACHE)
    print(f"Cached to {config.VLE_DAILY_CACHE}")
    return vle_daily


def add_vle_features(df, vle_daily):
    section("5. PRE-DUE-DATE VLE FEATURES (clicks strictly BEFORE the assessment's due date)")

    v = vle_daily.copy()
    v["date"] = v["date"].astype(np.float64)  # match df["date"] dtype (float64) for merge_asof
    key = ["code_module", "code_presentation", "id_student"]
    v["cum_clicks"] = v.groupby(key)["clicks"].cumsum()
    v["cum_active_days"] = v.groupby(key).cumcount() + 1  # each row is one distinct active day

    v_sorted = v.sort_values("date")

    def cum_before(query_dates, offset_days=0):
        """
        For each row in df, find the cumulative clicks / active-days total for
        this student+module-presentation as of the latest VLE date that is
        <= (query_dates - offset_days - 1) - i.e. STRICTLY before
        (query_dates - offset_days). Uses merge_asof (backward) per group.

        merge_asof does NOT preserve the left frame's index (it returns a
        fresh 0..n-1 RangeIndex), so original row order is restored via an
        explicit position column rather than index-based reindex - relying
        on index alignment here silently scrambles rows.
        """
        q = df[key].copy()
        q["__query_date"] = (query_dates - offset_days - 1).values
        q["__orig_pos"] = np.arange(len(q))
        q = q.sort_values("__query_date")
        merged = pd.merge_asof(
            q, v_sorted,
            left_on="__query_date", right_on="date",
            by=key, direction="backward",
        )
        merged = merged.sort_values("__orig_pos").reset_index(drop=True)
        return merged

    due_date = df["date"]

    total = cum_before(due_date)
    d7 = cum_before(due_date, offset_days=7)
    d14 = cum_before(due_date, offset_days=14)
    d30 = cum_before(due_date, offset_days=30)

    clicks_total = total["cum_clicks"].fillna(0.0)
    clicks_7d = (total["cum_clicks"].fillna(0.0) - d7["cum_clicks"].fillna(0.0)).clip(lower=0)
    clicks_14d = (total["cum_clicks"].fillna(0.0) - d14["cum_clicks"].fillna(0.0)).clip(lower=0)
    clicks_30d = (total["cum_clicks"].fillna(0.0) - d30["cum_clicks"].fillna(0.0)).clip(lower=0)
    active_days = total["cum_active_days"].fillna(0.0)
    last_active_date = total["date"]  # NaN if the student has no VLE record before the due date
    days_since_last_activity = due_date.values - last_active_date  # NaN propagates -> imputer + indicator handles it

    df = df.copy()
    df["clicks_total_log1p"] = np.log1p(clicks_total.values)
    df["clicks_7d_log1p"] = np.log1p(clicks_7d.values)
    df["clicks_14d_log1p"] = np.log1p(clicks_14d.values)
    df["clicks_30d_log1p"] = np.log1p(clicks_30d.values)
    df["active_days"] = active_days.values
    df["days_since_last_activity"] = days_since_last_activity.values

    # RAW (non-log) clicks kept around for verify.py's reference-row checks.
    df["_raw_clicks_before_due"] = clicks_total.values
    df["_raw_clicks_last_14d"] = clicks_14d.values

    n_no_prior_vle = int((df["active_days"] == 0).sum())
    print(f"Rows with zero VLE activity before their due date: {n_no_prior_vle} "
          f"({n_no_prior_vle / len(df) * 100:.2f}%)")

    return df


# ===========================================================================
# 5. ORCHESTRATOR
# ===========================================================================

def build_training_table(force_vle_recompute=False, use_cache=True):
    cache_path = os.path.join(config.CACHE_DIR, "training_table.pkl")
    if use_cache and os.path.exists(cache_path) and not force_vle_recompute:
        print(f"Loaded cached training table: {cache_path}")
        return pd.read_pickle(cache_path)

    frames = load_raw_frames()
    verify_expected_columns(frames)
    df = filter_and_join(frames)
    df, n_zero_prev = add_previous_score_features(df)
    vle_daily = build_vle_daily(force=force_vle_recompute)
    df = add_vle_features(df, vle_daily)

    section("FINAL TRAINING TABLE SUMMARY")
    print(f"Final shape: {df.shape}")
    print(f"Unique students: {df['id_student'].nunique()}")
    print(f"Unique module-presentations: {df[['code_module', 'code_presentation']].drop_duplicates().shape[0]}")
    at_risk_rate = (df["score"] < config.AT_RISK_SCORE_THRESHOLD).mean()
    print(f"At-risk rate (score < {config.AT_RISK_SCORE_THRESHOLD}): {at_risk_rate:.4f} ({at_risk_rate*100:.2f}%)")
    print(f"Rows with prev_count == 0: {n_zero_prev}")

    df.to_pickle(cache_path)
    print(f"\nCached final training table to {cache_path}")
    return df


if __name__ == "__main__":
    build_training_table(force_vle_recompute=False, use_cache=False)
