"""Semester setup input validation (semester_setup_routes.py) - rejected before any DB access."""


def payload(**overrides):
    body = {
        "user_id": "000000000000000000000000",
        "semester_start": "2026-08-03",
        "semester_end": "2026-12-07",
        "registered_on": "2026-07-20",
        "subjects": {"OS": {"credits": 4, "prev_attempts": 1}},
    }
    body.update(overrides)
    return body


def test_end_before_start_is_rejected(api_client):
    assert api_client.put("/study-planner/semester-setup", json=payload(semester_end="2026-08-01")).status_code == 422


def test_semester_longer_than_a_year_is_rejected(api_client):
    assert api_client.put("/study-planner/semester-setup", json=payload(semester_end="2027-12-01")).status_code == 422


def test_negative_credits_and_attempts_are_rejected(api_client):
    bad = payload(subjects={"OS": {"credits": -1, "prev_attempts": 0}})
    assert api_client.put("/study-planner/semester-setup", json=bad).status_code == 422
    bad = payload(subjects={"OS": {"credits": 3, "prev_attempts": -2}})
    assert api_client.put("/study-planner/semester-setup", json=bad).status_code == 422
