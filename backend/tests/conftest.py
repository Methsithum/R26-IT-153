"""
Shared pytest fixtures for the backend/ML test suite.

Ensures `backend/` (for `app.*` imports) and `backend/ml_scripts/study-planner`
(for schedule_engine.py, sensitivity_analysis.py etc., which are scripts, not
an installed package) are both importable, the same way the app code itself
adds ml_scripts to sys.path at runtime (see schedule_service.py).
"""

import os
import sys

import pytest

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ML_SCRIPTS_DIR = os.path.join(BACKEND_DIR, "ml_scripts", "study-planner")

for p in (BACKEND_DIR, ML_SCRIPTS_DIR):
    if p not in sys.path:
        sys.path.insert(0, p)


@pytest.fixture(scope="session")
def ml_outputs_dir():
    import pathlib
    return pathlib.Path(ML_SCRIPTS_DIR) / "outputs"


@pytest.fixture(scope="session")
def fastapi_app():
    from app.main import app
    return app


@pytest.fixture(scope="session")
def api_client(fastapi_app):
    from fastapi.testclient import TestClient
    with TestClient(fastapi_app) as client:
        yield client


@pytest.fixture
def valid_feature_row():
    """
    A realistic, in-distribution 13-feature row - a TMA due in ~28 days
    (date~50.7, matching the buildDateFeatureFromDeadline mapping used
    throughout this project's real investigations), weight 20, no prior
    marks (prior_avg_score=65 default), module AAA.
    """
    return {
        "date": 50.73,
        "weight": 20.0,
        "num_of_prev_attempts": 0,
        "studied_credits": 60,
        "module_presentation_length": 240,
        "date_registration": -30,
        "prior_avg_score": 65,
        "avg_weekly_clicks": 15,
        "clicks_trend": 0,
        "active_weeks_ratio": 0.5,
        "has_vle_activity": 1,
        "assessment_type_enc": 2,
        "code_module_enc": 0,
    }


@pytest.fixture
def scenarios():
    """Phase 1/2's fixed light/typical/heavy scenarios, reused as-is per the task's instruction."""
    from sensitivity_analysis import SCENARIOS
    return SCENARIOS


@pytest.fixture
def build_scenario_tasks():
    """
    Returns build_tasks_for_scenario(name) -> (tasks, free_slots), using
    Phase 2's exact task-construction helpers (current production constants)
    so scheduler tests exercise the real hybrid-layer + exam-prep pipeline,
    not a separate hand-rolled task list.
    """
    from scheduler_baselines import build_tasks_for_scenario
    return build_tasks_for_scenario
