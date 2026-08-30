"""
Persistence for generated career predictions.

One document per prediction run, keyed by user_id, so a student's risk and
career-readiness scores can be compared over time. The feature vector the
model saw is stored alongside the result, which keeps every saved prediction
reproducible.
"""
from datetime import datetime

from bson import ObjectId

from app.config.database import db

prediction_collection = db["career_predictions"]

# Only the most recent N runs are kept per student.
MAX_HISTORY = 5


class CareerPredictionModel:
    @staticmethod
    def _serialize(doc: dict | None):
        if not doc:
            return None
        doc = dict(doc)
        doc["id"] = str(doc["_id"])
        doc.pop("_id", None)
        # datetime is not JSON-serialisable over the wire.
        created = doc.get("created_at")
        if isinstance(created, datetime):
            doc["created_at"] = created.isoformat()
        return doc

    @staticmethod
    async def create(user_id: str, prediction: dict, features: dict,
                     estimated: list[str] | None = None,
                     data_quality: dict | None = None):
        """
        Store one prediction run and trim the student's history.

        `estimated` names the features that fell back to a default because the
        source collection had no data, so a later reader can tell a measured
        prediction from a partly-inferred one. `data_quality` carries the same
        information as counts and a percentage, for the history comparison.
        """
        doc = {
            "user_id": user_id,
            "academic_risk": prediction.get("academic_risk"),
            "prob_low": prediction.get("prob_low"),
            "prob_medium": prediction.get("prob_medium"),
            "prob_high": prediction.get("prob_high"),
            "career_score": prediction.get("career_score"),
            "features_snapshot": features,
            "estimated_features": estimated or [],
            "data_quality": data_quality or {},
            "created_at": datetime.utcnow(),
        }
        result = prediction_collection.insert_one(doc)
        doc["_id"] = result.inserted_id

        await CareerPredictionModel._trim(user_id)
        return CareerPredictionModel._serialize(doc)

    # Two predictions saved in the same second share a created_at, so _id is
    # the tiebreaker - ObjectIds increase monotonically, making the order
    # stable no matter how fast the runs arrive.
    _NEWEST_FIRST = [("created_at", -1), ("_id", -1)]

    @staticmethod
    async def _trim(user_id: str):
        """Delete anything past the newest MAX_HISTORY runs for this student."""
        docs = list(
            prediction_collection.find({"user_id": user_id}, {"_id": 1})
            .sort(CareerPredictionModel._NEWEST_FIRST)
            .skip(MAX_HISTORY)
        )
        if docs:
            prediction_collection.delete_many(
                {"_id": {"$in": [d["_id"] for d in docs]}}
            )

    @staticmethod
    async def find_by_user(user_id: str, limit: int = MAX_HISTORY):
        """A student's predictions, newest first."""
        docs = list(
            prediction_collection.find({"user_id": user_id})
            .sort(CareerPredictionModel._NEWEST_FIRST)
            .limit(limit)
        )
        return [CareerPredictionModel._serialize(d) for d in docs]

    @staticmethod
    async def find_latest(user_id: str):
        """The most recent prediction, or None when the student has none."""
        doc = prediction_collection.find_one(
            {"user_id": user_id}, sort=CareerPredictionModel._NEWEST_FIRST
        )
        return CareerPredictionModel._serialize(doc)

    @staticmethod
    async def delete_by_id(prediction_id: str, user_id: str):
        """Remove one run. Scoped to user_id so a student can only clear their own."""
        try:
            result = prediction_collection.delete_one(
                {"_id": ObjectId(prediction_id), "user_id": user_id}
            )
        except Exception:
            return False
        return result.deleted_count > 0

    @staticmethod
    async def clear_for_user(user_id: str):
        """Remove a student's whole prediction history."""
        result = prediction_collection.delete_many({"user_id": user_id})
        return result.deleted_count
