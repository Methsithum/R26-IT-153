"""
config.py - shared paths and constants for the assessment_score module.

Run as a file (see README.md), not imported as a package - other ml_scripts
folders contain hyphens in their names, so this project does not rely on
package-style imports across ml_scripts. Each script in this folder inserts
its own directory into sys.path at the top, the same way study-planner's
scripts resolve paths relative to __file__.
"""

import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "..", ".."))

OULAD_DIR = os.path.join(BACKEND_DIR, "datasets", "journal", "oulad")
CACHE_DIR = os.path.join(OULAD_DIR, "_cache")
REPORTS_DIR = os.path.join(SCRIPT_DIR, "reports")
MODELS_DIR = os.path.join(BACKEND_DIR, "trained-models", "journal", "assessment_score")

os.makedirs(CACHE_DIR, exist_ok=True)
os.makedirs(REPORTS_DIR, exist_ok=True)
os.makedirs(MODELS_DIR, exist_ok=True)

ASSESSMENTS_CSV = os.path.join(OULAD_DIR, "assessments.csv")
STUDENT_ASSESSMENT_CSV = os.path.join(OULAD_DIR, "studentAssessment.csv")
STUDENT_INFO_CSV = os.path.join(OULAD_DIR, "studentInfo.csv")
STUDENT_REGISTRATION_CSV = os.path.join(OULAD_DIR, "studentRegistration.csv")
STUDENT_VLE_CSV = os.path.join(OULAD_DIR, "studentVle.csv")

VLE_DAILY_CACHE = os.path.join(CACHE_DIR, "vle_daily.pkl")

RANDOM_STATE = 42
AT_RISK_SCORE_THRESHOLD = 40  # OULAD.names fail line, used only for evaluation, never as a feature
CONFORMAL_ALPHA = 0.10
VLE_CHUNK_SIZE = 1_000_000

FEATURE_SETS = ("full_oulad", "journal_compatible")

PREVIOUS_SCORE_FEATURES = ["prev_mean", "prev_last", "prev_count"]

CONTEXT_FEATURES = [
    "assessment_type", "weight", "date", "code_module",
    "gender", "highest_education", "imd_band", "age_band", "disability",
    "num_of_prev_attempts", "studied_credits", "date_registration",
]

VLE_FEATURES = [
    "clicks_total_log1p", "clicks_7d_log1p", "clicks_14d_log1p", "clicks_30d_log1p",
    "active_days", "days_since_last_activity",
]

# journal_compatible: only what the live journal (ExamModel/TaskModel) actually
# knows before an assessment - previous marks and the assessment's own type.
# No weight, no VLE, no demographics - never fabricate VLE clicks from journal data.
JOURNAL_COMPATIBLE_FEATURES = PREVIOUS_SCORE_FEATURES + ["assessment_type"]

FULL_OULAD_FEATURES = PREVIOUS_SCORE_FEATURES + CONTEXT_FEATURES + VLE_FEATURES

# Ablation configs (full_oulad run only): A adds previous scores, B adds
# context, C adds VLE (== FULL_OULAD_FEATURES), D is context+VLE without
# previous scores (tests whether VLE/context alone can substitute for history).
ABLATION_SETS = {
    "A_prev_only": PREVIOUS_SCORE_FEATURES,
    "B_prev_context": PREVIOUS_SCORE_FEATURES + CONTEXT_FEATURES,
    "C_prev_context_vle": PREVIOUS_SCORE_FEATURES + CONTEXT_FEATURES + VLE_FEATURES,
    "D_context_vle_no_prev": CONTEXT_FEATURES + VLE_FEATURES,
}

NUMERIC_FEATURES_ALL = set(PREVIOUS_SCORE_FEATURES) | {
    "weight", "date", "num_of_prev_attempts", "studied_credits", "date_registration",
} | set(VLE_FEATURES)

CATEGORICAL_FEATURES_ALL = {
    "assessment_type", "code_module", "gender", "highest_education",
    "imd_band", "age_band", "disability",
}
