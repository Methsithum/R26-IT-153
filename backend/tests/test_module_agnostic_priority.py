"""
code_module_enc = -1 (UNKNOWN_MODULE_ENC) means "a real subject with no
OULAD module equivalent" - predict_priority()/explain_task() then average
over all 7 training module codes instead of trusting an arbitrary one.
"""
import numpy as np
import pytest

from app.services.study_planner.explain_service import explain_task
from app.services.study_planner.priority_service import (
    UNKNOWN_MODULE_ENC,
    _model,
    expand_unknown_module,
    predict_priority,
    validate_and_build_feature_row,
)
from app.services.study_planner.ordinal_monotonic_model import CLASS_ORDER


@pytest.fixture
def unknown_module_row(valid_feature_row):
    return {**valid_feature_row, "code_module_enc": UNKNOWN_MODULE_ENC}


def test_unknown_module_expands_to_every_training_module(unknown_module_row):
    rows = expand_unknown_module(validate_and_build_feature_row(unknown_module_row))
    assert list(rows["code_module_enc"]) == [float(i) for i in range(7)]


def test_known_module_is_left_alone(valid_feature_row):
    row = validate_and_build_feature_row(valid_feature_row)
    assert expand_unknown_module(row) is row


def test_prediction_is_the_mean_over_all_modules(unknown_module_row):
    expected = np.mean(
        [_model.predict_proba(validate_and_build_feature_row({**unknown_module_row, "code_module_enc": c}))[0] for c in range(7)],
        axis=0,
    )
    result = predict_priority(unknown_module_row)
    assert result["priority_label"] == CLASS_ORDER[int(expected.argmax())]
    assert result["confidence"] == pytest.approx(float(expected.max()))


def test_explanation_matches_prediction_and_never_cites_the_module(unknown_module_row):
    explanation = explain_task(unknown_module_row)
    assert explanation["predicted_priority"] == predict_priority(unknown_module_row)["priority_label"]
    assert explanation["feature_contributions"]["code_module_enc"] == 0.0
    assert "code_module_enc" not in explanation["explanation_sentence"]
