"""Shared focus-state constants used by live inference and (re)training.

The confusion matrix showed Boredom precision ~40% and Anxiety recall ~41%.
Live decoding therefore refuses a distracted class unless it clears a
per-class bar, and falls back to Focused rather than Boredom.
"""

CLASSES = ["Focused", "Fatigue", "Anxiety", "Boredom"]
DISTRACTED_CLASSES = ("Fatigue", "Anxiety", "Boredom")

# Minimum probability required to *keep* the argmax class. Anything below
# falls back to Focused (or the next class that does clear its bar).
CLASS_CONF_THRESHOLDS = {
    "Focused": 0.45,
    "Fatigue": 0.55,
    "Anxiety": 0.70,
    "Boredom": 0.70,
}

# Intervention modal (frontend) — Boredom needs a clearer majority than Fatigue.
INTERVENTION_CONF_THRESHOLDS = {
    "Fatigue": 0.70,
    "Anxiety": 0.75,
    "Boredom": 0.80,
}

# Rolling landmark window used for blink / gaze / pose / yawn stats.
TEMPORAL_WINDOW_SECONDS = 45.0
TEMPORAL_MIN_FRAMES = 4
BLINK_EAR_THRESHOLD = 0.21
YAWN_MAR_THRESHOLD = 0.55
STILL_GAZE_STD = 0.06
STILL_YAW_STD = 6.0  # degrees
FATIGUE_EAR_MEAN = 0.19
FATIGUE_MIN_PROB = 0.28

TEMPORAL_FEATURE_NAMES = [
    "ear_std",
    "ear_blink_rate",
    "gaze_x_std",
    "gaze_y_std",
    "head_pitch_std",
    "head_yaw_std",
    "head_roll_std",
    "mar_yawn_count",
    "ear_mean_window",
    "mar_mean_window",
]

# Extra sample-weight multipliers on top of sklearn's balanced weights.
# Boredom is down-weighted so false positives (Focused/Anxiety → Boredom)
# cost more than missing a true Boredom.
BOREDOM_FP_COST = {
    "Focused": 1.6,
    "Fatigue": 1.0,
    "Anxiety": 1.8,
    "Boredom": 0.7,
}

HARD_EXAMPLE_UPSAMPLE = 3
