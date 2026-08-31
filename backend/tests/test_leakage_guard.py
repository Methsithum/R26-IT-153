"""
Regression tests for the leakage-suspicion guard (PROJECT CONTEXT.md
Section 4). Tests the real, shared `leakage_guard.py` module now imported by
both train_priority_model.py and train_priority_model_monotonic.py (see
those files' refactor) - not a reimplementation of the check.
"""
import numpy as np
import pandas as pd
import pytest
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier

from leakage_guard import LEAKAGE_SUSPECT_THRESHOLD, find_leakage_suspects, is_leakage_suspect


class TestIsLeakageSuspectThreshold:
    def test_fires_above_threshold(self):
        assert is_leakage_suspect(0.98, 0.98) is True
        assert is_leakage_suspect(0.971, 0.5) is True  # either metric alone is enough
        assert is_leakage_suspect(0.5, 0.975) is True

    def test_does_not_fire_at_or_below_threshold(self):
        assert is_leakage_suspect(0.97, 0.97) is False  # strictly greater-than, boundary itself is not suspect
        assert is_leakage_suspect(0.9, 0.85) is False


class TestFindLeakageSuspectsOnRealProductionArtifacts:
    """
    Regression guard confirming the fix stays fixed: the CURRENT production
    label construction (Section 5, real outcome-based Priority_Label) does
    NOT trigger the leakage warning - using the actual saved comparison
    tables from completed real training runs, not synthetic numbers.
    """

    def test_original_8_model_comparison_does_not_trigger(self, ml_outputs_dir):
        df = pd.read_csv(ml_outputs_dir / "model_comparison_results.csv")
        suspects = find_leakage_suspects(df)
        assert suspects.empty, f"Unexpected leakage-suspect model(s) in production comparison: {suspects['Model'].tolist()}"

    def test_monotonic_model_comparison_does_not_trigger(self, ml_outputs_dir):
        df = pd.read_csv(ml_outputs_dir / "monotonic_vs_original_comparison.csv")
        suspects = find_leakage_suspects(df)
        assert suspects.empty, f"Unexpected leakage-suspect model(s): {suspects['Model'].tolist()}"


class TestLeakageGuardCatchesADeliberatelyLeakyModel:
    """
    Constructs a toy dataset with the exact anti-pattern Section 4 documents
    as the KNOWN-BAD case: a label derived directly from the model's own
    input features (e.g. Priority_Label computed only from weight/date/
    prior_avg_score, all three also fed in as features) - any model trivially
    "recovers" that arithmetic and scores ~99-100%. This is a real,
    end-to-end check: an actual (tiny, fast) classifier is trained on the toy
    data and its real reported accuracy/F1 is what's checked, not a made-up
    number.
    """

    @pytest.fixture
    def leaky_toy_dataset(self):
        rng = np.random.RandomState(42)
        n = 300
        weight = rng.uniform(0, 100, n)
        date = rng.uniform(12, 261, n)
        prior_avg_score = rng.uniform(0, 100, n)
        # Section 4's documented anti-pattern: label formula uses ONLY
        # features that are also model inputs, with no real outcome signal
        # (no score/submitted_late) mixed in - deterministically recoverable.
        label = np.where(
            (weight >= 20) & (date < 100), "High",
            np.where(prior_avg_score >= 75, "Low", "Medium"),
        )
        return pd.DataFrame({"weight": weight, "date": date, "prior_avg_score": prior_avg_score, "label": label})

    def test_deliberately_leaky_label_triggers_the_warning(self, leaky_toy_dataset):
        X = leaky_toy_dataset[["weight", "date", "prior_avg_score"]]
        y = leaky_toy_dataset["label"]
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)

        clf = DecisionTreeClassifier(max_depth=8, random_state=42)
        clf.fit(X_train, y_train)
        acc = clf.score(X_test, y_test)

        from sklearn.metrics import f1_score
        f1 = f1_score(y_test, clf.predict(X_test), average="weighted")

        # A deterministic-formula label should be recovered almost perfectly.
        assert acc > LEAKAGE_SUSPECT_THRESHOLD, (
            f"Sanity check failed: expected the deliberately-leaky toy label to be trivially "
            f"recoverable (>{LEAKAGE_SUSPECT_THRESHOLD:.0%}), got accuracy={acc:.4f}"
        )
        assert is_leakage_suspect(acc, f1) is True, (
            "Leakage guard FAILED TO FIRE on a deliberately-leaky label formula - "
            "this is the exact failure mode Section 4 exists to prevent."
        )
