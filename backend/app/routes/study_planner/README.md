# Study Planner API - Manual Test Guide

All routes are registered under the `/study-planner` prefix (see `app/main.py`).
Start the server from `backend/`:

```bash
venv/Scripts/python -m uvicorn app.main:app --reload
```

Sample values below are pulled from real rows in
`ml_scripts/study-planner/outputs/oulad_task_level_leakage_free.csv` and the
schedule demo in `ml_scripts/study-planner/schedule_engine.py`, so responses
should look like realistic model output, not placeholder noise.

## 1. POST /study-planner/predict-priority

```bash
curl -X POST http://127.0.0.1:8000/study-planner/predict-priority \
  -H "Content-Type: application/json" \
  -d '{
    "date": 54.0, "weight": 20.0, "num_of_prev_attempts": 0.0, "studied_credits": 60.0,
    "module_presentation_length": 269.0, "date_registration": -52.0, "prior_avg_score": 60.0,
    "avg_weekly_clicks": 71.5641, "clicks_trend": -71.3947, "active_weeks_ratio": 1.0,
    "has_vle_activity": 1.0, "assessment_type_enc": 2.0, "code_module_enc": 0.0
  }'
```

Expected shape: `{"priority_label": "High", "confidence": 0.55}`

## 2. POST /study-planner/explain

Same body shape as `predict-priority` (the 13 model features):

```bash
curl -X POST http://127.0.0.1:8000/study-planner/explain \
  -H "Content-Type: application/json" \
  -d '{
    "date": 54.0, "weight": 20.0, "num_of_prev_attempts": 0.0, "studied_credits": 60.0,
    "module_presentation_length": 269.0, "date_registration": -52.0, "prior_avg_score": 60.0,
    "avg_weekly_clicks": 71.5641, "clicks_trend": -71.3947, "active_weeks_ratio": 1.0,
    "has_vle_activity": 1.0, "assessment_type_enc": 2.0, "code_module_enc": 0.0
  }'
```

Expected shape: `{"predicted_priority": "High", "feature_contributions": {...}, "explanation_sentence": "Task flagged High priority mainly because of ..."}`

## 3. POST /study-planner/predict-cluster

```bash
curl -X POST http://127.0.0.1:8000/study-planner/predict-cluster \
  -H "Content-Type: application/json" \
  -d '{
    "avg_weekly_clicks": 71.5641, "clicks_trend": -71.3947, "active_weeks_ratio": 1.0,
    "has_vle_activity": 1.0, "prior_avg_score": 60.0, "num_of_prev_attempts": 0.0, "studied_credits": 60.0
  }'
```

Expected shape: `{"cluster_id": 5, "cluster_label": "Struggling Low-Engagement Studier"}`

A student with `has_vle_activity: 0` always short-circuits to the fixed
no-data group, regardless of the other values (see `cluster_service.py`):

```bash
curl -X POST http://127.0.0.1:8000/study-planner/predict-cluster \
  -H "Content-Type: application/json" \
  -d '{
    "avg_weekly_clicks": 0, "clicks_trend": 0, "active_weeks_ratio": 0,
    "has_vle_activity": 0, "prior_avg_score": 60.0, "num_of_prev_attempts": 0.0, "studied_credits": 60.0
  }'
```

Expected: `{"cluster_id": -1, "cluster_label": "No VLE Engagement Data"}`

## 4. POST /study-planner/schedule

A task can either carry a `priority_label` directly, or a `feature_row` for
the API to predict one via the trained classifier:

```bash
curl -X POST http://127.0.0.1:8000/study-planner/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "weekly_free_slots": [
      {"day": "Monday", "start_time": "09:00", "end_time": "11:00", "duration_minutes": 120},
      {"day": "Tuesday", "start_time": "14:00", "end_time": "16:00", "duration_minutes": 120},
      {"day": "Wednesday", "start_time": "17:00", "end_time": "19:00", "duration_minutes": 120},
      {"day": "Saturday", "start_time": "10:00", "end_time": "13:00", "duration_minutes": 180}
    ],
    "tasks": [
      {
        "task_id": "T1", "module": "AAA", "deadline_date": "2026-08-24", "weight": 20.0,
        "estimated_hours_needed": 3,
        "feature_row": {
          "date": 54.0, "weight": 20.0, "num_of_prev_attempts": 0.0, "studied_credits": 60.0,
          "module_presentation_length": 269.0, "date_registration": -52.0, "prior_avg_score": 60.0,
          "avg_weekly_clicks": 71.5641, "clicks_trend": -71.3947, "active_weeks_ratio": 1.0,
          "has_vle_activity": 1.0, "assessment_type_enc": 2.0, "code_module_enc": 0.0
        }
      },
      {
        "task_id": "T2", "module": "DDD", "deadline_date": "2026-09-05", "weight": 12.5,
        "estimated_hours_needed": 1, "priority_label": "Low"
      }
    ]
  }'
```

Expected shape: `{"schedule": {...day -> sessions...}, "overload_warning": [...], "tasks": {"T1": {...}, "T2": {...}}}`.
**Save the response** - you need its `tasks` object plus whatever free-slot
capacity is still unused for the reschedule call below (see the design note
in `RescheduleRequest`'s docstring / `schedule_service.reschedule()`).

## 5. POST /study-planner/reschedule

Uses the previous response's `tasks` registry, the free slots that weren't
consumed by it (`Tuesday`/`Wednesday` were unused in the example above),
marks T2 complete, and adds a new urgent task T3:

```bash
curl -X POST http://127.0.0.1:8000/study-planner/reschedule \
  -H "Content-Type: application/json" \
  -d '{
    "previous_schedule": <paste the full /schedule response here>,
    "remaining_free_slots": [
      {"day": "Tuesday", "start_time": "14:00", "end_time": "16:00", "duration_minutes": 120},
      {"day": "Wednesday", "start_time": "17:00", "end_time": "19:00", "duration_minutes": 120}
    ],
    "completed_task_ids": ["T2"],
    "new_tasks": [
      {
        "task_id": "T3", "module": "CCC", "deadline_date": "2026-08-23", "weight": 25.0,
        "estimated_hours_needed": 2, "priority_label": "High"
      }
    ]
  }'
```

Expected shape: same as `/schedule` - T2 gone, T3 present, T1 unchanged
(possibly flagged in `overload_warning` if the deadline has already passed
the remaining slots' dates - the engine surfaces that rather than silently
dropping the task).

## 6. POST /study-planner/todo

Pass any `/schedule` or `/reschedule` response body directly:

```bash
curl -X POST http://127.0.0.1:8000/study-planner/todo \
  -H "Content-Type: application/json" \
  -d '<paste a /schedule or /reschedule response here>'
```

Expected shape: a JSON array of to-do entries, sorted High -> Medium -> Low,
each with a `reminder_message` like
`"📌 High priority: AAA task due in 3 days — start soon."`

## Error handling

- Missing/invalid fields are caught by Pydantic before reaching the service
  layer and return **422** with a field-level error message.
- Service-layer input problems (e.g. a task with neither `priority_label`
  nor `feature_row`) also return **422** with a clear `detail` message.
- If a `.joblib` artifact failed to load at server startup (e.g. you haven't
  run the `ml_scripts/study-planner/*.py` scripts yet), the affected
  endpoints return **500** rather than crashing the whole app - check the
  server startup logs for a `STARTUP ERROR` line naming the missing file.
