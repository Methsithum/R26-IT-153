"""
ordinal_monotonic_model.py

Wrapper that turns two monotonically-constrained binary XGBoost classifiers
(P(priority >= Medium), P(priority >= High)) into a single 3-class
Low/Medium/High predictor, mimicking the .predict()/.predict_proba()
interface of the single multi:softmax XGBClassifier this replaces.

Why two binary models instead of one multi-class model: see the "why ordinal"
note in train_priority_model_monotonic.py section 2b - a single
monotone_constraints tuple in XGBoost's native multi-class objective applies
the SAME sign to every class's per-tree score contribution, which is wrong
here (P(High) should fall as `date` grows, but P(Low) should rise - opposite
signs, not expressible as one constraint on one multi-class model).

Must stay importable at both train time and load time (joblib pickles a
reference to this class, not its code) - this module is the single source of
truth for that class, imported by both the training script and any future
inference code that loads priority_model_monotonic.joblib.
"""

import numpy as np

CLASS_ORDER = ["Low", "Medium", "High"]  # index 0/1/2 - matches predict()'s return value


class OrdinalMonotonicPriorityModel:
    """
    model_medium: binary XGBClassifier predicting P(priority >= Medium), i.e. NOT Low.
    model_high:   binary XGBClassifier predicting P(priority >= High).
    Both trained with the same monotone_constraints on `date` (see training script),
    so both cumulative probabilities are guaranteed non-increasing in `date`.
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
