"""leakage_guard.py"""

LEAKAGE_SUSPECT_THRESHOLD = 0.97


def is_leakage_suspect(accuracy: float, weighted_f1: float, threshold: float = LEAKAGE_SUSPECT_THRESHOLD) -> bool:
    """True if either metric is suspiciously high for a genuinely non-trivial prediction task."""
    return accuracy > threshold or weighted_f1 > threshold


def find_leakage_suspects(comparison_df, threshold: float = LEAKAGE_SUSPECT_THRESHOLD):
    """comparison_df"""
    return comparison_df[
        (comparison_df["Accuracy"] > threshold) | (comparison_df["Weighted F1"] > threshold)
    ]
