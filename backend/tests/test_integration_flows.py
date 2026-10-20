"""
Cross-component integration tests for Smart Uni Guide (R26-IT-153).

Every test drives the real FastAPI app through TestClient, end to end, across
two or more components (journal, study planner, focus, career).

Isolation:
  - MongoDB is replaced by an in-memory mongomock client, so these tests never
    write to the database configured in backend/.env. The swap happens on a
    freshly imported copy of the `app` package (module-scoped `env` fixture),
    because collections are bound at import time; the original modules are put
    back afterwards so the rest of the suite is unaffected.
  - The OpenAI client is patched to raise for the whole module, so no test can
    make a network call; IT-08 installs its own mocks on top of that.

Where a flow is composed in the frontend rather than the backend (the frontend
reads one API and posts to another), the test makes exactly the same calls
with exactly the same field mapping as the frontend code it names, and says so.
"""

import json
import sys
import uuid
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import mongomock
import pytest
from bson import ObjectId
from fastapi.testclient import TestClient

# --- Values copied from the frontend, so requests match what the app sends ---

# frontend/src/utils/featureNameMap.js
TRAINED_DATE_MIN, TRAINED_DATE_MAX, CAP_DAYS = 12, 261, 180
DEFAULT_PRIOR_AVG_SCORE = 76.452355
DEFAULT_ASSIGNMENT_WEIGHT = 9
NEUTRAL_FEATURE_DEFAULTS = {
    "num_of_prev_attempts": 0,
    "studied_credits": 60,
    "module_presentation_length": 261,
    "date_registration": -53,
    "avg_weekly_clicks": 46,
    "clicks_trend": -31.6,
    "active_weeks_ratio": 1,
    "has_vle_activity": 1,
}
ASSESSMENT_TYPE_TMA = 2
UNKNOWN_MODULE_ENC = -1

# frontend/src/utils/extractFeatures.js (DEFAULTS, SURVEY_DEFAULTS, CAREER_CLARITY_DEFAULT)
CAREER_COLD_START_FEATURES = {
    "gpa_cumulative": 3.0,
    "gpa_trend": 0.0,
    "assignment_completion_rate": 0.8,
    "late_submission_rate": 0.15,
    "resit_count": 0,
    "project_performance": 70,
    "attendance_rate": 0.8,
    "weekly_study_hours": 14,
    "stress_level": 50,
    "anxiety_score": 10,
    "mood_stability": 60,
    "sleep_hours_avg": 6.5,
    "sleep_consistency": 1.2,
    "part_time_work_hours": 10,
    "career_clarity_score": 50,
}

EVENING_FREE_SLOTS = [
    {"day": d, "start_time": "18:00", "end_time": "21:00", "duration_minutes": 180}
    for d in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
]
PRIORITIES = {"Low", "Medium", "High"}


# =============================================================================
# Fixtures and helpers
# =============================================================================

def _app_modules():
    return [name for name in sys.modules if name == "app" or name.startswith("app.")]


@pytest.fixture(scope="module")
def env():
    saved = {name: sys.modules.pop(name) for name in _app_modules()}
    settings_env = pytest.MonkeyPatch()
    # Placeholder settings so the run never depends on (or reaches) the real
    # .env services: Mongo is mongomock below and the LLM is patched out.
    settings_env.setenv("MONGODB_URL", "mongodb://integration-tests.invalid:27017")
    settings_env.setenv("DATABASE_NAME", "smart_uni_guide_integration_tests")
    settings_env.setenv("OPENAI_API_KEY", "sk-integration-tests-no-network")
    try:
        import app.config.database as database

        database._client = mongomock.MongoClient()

        from app.main import app as fastapi_app
        import app.services.journal.llm_service as llm_service
        from app.services.journal.question_bank import QUESTION_BANK, QUESTION_BY_ID
        from app.services.time_utils import local_today, local_today_iso

        llm_disabled = AsyncMock(side_effect=RuntimeError("LLM disabled in integration tests"))
        with patch.object(llm_service.client.chat.completions, "create", llm_disabled), \
                TestClient(fastapi_app) as client:
            yield SimpleNamespace(
                client=client,
                db=database.get_db(),
                llm=llm_service,
                question_bank=QUESTION_BANK,
                question_by_id=QUESTION_BY_ID,
                today=local_today,
                today_iso=local_today_iso,
            )
    finally:
        settings_env.undo()
        for name in _app_modules():
            del sys.modules[name]
        sys.modules.update(saved)


def _register(env, subjects=("Data Structures", "Databases")):
    payload = {
        "email": f"it-{uuid.uuid4().hex[:12]}@example.com",
        "password": "integration-pass",
        "name": "Integration Student",
        "age": 22,
        "university_name": "SLIIT",
        "degree_name": "BSc (Hons) in Information Technology",
        "campus_year": 1,
        "semester": 1,
        "subjects": list(subjects),
    }
    res = env.client.post("/users/register", json=payload)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body.get("access_token"), "register returned no access_token"
    return SimpleNamespace(
        id=body["id"],
        email=payload["email"],
        password=payload["password"],
        headers={"Authorization": f"Bearer {body['access_token']}"},
    )


def _start_journal(env, user, **fields):
    body = {"user_id": user.id, "date": f"{env.today_iso()}T09:00:00", **fields}
    res = env.client.post("/daily/start", headers=user.headers, json=body)
    assert res.status_code == 200, res.text
    return res.json()


def _answer(env, user, question, answer):
    res = env.client.post(
        "/daily/answer", headers=user.headers,
        json={"session_id": question["session_id"], "answer": answer},
    )
    assert res.status_code == 200, res.text
    return res.json()


def _first_option(question):
    return (question.get("options") or ["ok"])[0]


def _user_tasks(env, user):
    res = env.client.get(f"/users/{user.id}/tasks", headers=user.headers)
    assert res.status_code == 200, res.text
    return res.json()["tasks"]


def _create_assignment_via_journal(env, subject, deadline):
    """
    The journal's own path for a new assignment: a daily session with
    assignment_work creates the task (TaskModel.ensure_assignment), and the
    date-picker answer to `asg-deadline-check` records its deadline
    (TaskModel.set_deadline).
    """
    user = _register(env, subjects=(subject, "Databases"))
    question = _start_journal(
        env, user,
        selected_activities=["assignment_work"],
        assignment_subjects=[subject],
        today_subjects=[subject],
        study_duration_minutes=60,
    )
    for _ in range(6):
        if question.get("question_id") == "asg-deadline-check":
            break
        question = _answer(env, user, question, _first_option(question))
    else:
        pytest.fail("Journal never asked for the assignment deadline (asg-deadline-check).")
    user.session_id = question["session_id"]
    _answer(env, user, question, deadline.isoformat())

    tasks = [t for t in _user_tasks(env, user) if t.get("subject") == subject and t.get("task_type") == "assignment"]
    assert len(tasks) == 1, f"expected one {subject} assignment, got {tasks}"
    task = tasks[0]
    assert str(task.get("deadline"))[:10] == deadline.isoformat(), task
    return user, task


def _feature_row(env, task):
    """Python port of useAcademicStore.js buildFromJournal's featureRow for a journal task."""
    days = (
        __import__("datetime").date.fromisoformat(str(task["deadline"])[:10]) - env.today()
    ).days
    remaining = max(0, min(days, CAP_DAYS))
    has_weight = task.get("weight") is not None
    return {
        "date": TRAINED_DATE_MIN + (remaining / CAP_DAYS) * (TRAINED_DATE_MAX - TRAINED_DATE_MIN),
        "weight": float(task["weight"]) if has_weight else DEFAULT_ASSIGNMENT_WEIGHT,
        **NEUTRAL_FEATURE_DEFAULTS,
        "prior_avg_score": DEFAULT_PRIOR_AVG_SCORE,
        "assessment_type_enc": ASSESSMENT_TYPE_TMA,
        "code_module_enc": UNKNOWN_MODULE_ENC,
    }


def _schedule_task(env, task):
    row = _feature_row(env, task)
    return {
        "task_id": task["id"],
        "module": task["subject"],
        "deadline_date": str(task["deadline"])[:10],
        "weight": row["weight"],
        "estimated_hours_needed": 3,
        "task_type": "assignment",
        "feature_row": row,
    }


def _sessions_for(schedule_response, task_id):
    return [
        session
        for day_sessions in schedule_response["schedule"].values()
        for session in day_sessions
        if session.get("task_id") == task_id
    ]


def _llm_reply(payload):
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(payload)))])


# =============================================================================
# IT-01 Shared auth
# =============================================================================

def test_it01_register_and_login_return_a_token(env):
    user = _register(env)
    res = env.client.post("/users/login", json={"email": user.email, "password": user.password})
    assert res.status_code == 200, res.text
    token = res.json().get("access_token")
    assert token
    res = env.client.get(f"/users/{user.id}", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200, res.text


# One user-scoped read endpoint per component, taken from the routers.
PROTECTED_ENDPOINTS = {
    "journal": lambda uid: f"/users/{uid}/tasks",
    "study_planner": lambda uid: f"/study-planner/sessions/stats?user_id={uid}",
    "focus": lambda uid: f"/focus/emotional?user_id={uid}",
    "career": lambda uid: f"/career/history/{uid}",
}


@pytest.mark.parametrize("component", list(PROTECTED_ENDPOINTS))
def test_it01_protected_endpoint_requires_token(env, component):
    user = _register(env)
    path = PROTECTED_ENDPOINTS[component](user.id)

    anonymous = env.client.get(path)
    assert anonymous.status_code == 401, (
        f"{component}: GET {path} without a token returned {anonymous.status_code}, expected 401"
    )
    authed = env.client.get(path, headers=user.headers)
    assert authed.status_code == 200, authed.text


# =============================================================================
# IT-02 Journal -> Planner
# =============================================================================

def test_it02_journal_task_flows_into_planner_priority_and_schedule(env):
    deadline = env.today() + timedelta(days=20)
    user, task = _create_assignment_via_journal(env, "Data Structures", deadline)
    assert task["task_type"] == "assignment" and task["subject"] == "Data Structures"
    # A new, in-progress assignment has no mark yet; the journal only records
    # one after submission, so `mark` is checked to be absent, not set.
    assert task.get("mark") is None

    priority = env.client.post("/study-planner/predict-priority", headers=user.headers, json=_feature_row(env, task))
    assert priority.status_code == 200, priority.text
    assert priority.json()["priority_label"] in PRIORITIES

    schedule = env.client.post(
        "/study-planner/schedule", headers=user.headers,
        json={"weekly_free_slots": EVENING_FREE_SLOTS, "tasks": [_schedule_task(env, task)]},
    )
    assert schedule.status_code == 200, schedule.text
    body = schedule.json()
    assert body["tasks"][task["id"]]["priority_label"] in PRIORITIES
    assert _sessions_for(body, task["id"]), f"no session scheduled for task {task['id']}: {body['schedule']}"


# =============================================================================
# IT-03 Deadline change -> High
# =============================================================================

def test_it03_moving_deadline_to_tomorrow_makes_priority_high(env):
    """
    The final priority is the one the planner schedules by (and the frontend
    shows): the urgent floor makes it High even when the raw model label is
    lower. /predict-priority stays the raw model output by design, so its
    label is only reported in the failure message.
    """
    user, task = _create_assignment_via_journal(env, "Databases", env.today() + timedelta(days=20))

    tomorrow = (env.today() + timedelta(days=1)).isoformat()
    res = env.client.patch(
        f"/study-planner/tasks/{task['id']}/deadline", headers=user.headers, json={"deadline": tomorrow}
    )
    assert res.status_code == 200, res.text

    updated = next(t for t in _user_tasks(env, user) if t["id"] == task["id"])
    assert str(updated["deadline"])[:10] == tomorrow

    raw = env.client.post("/study-planner/predict-priority", headers=user.headers, json=_feature_row(env, updated))
    assert raw.status_code == 200, raw.text

    schedule = env.client.post(
        "/study-planner/schedule", headers=user.headers,
        json={"weekly_free_slots": EVENING_FREE_SLOTS, "tasks": [_schedule_task(env, updated)]},
    )
    assert schedule.status_code == 200, schedule.text
    final = schedule.json()["tasks"][task["id"]]["priority_label"]
    assert final == "High", f"due tomorrow -> final {final} (raw model label {raw.json()})"


# =============================================================================
# IT-04 Completion write-back
# =============================================================================

def test_it04_complete_writes_back_to_mongodb(env):
    user, task = _create_assignment_via_journal(env, "Data Structures", env.today() + timedelta(days=10))
    assert env.db["tasks"].find_one({"_id": ObjectId(task["id"])})["progress_stage"] != "completed"

    res = env.client.patch(f"/study-planner/tasks/{task['id']}/complete", headers=user.headers)
    assert res.status_code == 200, res.text

    doc = env.db["tasks"].find_one({"_id": ObjectId(task["id"])})
    assert doc["progress_stage"] == "completed"
    assert doc["completed_at"] == env.today_iso()
    journal_view = next(t for t in _user_tasks(env, user) if t["id"] == task["id"])
    assert journal_view["progress_stage"] == "completed"


# =============================================================================
# IT-05 Focus -> Career
# =============================================================================

def _career_input_from_focus(env, user):
    """extractFeatures.js: stress_level, anxiety_score (<- distraction_score) and mood_stability come from /focus/emotional."""
    res = env.client.get(f"/focus/emotional?user_id={user.id}", headers=user.headers)
    assert res.status_code == 200, res.text
    emotional = res.json()
    return emotional, {
        **CAREER_COLD_START_FEATURES,
        "stress_level": emotional["stress_level"],
        "anxiety_score": emotional["distraction_score"],
        "mood_stability": emotional["mood_stability"],
    }


def test_it05_focus_emotional_values_feed_career_prediction(env):
    """
    The backend half of this flow is POST /focus/sessions -> GET /focus/emotional;
    the frontend (extractFeatures.js) then copies those values into the
    /career/predict body. This test makes the same calls with the same mapping.
    """
    calm, stressed = _register(env), _register(env)
    for user, values in [
        (calm, {"stress_level": 15, "distraction_score": 3, "mood_stability": 90}),
        (stressed, {"stress_level": 90, "distraction_score": 22, "mood_stability": 15}),
    ]:
        res = env.client.post(
            "/focus/sessions", headers=user.headers,
            json={"user_id": user.id, "focus_minutes": 45, "distraction_minutes": 15, **values},
        )
        assert res.status_code == 200, res.text

    predictions = {}
    for name, user, expected in [
        ("calm", calm, (15, 3, 90)),
        ("stressed", stressed, (90, 22, 15)),
    ]:
        emotional, features = _career_input_from_focus(env, user)
        assert (emotional["stress_level"], emotional["distraction_score"], emotional["mood_stability"]) == expected
        res = env.client.post("/career/predict", headers=user.headers, json=features)
        assert res.status_code == 200, res.text
        predictions[name] = res.json()

    assert predictions["calm"]["career_score"] != predictions["stressed"]["career_score"], (
        f"career prediction ignored the focus values: {predictions}"
    )


# =============================================================================
# IT-06 Career data quality
# =============================================================================

def test_it06_career_data_quality_higher_with_journal_and_planner_data(env):
    pytest.skip(
        "No backend integration point: /career/predict takes 15 raw features (no user_id) and returns "
        "risk + career_score only. Data-quality % is computed in the frontend "
        "(extractFeatures.js summariseDataQuality) and the backend merely stores the client-sent "
        "value via POST /career/history; there is no backend endpoint that derives it from journal "
        "or planner data."
    )


# =============================================================================
# IT-07 Data isolation
# =============================================================================

def test_it07_user_cannot_read_another_users_journal_or_tasks(env):
    owner, task = _create_assignment_via_journal(env, "Data Structures", env.today() + timedelta(days=10))
    intruder = _register(env)
    client = env.client

    focus = client.post("/focus/sessions", headers=owner.headers,
                        json={"user_id": owner.id, "focus_minutes": 30, "stress_level": 40})
    assert focus.status_code == 200, focus.text
    saved = client.post("/career/history", headers=owner.headers, json={
        "user_id": owner.id, "prediction": {"academic_risk": "Low"}, "features": {}, "data_quality": {},
    })
    assert saved.status_code == 200, saved.text

    # Reads: the owner gets 200, the other user gets 403.
    owner_paths = [
        f"/users/{owner.id}/tasks",
        f"/users/{owner.id}/sessions",
        f"/daily/user/{owner.id}",
        f"/daily/{owner.session_id}",
        f"/study-planner/sessions/stats?user_id={owner.id}",
        f"/study-planner/semester-setup/{owner.id}",
        f"/focus/emotional?user_id={owner.id}",
        f"/focus/reports/daily?user_id={owner.id}",
        f"/career/history/{owner.id}",
    ]
    for path in owner_paths:
        assert client.get(path, headers=owner.headers).status_code == 200, path
        res = client.get(path, headers=intruder.headers)
        assert res.status_code == 403, f"intruder read {path}: {res.status_code} {res.text[:200]}"

    # Writes: the other user can't complete the owner's task or delete their career history.
    res = client.patch(f"/study-planner/tasks/{task['id']}/complete", headers=intruder.headers)
    assert res.status_code == 403, res.text
    assert env.db["tasks"].find_one({"_id": ObjectId(task["id"])})["progress_stage"] != "completed"

    res = client.delete(f"/career/history/{owner.id}", headers=intruder.headers)
    assert res.status_code == 403, res.text
    history = client.get(f"/career/history/{owner.id}", headers=owner.headers).json()
    assert len(history["predictions"]) == 1


# =============================================================================
# IT-08 LLM failure -> bank fallback
# =============================================================================

@pytest.mark.parametrize("failure", ["llm_raises", "llm_returns_unknown_id"])
def test_it08_llm_failure_still_returns_a_bank_question(env, failure):
    assert len(env.question_bank) == 79

    if failure == "llm_raises":
        llm = AsyncMock(side_effect=TimeoutError("simulated LLM outage"))
    else:
        llm = AsyncMock(return_value=_llm_reply(
            {"question_id": "not-a-real-question-id", "end_session": False, "task_updates": []}
        ))

    with patch.object(env.llm.client.chat.completions, "create", llm):
        user = _register(env)
        first = _start_journal(env, user, selected_activities=["sports"])
        assert first["question_id"] in env.question_by_id
        nxt = _answer(env, user, first, _first_option(first))

    assert llm.await_count >= 1, "the journal never consulted the LLM, so the fallback was not exercised"
    assert not nxt.get("completed")
    assert nxt["question_id"] in env.question_by_id, nxt
    assert nxt["question_id"] != "not-a-real-question-id"
    assert nxt["question"]


# =============================================================================
# IT-09 Cold start
# =============================================================================

def test_it09_new_user_gets_planner_and_career_responses(env):
    user = _register(env)
    client = env.client

    assert _user_tasks(env, user) == []
    planner_calls = [
        ("POST", "/study-planner/schedule", {"weekly_free_slots": EVENING_FREE_SLOTS, "tasks": []}),
        ("POST", "/study-planner/multi-week-schedule", {"weekly_free_slots": EVENING_FREE_SLOTS, "tasks": []}),
        ("POST", "/study-planner/engagement-features",
         {"user_id": user.id, "planned_weekly_minutes": {"Data Structures": 180}}),
        ("GET", f"/study-planner/semester-setup/{user.id}", None),
        ("GET", f"/study-planner/sessions/stats?user_id={user.id}", None),
        ("GET", f"/study-planner/sessions/blocked?user_id={user.id}", None),
    ]
    for method, path, body in planner_calls:
        res = client.request(method, path, headers=user.headers, json=body)
        assert res.status_code == 200, f"{method} {path}: {res.status_code} {res.text[:300]}"

    _, features = _career_input_from_focus(env, user)
    res = client.post("/career/predict", headers=user.headers, json=features)
    assert res.status_code == 200, res.text
    career = res.json()
    assert career["academic_risk"] in PRIORITIES
    assert isinstance(career["career_score"], (int, float))
    assert client.get(f"/career/history/{user.id}", headers=user.headers).status_code == 200
