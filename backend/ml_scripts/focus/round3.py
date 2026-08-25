"""Round-3 training helpers shared by the notebook.

Import from `ml_scripts/focus` after adding the backend root to sys.path,
or from a notebook cell that already has BACKEND_ROOT on the path.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.utils.class_weight import compute_sample_weight

from app.services.focus.focus_config import (
    BOREDOM_FP_COST,
    CLASSES,
    HARD_EXAMPLE_UPSAMPLE,
)


def cost_sensitive_sample_weights(y: np.ndarray) -> np.ndarray:
    """Balanced weights × extra cost so Boredom false positives hurt more."""
    balanced = compute_sample_weight("balanced", y)
    cost = np.array([BOREDOM_FP_COST[CLASSES[int(i)]] for i in y], dtype=float)
    return balanced * cost


def hard_example_mask(y_true: np.ndarray, y_pred: np.ndarray) -> np.ndarray:
    """Focused/Anxiety rows the model called Boredom — the confusion-matrix leak."""
    focused = CLASSES.index("Focused")
    anxiety = CLASSES.index("Anxiety")
    boredom = CLASSES.index("Boredom")
    true_hard = (y_true == focused) | (y_true == anxiety)
    pred_bored = y_pred == boredom
    return true_hard & pred_bored


def upsample_hard_examples(X: np.ndarray, y: np.ndarray, pred: np.ndarray, copies: int = HARD_EXAMPLE_UPSAMPLE):
    """Repeat hard rows `copies` extra times so the next fit sees them more."""
    mask = hard_example_mask(y, pred)
    if not mask.any():
        return X, y, 0
    extra_X = np.repeat(X[mask], copies, axis=0)
    extra_y = np.repeat(y[mask], copies, axis=0)
    return np.vstack([X, extra_X]), np.concatenate([y, extra_y]), int(mask.sum())


def binary_focused_distracted(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    """Collapse Fatigue/Anxiety/Boredom into Distracted for an honest demo number."""
    focused = CLASSES.index("Focused")
    yt = (y_true != focused).astype(int)
    yp = (y_pred != focused).astype(int)
    labels = ["Focused", "Distracted"]
    report = classification_report(yt, yp, target_names=labels, digits=3, output_dict=True)
    return {
        "accuracy": float(accuracy_score(yt, yp)),
        "confusion": confusion_matrix(yt, yp).tolist(),
        "report": report,
    }


def live_holdout_dir(backend_root: Path) -> Path:
    """Optional webcam images: datasets/focus_live_holdout/<Class>/*.jpg"""
    return backend_root / "datasets" / "focus_live_holdout"


def clip_frame_indices(frame_count: int, n_frames: int = 5) -> list[int]:
    """Evenly spaced indices across a clip (not just the middle frame)."""
    if frame_count <= 0:
        return []
    n = min(n_frames, frame_count)
    if n == 1:
        return [frame_count // 2]
    return [int(i * (frame_count - 1) / (n - 1)) for i in range(n)]


def attach_clip_temporal_features(features_df):
    """Fill TEMPORAL_FEATURE_NAMES from other frames of the same DAiSEE clip.

    Still-image (face_detection) rows stay at 0 — they have no time window.
    Delete cache/landmark_features.csv after rebuilding the unified dataset.
    """
    import pandas as pd
    from app.services.focus.focus_config import TEMPORAL_FEATURE_NAMES
    from app.services.focus.temporal import compute_temporal_stats

    out = features_df.copy()
    for name in TEMPORAL_FEATURE_NAMES:
        if name not in out.columns:
            out[name] = 0.0

    if "file" not in out.columns:
        return out

    clip_ids = out["file"].astype(str).str.extract(r"DAiSEE_(.+)_f\d+", expand=False)
    landmark_cols = [
        c for c in out.columns
        if c not in {"split", "label", "label_idx", "file", *TEMPORAL_FEATURE_NAMES}
    ]
    for _, group in out.loc[clip_ids.notna()].groupby(clip_ids.dropna()):
        samples = group[landmark_cols].to_dict(orient="records")
        stats = compute_temporal_stats(samples)
        for name, value in stats.items():
            out.loc[group.index, name] = value
    return out
