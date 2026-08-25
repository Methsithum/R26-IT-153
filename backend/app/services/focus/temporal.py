"""Rolling-window landmark stats and a conservative temporal gate.

Class definitions in the training notebook talk about blink rate, gaze
darting, fidgeting and yawns — all time-series. The shipped SVM still sees
one frame, so live inference keeps a 30–60s buffer of per-frame features
and uses it in two ways:

1. If the loaded model was retrained with TEMPORAL_FEATURE_NAMES, those
   stats are concatenated onto the frame vector.
2. Regardless of the model, a gate vetoes "Boredom" when the face has been
   still (the main Focused → Boredom leak) and boosts Fatigue when blinks /
   yawns are actually present.
"""
from __future__ import annotations

import time
from collections import deque

import numpy as np

from .focus_config import (
    BLINK_EAR_THRESHOLD,
    CLASSES,
    FATIGUE_EAR_MEAN,
    FATIGUE_MIN_PROB,
    STILL_GAZE_STD,
    STILL_YAW_STD,
    TEMPORAL_FEATURE_NAMES,
    TEMPORAL_MIN_FRAMES,
    TEMPORAL_WINDOW_SECONDS,
    YAWN_MAR_THRESHOLD,
)


def _std(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    return float(np.std(values))


def compute_temporal_stats(samples: list[dict]) -> dict[str, float]:
    """Aggregate a list of per-frame feature dicts into the temporal vector."""
    empty = {name: 0.0 for name in TEMPORAL_FEATURE_NAMES}
    if not samples:
        return empty

    ears = [float(s.get("ear_avg", 0.0)) for s in samples]
    mars = [float(s.get("mar", 0.0)) for s in samples]
    gaze_x = [
        (float(s.get("gaze_x_left", 0.0)) + float(s.get("gaze_x_right", 0.0))) / 2
        for s in samples
    ]
    gaze_y = [
        (float(s.get("gaze_y_left", 0.0)) + float(s.get("gaze_y_right", 0.0))) / 2
        for s in samples
    ]
    pitch = [float(s.get("head_pitch", 0.0)) for s in samples]
    yaw = [float(s.get("head_yaw", 0.0)) for s in samples]
    roll = [float(s.get("head_roll", 0.0)) for s in samples]

    blinks = 0
    below = False
    for ear in ears:
        is_closed = ear < BLINK_EAR_THRESHOLD
        if is_closed and not below:
            blinks += 1
        below = is_closed

    yawns = 0
    open_mouth = False
    for mar in mars:
        is_yawn = mar >= YAWN_MAR_THRESHOLD
        if is_yawn and not open_mouth:
            yawns += 1
        open_mouth = is_yawn

    n = max(len(samples), 1)
    return {
        "ear_std": _std(ears),
        "ear_blink_rate": blinks / n,
        "gaze_x_std": _std(gaze_x),
        "gaze_y_std": _std(gaze_y),
        "head_pitch_std": _std(pitch),
        "head_yaw_std": _std(yaw),
        "head_roll_std": _std(roll),
        "mar_yawn_count": float(yawns),
        "ear_mean_window": float(np.mean(ears)),
        "mar_mean_window": float(np.mean(mars)),
    }


def apply_temporal_gate(state: str, probs: dict[str, float], stats: dict[str, float], n_frames: int) -> str:
    """Correct a single-frame prediction using window kinematics.

    Conservative by design: only fires with enough frames, and never invents
    Anxiety (gaze darting looks like Boredom; the per-class threshold handles it).
    """
    if n_frames < TEMPORAL_MIN_FRAMES:
        return state

    still = (
        stats.get("gaze_x_std", 1.0) < STILL_GAZE_STD
        and stats.get("gaze_y_std", 1.0) < STILL_GAZE_STD
        and stats.get("head_yaw_std", 99.0) < STILL_YAW_STD
    )
    sleepy = (
        stats.get("mar_yawn_count", 0) >= 1
        or stats.get("ear_mean_window", 1.0) < FATIGUE_EAR_MEAN
    )

    if state == "Boredom" and still:
        alt = max(
            (cls for cls in CLASSES if cls != "Boredom"),
            key=lambda cls: probs.get(cls, 0.0),
        )
        if probs.get(alt, 0.0) >= 0.35:
            return alt
        return "Focused"

    if sleepy and state in {"Focused", "Boredom"} and probs.get("Fatigue", 0.0) >= FATIGUE_MIN_PROB:
        return "Fatigue"

    return state


class TemporalFeatureBuffer:
    """Timestamped deque of per-frame landmark dicts, dropped after the window."""

    def __init__(self, window_seconds: float = TEMPORAL_WINDOW_SECONDS):
        self.window_seconds = window_seconds
        self._items: deque[tuple[float, dict]] = deque()

    def add(self, features: dict, now: float | None = None) -> dict[str, float]:
        ts = time.time() if now is None else now
        self._items.append((ts, features))
        cutoff = ts - self.window_seconds
        while self._items and self._items[0][0] < cutoff:
            self._items.popleft()
        return compute_temporal_stats([feat for _, feat in self._items])

    def stats(self) -> dict[str, float]:
        return compute_temporal_stats([feat for _, feat in self._items])

    def __len__(self) -> int:
        return len(self._items)

    def clear(self) -> None:
        self._items.clear()
