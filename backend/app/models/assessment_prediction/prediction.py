"""
Persistence for assessment-score predictions.

One document per (user, assessment, calendar day the prediction was made) -
upserted, so calling /predict repeatedly for the same assessment on the same
day updates the one row instead of accumulating duplicates. Once the real
mark is later saved (ExamModel.set_mark / TaskModel.set_mark), the
actual-mark hook fills in actualMark/actualMarkRaw/actualRecordedAt on the
latest still-pending prediction for that (user, subject, assessmentRef).

Same synchronous-PyMongo-inside-async-methods style as every other journal
model (see app/models/journal/*.py) - no other driver introduced.
"""

from datetime import datetime

from bson import ObjectId

from app.config.database import db
from app.services.time_utils import local_today_iso

prediction_collection = db["assessment_predictions"]


class AssessmentPredictionModel:
    @staticmethod
    def _serialize(doc: dict | None):
        if not doc:
            return None
        doc = dict(doc)
        doc["id"] = str(doc["_id"])
        doc.pop("_id", None)
        created = doc.get("createdAt")
        if isinstance(created, datetime):
            doc["createdAt"] = created.isoformat()
        recorded = doc.get("actualRecordedAt")
        if isinstance(recorded, datetime):
            doc["actualRecordedAt"] = recorded.isoformat()
        return doc

    @staticmethod
    async def upsert(
        *,
        user_id: str,
        subject: str,
        assessment_kind: str,
        assessment_ref: str,
        assessment_date: str,
        features: dict,
        estimated: float,
        low: float,
        high: float,
        below_pass_mark: bool,
        model_version: str,
        journal_snapshot: dict | None = None,
    ) -> dict:
        prediction_day = local_today_iso()
        query = {"userId": user_id, "assessmentRef": assessment_ref, "predictionDay": prediction_day}
        payload = {
            "userId": user_id,
            "subject": subject,
            "assessmentKind": assessment_kind,
            "assessmentRef": assessment_ref,
            "assessmentDate": assessment_date,
            "features": features,
            "estimated": estimated,
            "low": low,
            "high": high,
            "belowPassMark": below_pass_mark,
            "modelVersion": model_version,
            "journalSnapshot": journal_snapshot or {},
            "predictionDay": prediction_day,
        }

        existing = prediction_collection.find_one(query)
        if existing:
            prediction_collection.update_one({"_id": existing["_id"]}, {"$set": payload})
            doc = prediction_collection.find_one({"_id": existing["_id"]})
            return AssessmentPredictionModel._serialize(doc)

        payload.update({
            "createdAt": datetime.utcnow(),
            "actualMark": None,
            "actualMarkRaw": None,
            "actualRecordedAt": None,
        })
        result = prediction_collection.insert_one(payload)
        payload["_id"] = result.inserted_id
        return AssessmentPredictionModel._serialize(payload)

    @staticmethod
    async def find_by_user(user_id: str, limit: int = 20) -> list[dict]:
        docs = list(
            prediction_collection.find({"userId": user_id})
            .sort([("createdAt", -1), ("_id", -1)])
            .limit(limit)
        )
        return [AssessmentPredictionModel._serialize(d) for d in docs]

    @staticmethod
    async def find_latest_pending(user_id: str, subject: str, assessment_ref: str) -> dict | None:
        """The most recent prediction for this (user, subject, assessmentRef) still awaiting an actual mark."""
        doc = prediction_collection.find_one(
            {"userId": user_id, "subject": subject, "assessmentRef": assessment_ref, "actualMark": None},
            sort=[("createdAt", -1), ("_id", -1)],
        )
        return AssessmentPredictionModel._serialize(doc)

    @staticmethod
    async def record_actual(prediction_id: str, actual_mark: float, actual_mark_raw) -> None:
        prediction_collection.update_one(
            {"_id": ObjectId(prediction_id)},
            {"$set": {
                "actualMark": actual_mark,
                "actualMarkRaw": actual_mark_raw,
                "actualRecordedAt": datetime.utcnow(),
            }},
        )
