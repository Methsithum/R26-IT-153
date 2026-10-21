"""ordinal_priority_model.py"""

import numpy as np

CLASS_ORDER = ["Low", "Medium", "High"]  # index 0/1/2 - matches predict()'s return value


class OrdinalPriorityModel:
    """model_medium"""

    def __init__(self, model_medium, model_high):
        self.model_medium = model_medium
        self.model_high = model_high
        self.class_order = CLASS_ORDER

    def predict_proba(self, X):
        p_ge_medium = self.model_medium.predict_proba(X)[:, 1]
        p_ge_high = self.model_high.predict_proba(X)[:, 1]
        # Enforce the logical ordinal constraint P(>=High) <= P(>=Medium)
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
