"""
ordinal_monotonic_model.py

Canonical, importable definition of OrdinalMonotonicPriorityModel - the
deployed Priority model wraps two monotonically-constrained binary XGBoost
classifiers (P(priority >= Medium), P(priority >= High)) as a single
Low/Medium/High predictor. See PROJECT CONTEXT.md Section 5c for the full
story: the original single multi:softmax XGBClassifier had no monotonic
guarantee on `date`, so a task due tomorrow could predict LOWER priority than
an otherwise-identical task due a month later. Fixed by retraining with a
monotonic constraint - see ml_scripts/study-planner/train_priority_model_monotonic.py.

This lives here (not in ml_scripts/) because it is genuinely production code:
app/models/study_planner/priority_model.joblib is a pickled instance of this
exact class, and joblib/pickle resolve a class by its *importable module
path* at load time - `app.services.study_planner.ordinal_monotonic_model`,
matching this file's location, must exist unchanged for priority_service.py
and explain_service.py to be able to unpickle it. Do not move or rename this
file without re-pickling the model, and do not delete it while
priority_model.joblib is deployed.
"""

import numpy as np

CLASS_ORDER = ["Low", "Medium", "High"]  # index 0/1/2 - matches predict()'s return value


class OrdinalMonotonicPriorityModel:
    """
    model_medium: binary XGBClassifier predicting P(priority >= Medium), i.e. NOT Low.
    model_high:   binary XGBClassifier predicting P(priority >= High).
    Both trained with the same monotone_constraints on `date` (decreasing), so both
    cumulative probabilities are guaranteed non-increasing in `date` - see the
    training script for why a single multi-class monotonic model can't express this
    (opposite-signed requirements for Low vs. High under one shared constraint).
    """

    def __init__(self, model_medium, model_high):
        self.model_medium = model_medium
        self.model_high = model_high
        self.class_order = CLASS_ORDER

    def predict_proba(self, X):
        p_ge_medium = self.model_medium.predict_proba(X)[:, 1]
        p_ge_high = self.model_high.predict_proba(X)[:, 1]
        # Enforce the logical ordinal constraint P(>=High) <= P(>=Medium) -
        # the two binary models are trained independently, so nothing else
        # guarantees this at every input.
        p_ge_high = np.minimum(p_ge_high, p_ge_medium)

        p_low = 1.0 - p_ge_medium
        p_medium = p_ge_medium - p_ge_high
        p_high = p_ge_high

        proba = np.stack([p_low, p_medium, p_high], axis=1)
        proba = np.clip(proba, 0.0, None)
        row_sums = proba.sum(axis=1, keepdims=True)
        proba = proba / row_sums
        return proba

    def predict(self, X):
        return self.predict_proba(X).argmax(axis=1)
