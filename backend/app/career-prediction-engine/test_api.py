"""
Tests all 4 routes of the Career Prediction Engine API.

How to run   : python test_api.py
Prerequisite : the API must already be running -
               python -m uvicorn prediction_api:app --reload --port 8001
"""

import requests

BASE_URL = "http://127.0.0.1:8001"

# ── Sample students ──────────────────────────────────────────────────────────

STUDENT_A_HIGH_RISK = {
    "gpa_cumulative": 2.2,
    "gpa_trend": -0.5,
    "assignment_completion_rate": 0.42,
    "late_submission_rate": 0.58,
    "resit_count": 2,
    "project_performance": 52,
    "attendance_rate": 0.50,
    "weekly_study_hours": 7,
    "sleep_hours_avg": 5.0,
    "sleep_consistency": 0.35,
    "part_time_work_hours": 22,
    "stress_level": 80,
    "anxiety_score": 20,
    "mood_stability": 28,
    "career_clarity_score": 18,
}

STUDENT_B_MEDIUM_RISK = {
    "gpa_cumulative": 2.9,
    "gpa_trend": -0.1,
    "assignment_completion_rate": 0.68,
    "late_submission_rate": 0.25,
    "resit_count": 1,
    "project_performance": 72,
    "attendance_rate": 0.70,
    "weekly_study_hours": 20,
    "sleep_hours_avg": 6.0,
    "sleep_consistency": 0.65,
    "part_time_work_hours": 14,
    "stress_level": 52,
    "anxiety_score": 12,
    "mood_stability": 45,
    "career_clarity_score": 50,
}

STUDENT_C_LOW_RISK = {
    "gpa_cumulative": 3.9,
    "gpa_trend": 0.4,
    "assignment_completion_rate": 0.97,
    "late_submission_rate": 0.04,
    "resit_count": 0,
    "project_performance": 91,
    "attendance_rate": 0.95,
    "weekly_study_hours": 28,
    "sleep_hours_avg": 7.8,
    "sleep_consistency": 0.88,
    "part_time_work_hours": 4,
    "stress_level": 22,
    "anxiety_score": 5,
    "mood_stability": 82,
    "career_clarity_score": 85,
}


def print_header(title):
    print("\n" + "=" * 62)
    print(f"  {title}")
    print("=" * 62)


def test_root():
    print_header("ROUTE 1 - GET /")
    response = requests.get(f"{BASE_URL}/")
    print(f"  Status : {response.status_code}")
    print(f"  Body   : {response.json()}")


def test_predict(student_data, label):
    print_header(f"ROUTE 2 - POST /predict  ({label})")
    response = requests.post(f"{BASE_URL}/predict", json=student_data)
    print(f"  Status : {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        print(f"  Academic Risk       : {result['academic_risk']}  ({result['risk_label_color']})")
        print(f"  Probabilities       : Low {result['prob_low']}%  |"
              f" Medium {result['prob_medium']}%  |  High {result['prob_high']}%")
        print(f"  Career Score        : {result['career_score']}")
    else:
        print(f"  Error  : {response.json()}")


def test_profiles():
    print_header("ROUTE 3 - GET /profiles")
    response = requests.get(f"{BASE_URL}/profiles")
    print(f"  Status : {response.status_code}")
    if response.status_code == 200:
        profiles = response.json()
        print(f"  Profiles returned : {len(profiles)}")
        if profiles:
            print(f"  First profile keys: {list(profiles[0].keys())}")
    else:
        print(f"  Error  : {response.json()}")


def test_model_metrics():
    print_header("ROUTE 4 - GET /model-metrics")
    response = requests.get(f"{BASE_URL}/model-metrics")
    print(f"  Status : {response.status_code}")
    print(f"  Body   : {response.json()}")


if __name__ == "__main__":
    print("\nTesting Career Prediction Engine API at", BASE_URL)

    test_root()
    test_predict(STUDENT_A_HIGH_RISK, "Student A - HIGH RISK")
    test_predict(STUDENT_B_MEDIUM_RISK, "Student B - MEDIUM RISK")
    test_predict(STUDENT_C_LOW_RISK, "Student C - LOW RISK")
    test_profiles()
    test_model_metrics()

    print("\n" + "=" * 62)
    print("  ALL TESTS COMPLETE")
    print("=" * 62)
