"""
Prediction orchestration for assessment-score serving: gathers a student's
previous marks, resolves the target assessment's date and OULAD-equivalent
type, builds the model input row, and runs the journal_compatible bundle.

Does NOT persist anything - storage (AssessmentPredictionModel) is wired in
by the route layer, which is also where request validation -> HTTP status
codes happens (matching this project's existing convention: services raise
typed exceptions, routes translate them - see
app/utils/study_planner/error_handling.py for the precedent this follows).
"""

import numpy as np
import pandas as pd
from bson import ObjectId
from bson.errors import InvalidId

from app.config.assessment_prediction_settings import JOURNAL_TO_OULAD_ASSESSMENT_TYPE, PASS_MARK_FALLBACK
from app.models.journal.exam import ExamModel
from app.models.journal.task import TaskModel
from app.models.user.user import UserModel
from app.services.assessment_prediction.feature_builder import (
    build_previous_score_records,
    compute_previous_score_features,
    to_date,
)
from app.services.assessment_prediction.model_loader import get_bundle
from app.services.time_utils import local_today, local_today_iso

UPCOMING_LIMIT = 50

EXAM_TYPES = {"mid", "final", "lab", "quiz"}
ASSESSMENT_KINDS = {"exam", "task"}


class ValidationError(Exception):
    """Malformed input (bad ObjectId format, invalid enum value, missing required field). Route maps this to 422."""


class NotFoundError(Exception):
    """A referenced document (user, task) does not exist. Route maps this to 404."""


def _validate_object_id(value: str, field_name: str) -> str:
    try:
        ObjectId(value)
    except (InvalidId, TypeError):
        raise ValidationError(f"'{field_name}' is not a valid id: {value!r}")
    return value


async def _require_user(user_id: str) -> dict:
    _validate_object_id(user_id, "user_id")
    user = await UserModel.find_by_id(user_id)
    if not user:
        raise NotFoundError(f"No user found for user_id={user_id!r}")
    return user


def _resolve_assessment_type(assessment_kind: str, exam_type: str | None) -> str:
    if assessment_kind == "task":
        key = "task"
    elif assessment_kind == "exam":
        key = exam_type
    else:
        raise ValidationError(f"assessment_kind must be one of {sorted(ASSESSMENT_KINDS)}, got {assessment_kind!r}")
    mapped = JOURNAL_TO_OULAD_ASSESSMENT_TYPE.get(key)
    if mapped is None:
        raise ValidationError(f"No OULAD assessment_type mapping for {key!r}")
    return mapped


async def _resolve_target_and_exclude(
    user_id: str, subject: str, assessment_kind: str, exam_type: str | None,
    task_id: str | None, assessment_date: str | None,
    exams: list[dict], tasks: list[dict],
) -> tuple[str, str | None]:
    """
    Returns (target_date_iso, exclude_id). exclude_id is the target's own
    document id (if it already exists in exams/tasks), so it never counts as
    its own history. Date priority: explicit assessment_date > the stored
    exam date / task deadline > today.
    """
    exclude_id: str | None = None
    stored_date: str | None = None

    if assessment_kind == "exam":
        exclude_id = _find_matching_exam_id(exams, subject, exam_type)
        matching = next(
            (e for e in exams if e.get("subject") == subject and e.get("exam_type") == exam_type),
            None,
        )
        stored_date = matching.get("date") if matching else None
    else:  # task
        if task_id:
            _validate_object_id(task_id, "task_id")
            matching = next((t for t in tasks if t.get("id") == task_id), None)
            if not matching:
                raise NotFoundError(f"No task found for task_id={task_id!r}")
            if matching.get("user_id") != user_id or matching.get("subject") != subject:
                raise NotFoundError(f"task_id={task_id!r} does not belong to this user/subject")
            exclude_id = task_id
            stored_date = matching.get("deadline")

    if assessment_date:
        return assessment_date, exclude_id
    if stored_date:
        return stored_date, exclude_id
    return local_today_iso(), exclude_id


def build_assessment_ref(
    exclude_id: str | None, subject: str, assessment_kind: str,
    exam_type: str | None, task_id: str | None,
) -> str:
    """
    The key predictions are grouped/looked-up by (besides userId + day).
    Prefers the real exam/task document id when one exists (exclude_id, set
    whenever a matching ExamModel/TaskModel row was already found). Falls
    back to a subject+kind+type synthetic key when predicting for an
    assessment that has no document yet - the actual-mark hook tries both
    forms when it later looks for a pending prediction to fill in, since by
    the time a mark is saved the real document will exist even if it didn't
    at prediction time.
    """
    if exclude_id:
        return exclude_id
    if assessment_kind == "exam":
        return f"{subject}|exam|{exam_type}"
    return f"{subject}|task|{task_id or 'new'}"


def _find_matching_exam_id(exams: list[dict], subject: str, exam_type: str | None) -> str | None:
    matching = next(
        (e for e in exams if e.get("subject") == subject and e.get("exam_type") == exam_type),
        None,
    )
    return matching.get("id") if matching else None


async def gather_previous_marks(user_id: str, subject: str, exclude_id: str | None) -> list[dict]:
    """All of the student's usable prior marks in this subject, across exams and tasks, combined."""
    exams = await ExamModel.find_by_user(user_id)
    tasks = await TaskModel.find_by_user(user_id)
    exam_records = build_previous_score_records(exams, subject=subject, exclude_id=exclude_id, date_field="date")
    task_records = build_previous_score_records(tasks, subject=subject, exclude_id=exclude_id, date_field="deadline")
    return exam_records + task_records


async def build_prediction(
    *,
    user_id: str,
    subject: str,
    assessment_kind: str,
    exam_type: str | None = None,
    task_id: str | None = None,
    assessment_date: str | None = None,
) -> dict:
    """
    Full prediction pipeline (no persistence). Returns a dict with everything
    the route needs to build the response and the storage document:
    estimated_mark, range_low, range_high, below_pass_mark, n_previous_marks,
    warning, model_version, feature_set, assessment_type_used,
    target_date, features (the exact dict fed to the model).
    """
    if not subject or not str(subject).strip():
        raise ValidationError("subject is required")
    if assessment_kind not in ASSESSMENT_KINDS:
        raise ValidationError(f"assessment_kind must be one of {sorted(ASSESSMENT_KINDS)}, got {assessment_kind!r}")
    if assessment_kind == "exam":
        if exam_type not in EXAM_TYPES:
            raise ValidationError(f"exam_type must be one of {sorted(EXAM_TYPES)} when assessment_kind='exam', got {exam_type!r}")

    await _require_user(user_id)

    exams = await ExamModel.find_by_user(user_id)
    tasks = await TaskModel.find_by_user(user_id)

    target_date, exclude_id = await _resolve_target_and_exclude(
        user_id, subject, assessment_kind, exam_type, task_id, assessment_date, exams, tasks,
    )
    if to_date(target_date) is None:
        raise ValidationError(f"Could not resolve a usable assessment_date (got {target_date!r})")

    exam_records = build_previous_score_records(exams, subject=subject, exclude_id=exclude_id, date_field="date")
    task_records = build_previous_score_records(tasks, subject=subject, exclude_id=exclude_id, date_field="deadline")
    combined = exam_records + task_records

    prev_mean, prev_last, prev_count = compute_previous_score_features(combined, target_date)
    assessment_type_used = _resolve_assessment_type(assessment_kind, exam_type)

    bundle = get_bundle()  # raises BundleNotFoundError -> route maps to 503
    model = bundle["model"]
    feature_names = bundle["features"]

    computed = {
        "prev_mean": prev_mean,
        "prev_last": prev_last,
        "prev_count": prev_count,
        "assessment_type": assessment_type_used,
    }
    # Build the row exactly as bundle["features"] lists, in that order. Any
    # feature this bundle happens to need but the journal cannot supply is
    # passed as NaN - the pipeline's own imputer handles it. Never invent
    # VLE-click or weight values to fill a gap.
    row = {name: computed.get(name, np.nan) for name in feature_names}
    X = pd.DataFrame([row])[feature_names]

    raw_pred = float(model.predict(X)[0])
    estimated = float(np.clip(raw_pred, 0, 100))
    q = float(bundle["conformal_q"])
    range_low = float(np.clip(estimated - q, 0, 100))
    range_high = float(np.clip(estimated + q, 0, 100))

    pass_mark = bundle.get("pass_mark", PASS_MARK_FALLBACK)
    below_pass_mark = estimated < pass_mark

    warning = None
    if prev_count == 0:
        warning = "cold_start: low confidence"

    assessment_ref = build_assessment_ref(exclude_id, subject, assessment_kind, exam_type, task_id)

    return {
        "estimated_mark": round(estimated, 1),
        "range_low": round(range_low),
        "range_high": round(range_high),
        "below_pass_mark": below_pass_mark,
        "n_previous_marks": prev_count,
        "warning": warning,
        "feature_set": bundle["feature_set"],
        "model_version": f"{bundle['feature_set']}@{bundle['trained_at']}",
        "assessment_type_used": assessment_type_used,
        "target_date": target_date,
        "exclude_id": exclude_id,
        "assessment_ref": assessment_ref,
        "features": computed,
    }


async def list_upcoming(user_id: str) -> dict:
    """
    Read-only: a student's upcoming, unmarked, dated exams and tasks (today
    or later), combined and sorted by date, capped at UPCOMING_LIMIT. Reuses
    to_date() from feature_builder.py (the same date-parsing this module
    already uses for predictions) rather than duplicating date-parsing logic.
    """
    await _require_user(user_id)
    today = local_today()

    exams = await ExamModel.find_by_user(user_id)
    tasks = await TaskModel.find_by_user(user_id)

    items = []
    for e in exams:
        if e.get("mark") not in (None, ""):
            continue
        d = to_date(e.get("date"))
        if d is None or d < today:
            continue
        items.append({
            "kind": "exam",
            "subject": e.get("subject"),
            "exam_type": e.get("exam_type"),
            "task_id": None,
            "title": None,
            "date": d.isoformat(),
            "days_left": (d - today).days,
        })

    for t in tasks:
        if t.get("mark") not in (None, ""):
            continue
        d = to_date(t.get("deadline"))
        if d is None or d < today:
            continue
        items.append({
            "kind": "task",
            "subject": t.get("subject"),
            "exam_type": None,
            "task_id": t.get("id"),
            "title": t.get("title"),
            "date": d.isoformat(),
            "days_left": (d - today).days,
        })

    items.sort(key=lambda it: it["date"])
    return {"user_id": user_id, "items": items[:UPCOMING_LIMIT]}
