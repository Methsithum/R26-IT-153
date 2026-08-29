"""
leakage_guard.py

The leakage-suspicion check from train_priority_model.py Section 4 /
train_priority_model_monotonic.py Section 7, factored out into a reusable,
independently-testable function. Previously this was inline boolean logic
duplicated (with slightly different shapes) in both training scripts - both
now import and call this instead, so a test against this module is a real
regression guard on the actual production check, not a reimplementation of
it that could silently drift out of sync.

Rationale (unchanged from the original inline comments): Priority_Label is
derived from real outcomes (score, submitted_late) that are NOT in the
feature set, so a genuinely non-trivial prediction task should score well
below ~97% accuracy/F1. A score at or above that threshold is not "great
performance" - it's the classic signature of target leakage (the label is
still somehow recoverable from the inputs), and must be surfaced loudly
rather than reported as a good result.
"""

LEAKAGE_SUSPECT_THRESHOLD = 0.97


def is_leakage_suspect(accuracy: float, weighted_f1: float, threshold: float = LEAKAGE_SUSPECT_THRESHOLD) -> bool:
    """True if either metric is suspiciously high for a genuinely non-trivial prediction task."""
    return accuracy > threshold or weighted_f1 > threshold


def find_leakage_suspects(comparison_df, threshold: float = LEAKAGE_SUSPECT_THRESHOLD):
    """
    comparison_df: a DataFrame with "Model", "Accuracy", "Weighted F1" columns
    (train_priority_model.py's model-comparison table shape).
    Returns the subset of rows whose Accuracy or Weighted F1 exceeds `threshold`.
    """
    return comparison_df[
        (comparison_df["Accuracy"] > threshold) | (comparison_df["Weighted F1"] > threshold)
    ]
