"""
cluster_service.py

Loads the trained K-Means behavioral-clustering model and scaler ONCE at
module import time, and exposes predict_cluster() for the study-planner API.

Reuses the exact artifacts produced by ml_scripts/study-planner/cluster_study_behavior.py.
"""

import logging
import os

import joblib
import pandas as pd

logger = logging.getLogger(__name__)

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
MODELS_DIR = os.path.join(BACKEND_DIR, "trained-models", "stuyd-planner")

KMEANS_MODEL_PATH = os.path.join(MODELS_DIR, "kmeans_model.joblib")
KMEANS_SCALER_PATH = os.path.join(MODELS_DIR, "kmeans_scaler.joblib")

# The K-Means model was fit on 6 features, NOT all 7 behavioral columns -
# cluster_study_behavior.py deliberately excludes has_vle_activity from the
# clustered feature space (see that script's section 3): students with
# has_vle_activity == 0 are behaviorally degenerate (avg_weekly_clicks,
# clicks_trend, active_weeks_ratio are all exactly 0 for them), and including
# them in KMeans caused it to isolate them as a trivial outlier "cluster" for
# every k tried, rather than finding real behavioral segments among everyone
# else. That script set those ~49 students aside with a fixed label instead.
# We reproduce that same rule here at inference time.
CLUSTER_FEATURE_ORDER = [
    "avg_weekly_clicks", "clicks_trend", "active_weeks_ratio",
    "prior_avg_score", "num_of_prev_attempts", "studied_credits",
]
ALL_INPUT_FEATURES = CLUSTER_FEATURE_ORDER + ["has_vle_activity"]

NO_ACTIVITY_LABEL = "No VLE Engagement Data"
NO_ACTIVITY_CLUSTER_ID = -1

# Hardcoded cluster_id -> human-readable name mapping, taken directly from
# the printed output of cluster_study_behavior.py's section 6
# (LABEL CLUSTERS FROM CENTROID CHARACTERISTICS) the last time it was run
# against the full OULAD dataset with k=6 (chosen by silhouette score there).
# If cluster_study_behavior.py is re-run and produces a different k or
# different centroid characteristics, this mapping must be updated to match.
CLUSTER_NAMES = {
    0: "High-Performing Low-Engagement Light-Workload Studier",
    1: "High-Performing Engaged Fading-Effort Studier",
    2: "Average-Performing Moderately-Engaged Heavy-Workload Studier",
    3: "Average-Performing Low-Engagement Repeat-Attempter Studier",
    4: "Average-Performing Engaged Increasing-Effort Studier",
    5: "Struggling Low-Engagement Studier",
    NO_ACTIVITY_CLUSTER_ID: NO_ACTIVITY_LABEL,
}


class ClusterServiceError(Exception):
    """Raised for validation failures or when the clustering model failed to load at startup."""


_kmeans_model = None
_kmeans_scaler = None

try:
    _kmeans_model = joblib.load(KMEANS_MODEL_PATH)
    _kmeans_scaler = joblib.load(KMEANS_SCALER_PATH)
    logger.info("cluster_service: loaded kmeans_model.joblib and kmeans_scaler.joblib")
except FileNotFoundError as e:
    logger.error(
        "cluster_service: STARTUP ERROR - missing model artifact: %s. "
        "Run ml_scripts/study-planner/cluster_study_behavior.py to generate it. "
        "predict_cluster() will raise ClusterServiceError until this is fixed.",
        e,
    )
except Exception:
    logger.exception("cluster_service: STARTUP ERROR - unexpected failure loading clustering artifacts.")


def predict_cluster(behavior_features: dict) -> dict:
    """
    behavior_features: dict with keys avg_weekly_clicks, clicks_trend,
    active_weeks_ratio, has_vle_activity, prior_avg_score,
    num_of_prev_attempts, studied_credits (the 7 behavioral columns used in
    cluster_study_behavior.py).
    Returns {"cluster_id": int, "cluster_label": str}.
    """
    if not isinstance(behavior_features, dict):
        raise ClusterServiceError("behavior_features must be a dict of feature_name -> value.")

    missing = [f for f in ALL_INPUT_FEATURES if f not in behavior_features]
    if missing:
        raise ClusterServiceError(f"Missing required feature(s): {missing}")

    try:
        has_vle_activity = bool(float(behavior_features["has_vle_activity"]))
    except (TypeError, ValueError):
        raise ClusterServiceError(
            f"Feature 'has_vle_activity' must be numeric/boolean, got {behavior_features['has_vle_activity']!r}"
        )

    if not has_vle_activity:
        # Matches cluster_study_behavior.py's own handling of this group - not KMeans-derived.
        return {"cluster_id": NO_ACTIVITY_CLUSTER_ID, "cluster_label": NO_ACTIVITY_LABEL}

    if _kmeans_model is None or _kmeans_scaler is None:
        raise ClusterServiceError("Clustering model is not loaded - check server startup logs.")

    row = {}
    for f in CLUSTER_FEATURE_ORDER:
        value = behavior_features[f]
        try:
            row[f] = float(value)
        except (TypeError, ValueError):
            raise ClusterServiceError(f"Feature '{f}' must be numeric, got {value!r}")

    row_df = pd.DataFrame([row])[CLUSTER_FEATURE_ORDER]
    scaled = _kmeans_scaler.transform(row_df)
    cluster_id = int(_kmeans_model.predict(scaled)[0])
    cluster_label = CLUSTER_NAMES.get(cluster_id, f"Cluster {cluster_id}")

    return {"cluster_id": cluster_id, "cluster_label": cluster_label}
