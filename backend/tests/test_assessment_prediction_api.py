"""
Tests for the assessment-prediction serving layer (routes, storage model,
actual-mark hook). Every MongoDB collection the code under test could touch
is replaced by tests/fakes/fake_mongo.FakeCollection; any collection NOT
explicitly faked is replaced by a guard that raises RuntimeError on any
operation, so a test can never silently reach a real database (see
test_guard_raises_on_unpatched_collection_access).

No new test-only package is introduced. Async route/service functions are
awaited directly (not through httpx.TestClient(app)) - TestClient(app) would
trigger app.main's real @app.on_event("startup") handler
(UserModel.ensure_gpa_field()), which is unrelated to this feature and would
be a real, unmocked DB call outside this task's scope. Calling the route
coroutine functions directly exercises the exact same code this task wrote,
without that unrelated side effect.
"""

import sys
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
import pytest
from bson import ObjectId
from fastapi import HTTPException
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

sys.path.insert(0, "tests")  # so `from fakes.fake_mongo import ...` resolves without an __init__.py chain
from fakes.fake_mongo import FakeCollection, _RealDbAccessGuard  # noqa: E402

import app.models.assessment_prediction.prediction as prediction_module
import app.models.journal.daily_session as daily_session_module
import app.models.journal.exam as exam_module
import app.models.journal.learning_pattern as learning_pattern_module
import app.models.journal.task as task_module
import app.models.user.user as user_module
import app.services.assessment_prediction.model_loader as model_loader
from app.routes.assessment_prediction.predict import PredictRequest, health, history, predict, upcoming
from app.services.assessment_prediction.model_loader import BundleNotFoundError
from app.services.time_utils import local_today


# ===========================================================================
# AUTOUSE GUARD - every relevant collection defaults to "raise on touch"
# ===========================================================================

GUARDED_MODULES_AND_ATTR = [
    (user_module, "user_collection"),
    (exam_module, "exam_collection"),
    (task_module, "task_collection"),
    (prediction_module, "prediction_collection"),
    (daily_session_module, "session_collection"),
    (learning_pattern_module, "learning_patterns_collection"),
]


@pytest.fixture(autouse=True)
def guard_all_real_collections(monkeypatch):
    for module, attr in GUARDED_MODULES_AND_ATTR:
        monkeypatch.setattr(module, attr, _RealDbAccessGuard())
    model_loader.reset_cache_for_tests()
    yield
    model_loader.reset_cache_for_tests()


def fake_out(monkeypatch, module, attr, docs=None):
    fake = FakeCollection(docs or [])
    monkeypatch.setattr(module, attr, fake)
    return fake


# ===========================================================================
# GUARD PROOF
# ===========================================================================

@pytest.mark.anyio
async def test_guard_raises_on_unpatched_collection_access():
    """An untouched (not-faked) collection must raise, proving the guard actually works."""
    with pytest.raises(RuntimeError, match="real DB access attempted in test"):
        exam_module.exam_collection.find_one({"anything": True})


# ===========================================================================
# Fixtures: a valid user id, a stub trained bundle
# ===========================================================================

@pytest.fixture
def user_oid():
    return str(ObjectId())


@pytest.fixture
def stub_bundle():
    """A tiny REAL fitted sklearn pipeline with the journal_compatible feature names - not the real artifact."""
    features = ["prev_mean", "prev_last", "prev_count", "assessment_type"]
    numeric = ["prev_mean", "prev_last", "prev_count"]
    categorical = ["assessment_type"]
    pre = ColumnTransformer([
        ("num", Pipeline([("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler())]), numeric),
        ("cat", Pipeline([("impute", SimpleImputer(strategy="constant", fill_value="missing")),
                           ("onehot", OneHotEncoder(handle_unknown="ignore"))]), categorical),
    ])
    model = Pipeline([("pre", pre), ("model", Ridge(alpha=1))])
    X_train = pd.DataFrame([
        {"prev_mean": 60, "prev_last": 55, "prev_count": 2, "assessment_type": "TMA"},
        {"prev_mean": 75, "prev_last": 80, "prev_count": 3, "assessment_type": "CMA"},
        {"prev_mean": 40, "prev_last": 35, "prev_count": 1, "assessment_type": "Exam"},
        {"prev_mean": 90, "prev_last": 88, "prev_count": 4, "assessment_type": "TMA"},
    ])
    y_train = pd.Series([58, 78, 38, 89])
    model.fit(X_train, y_train)
    return {
        "model": model,
        "features": features,
        "conformal_q": 20.0,
        "alpha": 0.1,
        "feature_set": "journal_compatible",
        "pass_mark": 40,
        "trained_on": "unit-test-stub",
        "sklearn_version": "test",
        "trained_at": "2026-01-01T00:00:00+00:00",
    }


@pytest.fixture
def install_stub_bundle(stub_bundle):
    model_loader._bundle = stub_bundle
    yield stub_bundle
    model_loader.reset_cache_for_tests()


# ===========================================================================
# 3. Endpoint 200 with a valid range
# ===========================================================================

@pytest.mark.anyio
async def test_predict_returns_200_with_valid_range(monkeypatch, user_oid, install_stub_bundle):
    fake_out(monkeypatch, user_module, "user_collection", [{"_id": ObjectId(user_oid), "name": "Test"}])
    fake_out(monkeypatch, exam_module, "exam_collection", [
        {"_id": ObjectId(), "user_id": user_oid, "subject": "Databases", "exam_type": "mid",
         "date": "2026-08-10", "mark": 62},
    ])
    fake_out(monkeypatch, task_module, "task_collection", [])
    fake_out(monkeypatch, prediction_module, "prediction_collection", [])
    fake_out(monkeypatch, daily_session_module, "session_collection", [])
    fake_out(monkeypatch, learning_pattern_module, "learning_patterns_collection", [])

    payload = PredictRequest(
        user_id=user_oid, subject="Databases", assessment_kind="exam",
        exam_type="final", assessment_date="2026-11-20",
    )
    result = await predict(payload)

    assert 0 <= result["range_low"] <= result["estimated_mark"] <= result["range_high"] <= 100
    assert result["feature_set"] == "journal_compatible"
    assert result["n_previous_marks"] == 1
    assert result["prediction_id"]


# ===========================================================================
# 4. Endpoint 503 when the bundle file is missing
# ===========================================================================

@pytest.mark.anyio
async def test_predict_returns_503_when_bundle_missing(monkeypatch, user_oid):
    monkeypatch.setattr(model_loader, "MODEL_PATH", __import__("pathlib").Path("Z:/does/not/exist.joblib"))
    fake_out(monkeypatch, user_module, "user_collection", [{"_id": ObjectId(user_oid), "name": "Test"}])
    fake_out(monkeypatch, exam_module, "exam_collection", [])
    fake_out(monkeypatch, task_module, "task_collection", [])

    payload = PredictRequest(user_id=user_oid, subject="Databases", assessment_kind="exam", exam_type="final")
    with pytest.raises(HTTPException) as exc_info:
        await predict(payload)
    assert exc_info.value.status_code == 503
    assert "not found" in exc_info.value.detail.lower()


@pytest.mark.anyio
async def test_health_reports_bundle_not_loaded_without_raising(monkeypatch):
    monkeypatch.setattr(model_loader, "MODEL_PATH", __import__("pathlib").Path("Z:/does/not/exist.joblib"))
    body = health()
    assert body["bundle_loaded"] is False


@pytest.mark.anyio
async def test_health_reports_bundle_loaded(install_stub_bundle):
    body = health()
    assert body["bundle_loaded"] is True
    assert body["feature_set"] == "journal_compatible"


# ===========================================================================
# 5. Cold start
# ===========================================================================

@pytest.mark.anyio
async def test_cold_start_no_previous_marks(monkeypatch, user_oid, install_stub_bundle):
    fake_out(monkeypatch, user_module, "user_collection", [{"_id": ObjectId(user_oid), "name": "Test"}])
    fake_out(monkeypatch, exam_module, "exam_collection", [])
    fake_out(monkeypatch, task_module, "task_collection", [])
    fake_out(monkeypatch, prediction_module, "prediction_collection", [])
    fake_out(monkeypatch, daily_session_module, "session_collection", [])
    fake_out(monkeypatch, learning_pattern_module, "learning_patterns_collection", [])

    payload = PredictRequest(
        user_id=user_oid, subject="Networks", assessment_kind="exam",
        exam_type="mid", assessment_date="2026-11-25",
    )
    result = await predict(payload)

    assert result["n_previous_marks"] == 0
    assert result["warning"] == "cold_start: low confidence"


# ===========================================================================
# 6. Validation: malformed ObjectId, unknown user, unknown exam_type
# ===========================================================================

@pytest.mark.anyio
async def test_malformed_user_id_returns_422(install_stub_bundle):
    payload = PredictRequest(user_id="not-an-object-id", subject="X", assessment_kind="exam", exam_type="mid")
    with pytest.raises(HTTPException) as exc_info:
        await predict(payload)
    assert exc_info.value.status_code == 422


@pytest.mark.anyio
async def test_unknown_user_returns_404(monkeypatch, install_stub_bundle):
    fake_out(monkeypatch, user_module, "user_collection", [])  # no such user
    payload = PredictRequest(user_id=str(ObjectId()), subject="X", assessment_kind="exam", exam_type="mid")
    with pytest.raises(HTTPException) as exc_info:
        await predict(payload)
    assert exc_info.value.status_code == 404


@pytest.mark.anyio
async def test_invalid_exam_type_returns_422(monkeypatch, user_oid, install_stub_bundle):
    fake_out(monkeypatch, user_module, "user_collection", [{"_id": ObjectId(user_oid), "name": "Test"}])
    payload = PredictRequest(user_id=user_oid, subject="X", assessment_kind="exam", exam_type="not-a-real-type")
    with pytest.raises(HTTPException) as exc_info:
        await predict(payload)
    assert exc_info.value.status_code == 422


@pytest.mark.anyio
async def test_history_malformed_user_id_returns_422():
    with pytest.raises(HTTPException) as exc_info:
        await history("not-an-object-id")
    assert exc_info.value.status_code == 422


# ===========================================================================
# 7. Upsert: two predictions same (user, assessment, day) -> one document
# ===========================================================================

@pytest.mark.anyio
async def test_upsert_same_day_leaves_one_document(monkeypatch, user_oid, install_stub_bundle):
    fake_out(monkeypatch, user_module, "user_collection", [{"_id": ObjectId(user_oid), "name": "Test"}])
    fake_out(monkeypatch, exam_module, "exam_collection", [
        {"_id": ObjectId(), "user_id": user_oid, "subject": "Databases", "exam_type": "mid",
         "date": "2026-08-10", "mark": 62},
    ])
    fake_out(monkeypatch, task_module, "task_collection", [])
    pred_collection = fake_out(monkeypatch, prediction_module, "prediction_collection", [])
    fake_out(monkeypatch, daily_session_module, "session_collection", [])
    fake_out(monkeypatch, learning_pattern_module, "learning_patterns_collection", [])

    payload = PredictRequest(
        user_id=user_oid, subject="Databases", assessment_kind="exam",
        exam_type="final", assessment_date="2026-11-20",
    )
    await predict(payload)
    await predict(payload)  # same user/assessment/day again

    assert len(pred_collection._docs) == 1


# ===========================================================================
# 8. Actual-mark hook
# ===========================================================================

@pytest.mark.anyio
async def test_actual_mark_hook_fills_prediction_on_exam_mark_save(monkeypatch, user_oid):
    exam_id = ObjectId()
    exam_doc = {
        "_id": exam_id, "user_id": user_oid, "subject": "Databases", "exam_type": "final",
        "date": "2026-11-20", "mark": None, "last_mark_check": None, "updated_at": datetime.utcnow(),
    }
    fake_exams = fake_out(monkeypatch, exam_module, "exam_collection", [exam_doc])

    pending_prediction = {
        "_id": ObjectId(), "userId": user_oid, "subject": "Databases",
        "assessmentRef": str(exam_id), "predictionDay": "2026-11-01",
        "actualMark": None, "actualMarkRaw": None, "actualRecordedAt": None,
        "createdAt": datetime.utcnow(),
    }
    fake_predictions = fake_out(monkeypatch, prediction_module, "prediction_collection", [pending_prediction])

    await exam_module.ExamModel.set_mark(str(exam_id), 91)

    updated = fake_predictions.find_one({"_id": pending_prediction["_id"]})
    assert updated["actualMark"] == 91.0
    assert updated["actualMarkRaw"] == 91
    assert updated["actualRecordedAt"] is not None
    # set_mark's own effect on the exam doc must be unchanged.
    assert fake_exams.find_one({"_id": exam_id})["mark"] == 91


@pytest.mark.anyio
async def test_actual_mark_hook_converts_letter_grade(monkeypatch, user_oid):
    exam_id = ObjectId()
    exam_doc = {
        "_id": exam_id, "user_id": user_oid, "subject": "Software Engineering", "exam_type": "final",
        "date": "2026-09-10", "mark": None, "last_mark_check": None, "updated_at": datetime.utcnow(),
    }
    fake_out(monkeypatch, exam_module, "exam_collection", [exam_doc])

    pending_prediction = {
        "_id": ObjectId(), "userId": user_oid, "subject": "Software Engineering",
        "assessmentRef": str(exam_id), "predictionDay": "2026-09-01",
        "actualMark": None, "actualMarkRaw": None, "actualRecordedAt": None,
        "createdAt": datetime.utcnow(),
    }
    fake_predictions = fake_out(monkeypatch, prediction_module, "prediction_collection", [pending_prediction])

    await exam_module.ExamModel.set_mark(str(exam_id), "B+")

    updated = fake_predictions.find_one({"_id": pending_prediction["_id"]})
    assert updated["actualMark"] == 77  # LETTER_GRADE_TO_PERCENT["B+"]
    assert updated["actualMarkRaw"] == "B+"


@pytest.mark.anyio
async def test_actual_mark_hook_is_noop_with_no_pending_prediction(monkeypatch, user_oid):
    exam_id = ObjectId()
    exam_doc = {
        "_id": exam_id, "user_id": user_oid, "subject": "Databases", "exam_type": "final",
        "date": "2026-11-20", "mark": None, "last_mark_check": None, "updated_at": datetime.utcnow(),
    }
    fake_exams = fake_out(monkeypatch, exam_module, "exam_collection", [exam_doc])
    fake_out(monkeypatch, prediction_module, "prediction_collection", [])  # nothing pending

    # Must not raise, and must still set the mark normally.
    await exam_module.ExamModel.set_mark(str(exam_id), 70)
    assert fake_exams.find_one({"_id": exam_id})["mark"] == 70


@pytest.mark.anyio
async def test_set_mark_succeeds_even_if_hook_raises_internally(monkeypatch, user_oid):
    exam_id = ObjectId()
    exam_doc = {
        "_id": exam_id, "user_id": user_oid, "subject": "Databases", "exam_type": "final",
        "date": "2026-11-20", "mark": None, "last_mark_check": None, "updated_at": datetime.utcnow(),
    }
    fake_exams = fake_out(monkeypatch, exam_module, "exam_collection", [exam_doc])

    async def _boom(*args, **kwargs):
        raise RuntimeError("simulated hook failure")

    monkeypatch.setattr("app.services.assessment_prediction.actual_mark_hook.on_exam_mark_saved", _boom)

    # Must not raise despite the hook blowing up, and must still set the mark.
    await exam_module.ExamModel.set_mark(str(exam_id), 88)
    assert fake_exams.find_one({"_id": exam_id})["mark"] == 88


@pytest.mark.anyio
async def test_task_actual_mark_hook_fills_prediction_for_newly_created_task(monkeypatch, user_oid):
    """
    Covers TaskModel.set_mark's "no existing assignment - create a new one"
    branch specifically (no task document exists for this subject at all
    before set_mark is called), confirming created["_id"] (TaskModel.create
    returns the raw doc with "_id", not a serialized "id") is correctly
    passed to the hook - and that the hook's synthetic-ref fallback
    (f"{subject}|task|new") finds a prediction stored before any task
    document existed.
    """
    fake_tasks = fake_out(monkeypatch, task_module, "task_collection", [])  # no tasks at all yet

    pending_prediction = {
        "_id": ObjectId(), "userId": user_oid, "subject": "Networks",
        "assessmentRef": "Networks|task|new", "predictionDay": "2026-08-01",
        "actualMark": None, "actualMarkRaw": None, "actualRecordedAt": None,
        "createdAt": datetime.utcnow(),
    }
    fake_predictions = fake_out(monkeypatch, prediction_module, "prediction_collection", [pending_prediction])

    await task_module.TaskModel.set_mark(user_id=user_oid, subject="Networks", mark=82, task_id=None)

    updated = fake_predictions.find_one({"_id": pending_prediction["_id"]})
    assert updated["actualMark"] == 82.0
    # confirms the real newly-created task's mark was set (created["_id"] path exercised).
    created_task = fake_tasks.find_one({"user_id": user_oid, "subject": "Networks"})
    assert created_task is not None
    assert created_task["mark"] == 82


@pytest.mark.anyio
async def test_task_actual_mark_hook_fills_prediction(monkeypatch, user_oid):
    task_id = ObjectId()
    task_doc = {
        "_id": task_id, "user_id": user_oid, "title": "Databases assignment", "subject": "Databases",
        "task_type": "assignment", "progress_stage": "in_progress", "deadline": "2026-08-30",
        "mark": None, "created_at": datetime.utcnow(), "updated_at": datetime.utcnow(),
    }
    fake_tasks = fake_out(monkeypatch, task_module, "task_collection", [task_doc])

    pending_prediction = {
        "_id": ObjectId(), "userId": user_oid, "subject": "Databases",
        "assessmentRef": str(task_id), "predictionDay": "2026-08-01",
        "actualMark": None, "actualMarkRaw": None, "actualRecordedAt": None,
        "createdAt": datetime.utcnow(),
    }
    fake_predictions = fake_out(monkeypatch, prediction_module, "prediction_collection", [pending_prediction])

    await task_module.TaskModel.set_mark(user_id=user_oid, subject="Databases", mark=70, task_id=str(task_id))

    updated = fake_predictions.find_one({"_id": pending_prediction["_id"]})
    assert updated["actualMark"] == 70.0
    assert fake_tasks.find_one({"_id": task_id})["mark"] == 70


# ===========================================================================
# GET /assessment-prediction/upcoming/{user_id}
# ===========================================================================

def _iso(days_offset):
    return (local_today() + timedelta(days=days_offset)).isoformat()


@pytest.mark.anyio
async def test_upcoming_sorted_and_filters_marked_past_undated(monkeypatch, user_oid):
    fake_out(monkeypatch, user_module, "user_collection", [{"_id": ObjectId(user_oid), "name": "Test"}])
    fake_out(monkeypatch, exam_module, "exam_collection", [
        {"_id": ObjectId(), "user_id": user_oid, "subject": "Networks", "exam_type": "final",
         "date": _iso(10), "mark": None},  # upcoming, unmarked -> included
        {"_id": ObjectId(), "user_id": user_oid, "subject": "Databases", "exam_type": "mid",
         "date": _iso(3), "mark": None},  # upcoming, sooner -> included, should come first
        {"_id": ObjectId(), "user_id": user_oid, "subject": "Marked Subject", "exam_type": "quiz",
         "date": _iso(5), "mark": 80},  # has a mark -> excluded
        {"_id": ObjectId(), "user_id": user_oid, "subject": "Past Subject", "exam_type": "lab",
         "date": _iso(-5), "mark": None},  # in the past -> excluded
        {"_id": ObjectId(), "user_id": user_oid, "subject": "Undated Subject", "exam_type": "mid",
         "date": None, "mark": None},  # no date -> excluded
    ])
    fake_out(monkeypatch, task_module, "task_collection", [
        {"_id": ObjectId(), "user_id": user_oid, "subject": "Databases", "title": "Databases assignment",
         "deadline": _iso(7), "mark": None},  # upcoming, unmarked -> included
    ])

    body = await upcoming(user_oid)

    assert body["user_id"] == user_oid
    subjects_in_order = [it["subject"] for it in body["items"]]
    assert subjects_in_order == ["Databases", "Databases", "Networks"]  # sorted by date: day3 (exam), day7 (task), day10 (exam)
    assert len(body["items"]) == 3  # marked, past, undated all excluded
    assert all(it["days_left"] >= 0 for it in body["items"])
    task_item = next(it for it in body["items"] if it["kind"] == "task")
    assert task_item["task_id"] is not None
    assert task_item["title"] == "Databases assignment"
    exam_item = next(it for it in body["items"] if it["kind"] == "exam" and it["subject"] == "Networks")
    assert exam_item["exam_type"] == "final"
    assert exam_item["task_id"] is None


@pytest.mark.anyio
async def test_upcoming_malformed_user_id_returns_422():
    with pytest.raises(HTTPException) as exc_info:
        await upcoming("not-an-object-id")
    assert exc_info.value.status_code == 422


@pytest.mark.anyio
async def test_upcoming_unknown_user_returns_404(monkeypatch):
    fake_out(monkeypatch, user_module, "user_collection", [])
    with pytest.raises(HTTPException) as exc_info:
        await upcoming(str(ObjectId()))
    assert exc_info.value.status_code == 404


@pytest.mark.anyio
async def test_upcoming_never_returns_other_users_items(monkeypatch, user_oid):
    other_user_id = str(ObjectId())
    fake_out(monkeypatch, user_module, "user_collection", [{"_id": ObjectId(user_oid), "name": "Test"}])
    fake_out(monkeypatch, exam_module, "exam_collection", [
        {"_id": ObjectId(), "user_id": user_oid, "subject": "Mine", "exam_type": "mid",
         "date": _iso(5), "mark": None},
        {"_id": ObjectId(), "user_id": other_user_id, "subject": "Not Mine", "exam_type": "mid",
         "date": _iso(5), "mark": None},
    ])
    fake_out(monkeypatch, task_module, "task_collection", [])

    body = await upcoming(user_oid)

    subjects = [it["subject"] for it in body["items"]]
    assert subjects == ["Mine"]
    assert "Not Mine" not in subjects
