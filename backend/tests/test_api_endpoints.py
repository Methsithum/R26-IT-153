"""
API endpoint smoke tests (httpx TestClient against the real FastAPI app) -
one per study-planner endpoint, plus a dedicated regression test for the
/explain + ordinal-wrapper compatibility issue found during the monotonic
model deployment (Section 5c/6): a single shap.TreeExplainer cannot be built
against the wrapper itself, since it's not a tree booster - explain_service.py
was rewritten to build one TreeExplainer per underlying binary model instead.
This test guards against a future model swap silently reintroducing that
incompatibility (which would surface as a 500 on every /explain call).
"""
import pytest


class TestPredictPriority:
    def test_returns_200_with_valid_body(self, api_client, valid_feature_row):
        resp = api_client.post("/study-planner/predict-priority", json=valid_feature_row)
        assert resp.status_code == 200
        body = resp.json()
        assert body["priority_label"] in ("Low", "Medium", "High")
        assert 0.0 <= body["confidence"] <= 1.0


class TestExplain:
    def test_returns_200_with_valid_body(self, api_client, valid_feature_row):
        resp = api_client.post("/study-planner/explain", json=valid_feature_row)
        assert resp.status_code == 200
        body = resp.json()
        assert body["predicted_priority"] in ("Low", "Medium", "High")
        assert isinstance(body["feature_contributions"], dict)
        assert len(body["feature_contributions"]) == 13
        assert isinstance(body["explanation_sentence"], str) and body["explanation_sentence"]

    def test_ordinal_wrapper_compatibility_regression(self, api_client, valid_feature_row):
        """
        Specifically asserts /explain does NOT raise/500 against whichever
        model is CURRENTLY deployed - this is the real regression guard: if
        a future model swap reintroduces a plain (non-ordinal) classifier,
        or if explain_service.py's per-binary-model TreeExplainer setup ever
        breaks, this call surfaces it immediately as a failing test instead
        of a 500 discovered in production.
        """
        resp = api_client.post("/study-planner/explain", json=valid_feature_row)
        assert resp.status_code == 200, f"/explain failed against the deployed model: {resp.text}"


class TestPredictCluster:
    def test_returns_200_with_valid_body(self, api_client):
        payload = {
            "avg_weekly_clicks": 20, "clicks_trend": 2, "active_weeks_ratio": 0.7,
            "has_vle_activity": 1, "prior_avg_score": 65, "num_of_prev_attempts": 0, "studied_credits": 60,
        }
        resp = api_client.post("/study-planner/predict-cluster", json=payload)
        assert resp.status_code == 200
        body = resp.json()
        assert isinstance(body["cluster_id"], int)
        assert isinstance(body["cluster_label"], str) and body["cluster_label"]


@pytest.fixture
def sample_schedule_request():
    return {
        "weekly_free_slots": [
            {"day": "Monday", "start_time": "17:00", "end_time": "20:00", "duration_minutes": 180},
            {"day": "Tuesday", "start_time": "17:00", "end_time": "20:00", "duration_minutes": 180},
        ],
        "tasks": [
            {
                "task_id": "smoke-t1", "module": "AAA", "deadline_date": "2026-09-10", "weight": 20,
                "estimated_hours_needed": 2, "priority_label": "High", "task_type": "assignment",
            },
        ],
    }


class TestSchedule:
    def test_returns_200_with_valid_body(self, api_client, sample_schedule_request):
        resp = api_client.post("/study-planner/schedule", json=sample_schedule_request)
        assert resp.status_code == 200
        body = resp.json()
        assert "schedule" in body and "overload_warning" in body and "tasks" in body
        assert "smoke-t1" in body["tasks"]
        assert body["tasks"]["smoke-t1"]["task_type"] == "assignment"


class TestReschedule:
    def test_returns_200_with_valid_body(self, api_client, sample_schedule_request):
        schedule_resp = api_client.post("/study-planner/schedule", json=sample_schedule_request).json()
        reschedule_payload = {
            "previous_schedule": schedule_resp,
            "remaining_free_slots": sample_schedule_request["weekly_free_slots"],
            "completed_task_ids": [],
            "new_tasks": [],
        }
        resp = api_client.post("/study-planner/reschedule", json=reschedule_payload)
        assert resp.status_code == 200
        body = resp.json()
        assert "schedule" in body and "overload_warning" in body and "tasks" in body


class TestTodo:
    def test_returns_200_with_valid_body(self, api_client, sample_schedule_request):
        schedule_resp = api_client.post("/study-planner/schedule", json=sample_schedule_request).json()
        resp = api_client.post("/study-planner/todo", json=schedule_resp)
        assert resp.status_code == 200
        body = resp.json()
        assert isinstance(body, list)
        assert len(body) >= 1
        assert body[0]["task_id"] == "smoke-t1"
        assert body[0]["priority_label"] in ("Low", "Medium", "High")
