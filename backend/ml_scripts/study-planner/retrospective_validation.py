"""
retrospective_validation.py

Retrospective, non-circular validation of the deployed priority model
(OrdinalMonotonicPriorityModel, Section 5c) against real historical outcomes.

===========================================================================
THE CIRCULARITY PROBLEM THIS SCRIPT IS DESIGNED TO AVOID
===========================================================================
Priority_Label (Section 4/5) was built FROM the task's real outcome (score,
submitted_late). So "do High-priority tasks have worse outcomes than Low-
priority tasks?" is tautological - true by construction of the label,
proves nothing new, and MUST NOT be reported as a finding here.

The only methodologically valid retrospective test holds the model's
prediction fixed and looks for variation in something the prediction does
NOT already encode - specifically, behavioral engagement. The real, testable,
non-circular question: "Among tasks the model predicted High priority (from
PRE-OUTCOME features only), did students who behaviorally responded with
more urgency actually achieve better outcomes than those who didn't?" The
predicted priority is held constant across the comparison groups - this
tests whether ACTING on an elevated priority signal associates with better
results, not whether the label correctly identified risk (already
established by Section 5b/5c's accuracy/F1 metrics - not re-tested here).

===========================================================================
WHY THIS SCRIPT DOES ITS OWN DATA JOIN INSTEAD OF JUST LOADING THE CSV
===========================================================================
The already-exported ml_scripts/study-planner/outputs/oulad_task_level_leakage_free.csv
deliberately has NO score/submitted_late columns (Section 3 drops them
before export, precisely so they can never leak into the feature matrix).
This script needs those exact columns back, as OUTCOME data only (never fed
to the model) - so it re-runs train_priority_model.py's sections 1
(load+join), 2 (sort - NOT the VLE-dependent parts), and 5 (label
construction) to reproduce score/submitted_late in the EXACT SAME ROW ORDER
as the exported CSV, then attaches them by position. Section 1b (chunked
studentVle.csv processing, several minutes) is deliberately skipped - the
sort key in section 2 (id_student/code_module/code_presentation/date) does
not depend on any VLE-derived column, and the VLE merge itself is a
row-preserving left join, so skipping it cannot change row order. The
avg_weekly_clicks/clicks_trend/active_weeks_ratio columns this script
actually needs (for the urgency-response proxy) are already sitting in the
exported CSV - recomputing them here would be redundant, not more correct.
This is verified, not assumed: a strict positional cross-check (Priority_Label,
weight, and date must match exactly, row for row) is run before trusting the
join, and the script aborts loudly if it doesn't.

Run with:
    venv/Scripts/python ml_scripts/study-planner/retrospective_validation.py
"""

import os
import sys

import joblib
import numpy as np
import pandas as pd
import statsmodels.api as sm
from scipy import stats
from sklearn.model_selection import train_test_split

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
DATASETS_DIR = os.path.join(BACKEND_DIR, "datasets", "study-planner")
OUTPUTS_DIR = os.path.join(BACKEND_DIR, "ml_scripts", "study-planner", "outputs")
MODEL_PATH = os.path.join(BACKEND_DIR, "app", "models", "study_planner", "priority_model.joblib")

if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)
from app.services.study_planner.ordinal_monotonic_model import CLASS_ORDER  # noqa: E402

RANDOM_STATE = 42
FEATURE_ORDER = [
    "date", "weight", "num_of_prev_attempts", "studied_credits",
    "module_presentation_length", "date_registration", "prior_avg_score",
    "avg_weekly_clicks", "clicks_trend", "active_weeks_ratio", "has_vle_activity",
    "assessment_type_enc", "code_module_enc",
]


def section(title):
    print("\n" + "=" * 90)
    print(title)
    print("=" * 90)


# ===========================================================================
# 1. RE-JOIN score/submitted_late IN THE EXACT ROW ORDER OF THE EXPORTED CSV
# ===========================================================================
section("1. RECONSTRUCT score/submitted_late (no VLE reprocessing - see module docstring)")

assessments = pd.read_csv(os.path.join(DATASETS_DIR, "assessments.csv"))
student_assessment = pd.read_csv(os.path.join(DATASETS_DIR, "studentAssessment.csv"))
student_info = pd.read_csv(os.path.join(DATASETS_DIR, "studentInfo.csv"))
student_registration = pd.read_csv(os.path.join(DATASETS_DIR, "studentRegistration.csv"))
courses = pd.read_csv(os.path.join(DATASETS_DIR, "courses.csv"))

assessments = assessments[assessments["date"] != "?"].copy()
assessments["date"] = assessments["date"].astype(int)

student_assessment = student_assessment[student_assessment["score"] != "?"].copy()
student_assessment["score"] = student_assessment["score"].astype(float)

df = student_assessment.merge(assessments, on="id_assessment", how="inner")
df = df.merge(
    student_info[["code_module", "code_presentation", "id_student", "num_of_prev_attempts", "studied_credits"]],
    on=["code_module", "code_presentation", "id_student"], how="left",
)
student_registration = student_registration.copy()
student_registration["date_registration"] = pd.to_numeric(student_registration["date_registration"], errors="coerce")
df = df.merge(
    student_registration[["code_module", "code_presentation", "id_student", "date_registration"]],
    on=["code_module", "code_presentation", "id_student"], how="left",
)
df = df.merge(
    courses[["code_module", "code_presentation", "module_presentation_length"]],
    on=["code_module", "code_presentation"], how="left",
)
print(f"Re-joined df shape (pre-sort): {df.shape}")

# Section 2's sort - identical call, determines row order. Depends only on
# id_student/code_module/code_presentation/date, none of which are VLE-derived.
df = df.sort_values(["id_student", "code_module", "code_presentation", "date"]).reset_index(drop=True)

# Section 5's label construction, verbatim.
df["submitted_late"] = (df["date_submitted"] > df["date"]).astype(int)


def label_from_outcome(row):
    if row["score"] < 50 or row["submitted_late"] == 1 or (row["score"] < 60 and row["weight"] >= 20):
        return "High"
    if row["score"] >= 75 and row["submitted_late"] == 0 and row["weight"] < 15:
        return "Low"
    return "Medium"


df["Priority_Label_check"] = df.apply(label_from_outcome, axis=1)
print(f"Reconstructed df shape (post-sort): {df.shape}")


# ===========================================================================
# 2. LOAD THE EXPORTED FEATURE+LABEL CSV AND VERIFY ROW ALIGNMENT
# ===========================================================================
section("2. LOAD EXPORTED FEATURES + VERIFY POSITIONAL ALIGNMENT (hard requirement)")

features_df = pd.read_csv(os.path.join(OUTPUTS_DIR, "oulad_task_level_leakage_free.csv"))
print(f"Exported features CSV shape: {features_df.shape}")

if len(df) != len(features_df):
    raise SystemExit(
        f"ABORT: row count mismatch ({len(df)} reconstructed vs {len(features_df)} exported) - "
        f"the positional join would misalign outcomes with features. Fix the reconstruction before proceeding."
    )

label_match = (df["Priority_Label_check"].values == features_df["Priority_Label"].values)
weight_match = np.isclose(df["weight"].values, features_df["weight"].values)
date_match = np.isclose(df["date"].values.astype(float), features_df["date"].values)

label_match_rate = label_match.mean()
weight_match_rate = weight_match.mean()
date_match_rate = date_match.mean()
print(f"Priority_Label exact match rate: {label_match_rate:.6f}")
print(f"weight match rate: {weight_match_rate:.6f}")
print(f"date match rate: {date_match_rate:.6f}")

if label_match_rate < 1.0 or weight_match_rate < 1.0 or date_match_rate < 1.0:
    raise SystemExit(
        "ABORT: positional alignment check FAILED - reconstructed row order does not exactly match "
        "the exported CSV's row order. Do not trust any downstream analysis from a misaligned join. "
        "Investigate the reconstruction (section 1) before re-running."
    )
print("Positional alignment CONFIRMED (100% exact match on Priority_Label, weight, and date) - "
      "safe to attach score/submitted_late to the exported feature rows by position.")

full_df = features_df.copy()
full_df["score"] = df["score"].values
full_df["submitted_late"] = df["submitted_late"].values


# ===========================================================================
# 3. REPRODUCE THE SAME TRAIN/TEST SPLIT AS Section 5b/5c (for consistency
#    with their reported accuracy/F1 - this analysis uses the HELD-OUT TEST
#    SET, stated explicitly, not the full dataset, so results describe
#    genuinely unseen data exactly like the headline metrics already do)
# ===========================================================================
section("3. REPRODUCE THE SECTION 5b/5c TRAIN/TEST SPLIT (test set only)")

X = full_df[FEATURE_ORDER].copy()
y = full_df["Priority_Label"].copy()
X_train, X_test, y_train, y_test, idx_train, idx_test = train_test_split(
    X, y, full_df.index, test_size=0.2, stratify=y, random_state=RANDOM_STATE
)
test_df = full_df.loc[idx_test].copy()
print(f"Test set size: {len(test_df)} (matches the 20% held out in Sections 5b/5c)")


# ===========================================================================
# 4. GENERATE PREDICTIONS WITH THE DEPLOYED MODEL (13 features only)
# ===========================================================================
section("4. PREDICT WITH THE DEPLOYED MODEL (pre-outcome features only, exactly as production does)")

model = joblib.load(MODEL_PATH)
pred_idx = model.predict(test_df[FEATURE_ORDER])
test_df["predicted_priority"] = [CLASS_ORDER[i] for i in pred_idx]
print(test_df["predicted_priority"].value_counts())


# ===========================================================================
# 5. DEFINE THE "ACTED WITH URGENCY" BEHAVIORAL PROXY (Section 1 of the task)
# ===========================================================================
section("5. DEFINE urgency_responsive")
print("""
urgency_responsive = 1 if clicks_trend > 0, else 0.

clicks_trend (already engineered, Section 5b) = the student's most recent
week's VLE clicks minus their OWN earlier average - a positive value means
engagement rose relative to their own baseline in the period leading up to
this assessment's deadline.

LIMITATION, stated honestly: this is a proxy for "behaviorally engaged more
than usual around this deadline," not a direct measure of "the student
specifically prioritized THIS task because of an urgency signal they saw" -
OULAD students never saw this system's priority predictions at all (this is
historical, incidental behavioral variation - see Section 5's interpretation
notes). Rising engagement could reflect many things (a different assessment
in the same window, general re-engagement with the module, unrelated
circumstances) - it is the best available behavioral signal already in the
feature set, not a ground-truth measure of intentional prioritization.
""")

test_df["urgency_responsive"] = (test_df["clicks_trend"] > 0).astype(int)


# ===========================================================================
# 6. CORE COMPARISON: WITHIN THE HIGH-PRIORITY-PREDICTED SUBSET
# ===========================================================================
def compare_groups(subset_df, subset_name):
    """Returns a dict of comparison statistics for one predicted-priority subset."""
    urgent = subset_df[subset_df["urgency_responsive"] == 1]
    not_urgent = subset_df[subset_df["urgency_responsive"] == 0]

    n_urgent, n_not_urgent = len(urgent), len(not_urgent)
    if n_urgent < 2 or n_not_urgent < 2:
        print(f"  [{subset_name}] Insufficient sample size in one group (urgent={n_urgent}, not_urgent={n_not_urgent}) - skipping.")
        return None

    # --- score: Welch's t-test (unequal variance assumed, the safer default) ---
    score_urgent, score_not = urgent["score"], not_urgent["score"]
    t_stat, t_p = stats.ttest_ind(score_urgent, score_not, equal_var=False)
    pooled_sd = np.sqrt((score_urgent.var(ddof=1) + score_not.var(ddof=1)) / 2)
    cohens_d = (score_urgent.mean() - score_not.mean()) / pooled_sd if pooled_sd > 0 else np.nan

    # --- submitted_late rate: chi-square test of independence ---
    late_urgent, late_not = urgent["submitted_late"].sum(), not_urgent["submitted_late"].sum()
    contingency = np.array([[late_urgent, n_urgent - late_urgent], [late_not, n_not_urgent - late_not]])
    chi2, chi2_p, _, _ = stats.chi2_contingency(contingency)
    late_rate_urgent = late_urgent / n_urgent
    late_rate_not = late_not / n_not_urgent
    risk_difference = late_rate_urgent - late_rate_not

    result = {
        "subset": subset_name,
        "n_urgent": n_urgent, "n_not_urgent": n_not_urgent,
        "mean_score_urgent": score_urgent.mean(), "mean_score_not_urgent": score_not.mean(),
        "score_diff": score_urgent.mean() - score_not.mean(),
        "score_cohens_d": cohens_d, "score_t_stat": t_stat, "score_p_value": t_p,
        "late_rate_urgent": late_rate_urgent, "late_rate_not_urgent": late_rate_not,
        "late_rate_risk_difference": risk_difference,
        "late_chi2": chi2, "late_p_value": chi2_p,
    }
    print(f"  [{subset_name}] n_urgent={n_urgent}, n_not_urgent={n_not_urgent}")
    print(f"  [{subset_name}] mean score: urgent={score_urgent.mean():.2f} vs not_urgent={score_not.mean():.2f} "
          f"(diff={result['score_diff']:+.2f}, Cohen's d={cohens_d:.3f}, t={t_stat:.3f}, p={t_p:.4g})")
    print(f"  [{subset_name}] late rate: urgent={late_rate_urgent:.3f} vs not_urgent={late_rate_not:.3f} "
          f"(risk diff={risk_difference:+.3f}, chi2={chi2:.3f}, p={chi2_p:.4g})")
    return result


section("6. CORE COMPARISON - within predicted-High-priority subset")
high_subset = test_df[test_df["predicted_priority"] == "High"]
high_result = compare_groups(high_subset, "High-priority-predicted")


# ===========================================================================
# 7. FALSIFICATION / CONTROL CHECK - within predicted-Low-priority subset
# ===========================================================================
section("7. FALSIFICATION CHECK - within predicted-Low-priority subset")
low_subset = test_df[test_df["predicted_priority"] == "Low"]
low_result = compare_groups(low_subset, "Low-priority-predicted")


# ===========================================================================
# 8. CONFOUND CONTROL - regression within predicted-High-priority subset
#    (task-required), ALSO run within predicted-Low-priority subset as an
#    honest extension of the SAME falsification logic as Section 7 - if the
#    "urgency_responsive survives confound control" result is not actually
#    specific to high-priority tasks, that must be visible here too, not
#    just in the raw comparison.
# ===========================================================================
def run_regressions(subset_df, subset_name):
    """Logistic (submitted_late) + OLS (score) on urgency_responsive + weight + prior_avg_score."""
    result = {}
    if len(subset_df) < 10:
        print(f"  [{subset_name}] Sample too small for regression.")
        return result

    reg_df = subset_df[["urgency_responsive", "weight", "prior_avg_score", "submitted_late", "score"]].dropna()
    X_reg = sm.add_constant(reg_df[["urgency_responsive", "weight", "prior_avg_score"]])

    try:
        logit_model = sm.Logit(reg_df["submitted_late"], X_reg).fit(disp=0)
        print(f"\n[{subset_name}] Logistic regression: submitted_late ~ urgency_responsive + weight + prior_avg_score")
        print(logit_model.summary2().tables[1])
        result["logit_urgency_coef"] = logit_model.params["urgency_responsive"]
        result["logit_urgency_p"] = logit_model.pvalues["urgency_responsive"]
    except Exception as e:
        print(f"  [{subset_name}] Logistic regression failed: {e}")
        result["logit_urgency_coef"] = np.nan
        result["logit_urgency_p"] = np.nan

    ols_model = sm.OLS(reg_df["score"], X_reg).fit()
    print(f"\n[{subset_name}] Linear regression: score ~ urgency_responsive + weight + prior_avg_score")
    print(ols_model.summary2().tables[1])
    result["ols_urgency_coef"] = ols_model.params["urgency_responsive"]
    result["ols_urgency_p"] = ols_model.pvalues["urgency_responsive"]
    return result


section("8. CONFOUND CONTROL - regression within predicted-High-priority subset (task-required)")
regression_results_high = run_regressions(high_subset, "High-priority-predicted")

section("8b. SAME REGRESSION within predicted-Low-priority subset (extends Section 7's falsification logic to the regression)")
regression_results_low = run_regressions(low_subset, "Low-priority-predicted")


# ===========================================================================
# 9. SAVE OUTPUTS
# ===========================================================================
section("9. SAVE OUTPUTS")

rows = []
if high_result:
    rows.append({**high_result, **{f"reg_{k}": v for k, v in regression_results_high.items()}})
if low_result:
    rows.append({**low_result, **{f"reg_{k}": v for k, v in regression_results_low.items()}})
results_df = pd.DataFrame(rows)

csv_path = os.path.join(OUTPUTS_DIR, "retrospective_validation_results.csv")
results_df.to_csv(csv_path, index=False)
print(f"Saved {csv_path}")

print("\nDone.")
