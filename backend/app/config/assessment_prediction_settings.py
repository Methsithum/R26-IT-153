"""
Config for the assessment-score-prediction serving layer.

Only the journal_compatible bundle is served here (prev_mean, prev_last,
prev_count, assessment_type). assessment_score_full_oulad.joblib is
research-only and must never be loaded by app code.

No magic numbers scattered in the service - everything the service needs is
defined here.
"""

import os
from pathlib import Path

# assessment_prediction_settings.py lives at: backend/app/config/
# Project root is 3 levels up (config -> app -> backend).
_BACKEND_DIR = Path(__file__).resolve().parents[2]

# Overridable via env var for deployments that keep trained-models elsewhere;
# defaults to the path the training pipeline (ml_scripts/journal/assessment_score)
# actually writes to. This module never imports ml_scripts itself.
MODEL_PATH = Path(
    os.environ.get(
        "ASSESSMENT_SCORE_MODEL_PATH",
        str(_BACKEND_DIR / "trained-models" / "journal" / "assessment_score" / "assessment_score_journal_compatible.joblib"),
    )
)

# Fallback pass mark if a loaded bundle is somehow missing "pass_mark" (should
# not happen with bundles produced by the current training pipeline, which
# always sets it to config.AT_RISK_SCORE_THRESHOLD == 40).
PASS_MARK_FALLBACK = 40

HISTORY_LIMIT_DEFAULT = 20
HISTORY_LIMIT_MAX = 100

# ── Journal -> OULAD assessment_type mapping (ASSUMPTION) ──────────────────
# The trained model only knows OULAD's 3 assessment_type categories (TMA, CMA,
# Exam). The journal has its own vocabulary (assignment/task, quiz, mid,
# final, lab). This mapping is a reasonable-but-arbitrary choice, not an
# official equivalence table:
#   - assignment/task work -> TMA (Tutor-Marked Assessment: submitted coursework)
#   - quiz                  -> CMA (Computer-Marked Assessment: short, auto-graded)
#   - mid/final/lab exams   -> Exam
JOURNAL_TO_OULAD_ASSESSMENT_TYPE: dict[str, str] = {
    "task": "TMA",
    "assignment": "TMA",
    "quiz": "CMA",
    "mid": "Exam",
    "final": "Exam",
    "lab": "Exam",
}

# ── Letter grade -> 0-100 percent mapping (ASSUMPTION - see README) ────────
# journal_constants.LETTER_GRADE_POINTS only has GPA points (0.7-4.0), and
# parse_letter_grade() only validates/normalizes the string - neither
# converts to a 0-100 number, which the model needs. This is MY estimate,
# not an official university conversion table, and is easy to replace.
# NOTE: journal_constants.LETTER_GRADES is missing "D-" even though
# LETTER_GRADE_POINTS and FAIL_LETTER_GRADES both have it - a pre-existing
# inconsistency in journal_constants.py, left as-is per instruction (not
# this task's job to fix).
LETTER_GRADE_TO_PERCENT: dict[str, float] = {
    "A+": 95, "A": 87, "A-": 82,
    "B+": 77, "B": 72, "B-": 67,
    "C+": 62, "C": 57, "C-": 52,
    "D+": 47, "D": 42, "D-": 37,
}
