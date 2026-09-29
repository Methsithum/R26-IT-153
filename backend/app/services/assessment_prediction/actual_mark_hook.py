"""
Fills in actualMark/actualMarkRaw/actualRecordedAt on a pending prediction
once the real mark is saved. Called additively from ExamModel.set_mark and
TaskModel.set_mark ONLY (see those files for the one-line call site each).

Every function here is fully self-contained-safe: it never raises, is a
no-op when there is no matching pending prediction, and never touches any
document other than the single prediction it updates. The call sites still
wrap the call in try/except as an extra safety layer (belt and suspenders),
but this module does not rely on that alone.

Two lookups are tried because the prediction may have been stored under a
synthetic subject+kind+type key (build_assessment_ref in predict_service.py)
if the exam/task document didn't exist yet at prediction time, even though
by the time a mark is saved the real document id now exists.
"""

import logging

from app.models.assessment_prediction.prediction import AssessmentPredictionModel
from app.services.assessment_prediction.feature_builder import mark_to_numeric

logger = logging.getLogger(__name__)


async def _fill_first_match(user_id: str, subject: str, candidate_refs: list[str], raw_mark) -> None:
    actual_numeric = mark_to_numeric(raw_mark)
    if actual_numeric is None:
        return  # unparseable mark - nothing usable to record

    for ref in candidate_refs:
        if not ref:
            continue
        pending = await AssessmentPredictionModel.find_latest_pending(user_id, subject, ref)
        if pending:
            await AssessmentPredictionModel.record_actual(pending["id"], actual_numeric, raw_mark)
            return


async def on_exam_mark_saved(exam_doc: dict, mark) -> None:
    """exam_doc: the exam document BEFORE the mark update (has user_id, subject, exam_type, and its own id)."""
    try:
        user_id = exam_doc.get("user_id")
        subject = exam_doc.get("subject")
        exam_type = exam_doc.get("exam_type")
        exam_id = exam_doc.get("id")
        if not user_id or not subject:
            return
        candidates = [exam_id, f"{subject}|exam|{exam_type}"]
        await _fill_first_match(user_id, subject, candidates, mark)
    except Exception:
        logger.exception("assessment-prediction actual-mark hook failed for an exam mark - ignored, mark save unaffected.")


async def on_task_mark_saved(user_id: str, subject: str, mark, task_id: str | None) -> None:
    try:
        if not user_id or not subject:
            return
        candidates = [task_id, f"{subject}|task|{task_id}", f"{subject}|task|new"]
        await _fill_first_match(user_id, subject, candidates, mark)
    except Exception:
        logger.exception("assessment-prediction actual-mark hook failed for a task mark - ignored, mark save unaffected.")
