from app.config.database import db
from datetime import datetime
from bson import ObjectId

behavior_analysis_collection = db["behavior_analysis"]

class BehaviorAnalysisModel:
    @staticmethod
    async def revision(user_id: str) -> int:
        user = db["users"].find_one({"_id": ObjectId(user_id)}) or {}
        return int(user.get("journal_revision", 0))

    @staticmethod
    async def set_state(user_id: str, status: str, revision: int, error: str | None = None):
        query = {"_id": ObjectId(user_id)}
        query["journal_revision"] = revision if revision else {"$in": [None, 0]}
        db["users"].update_one(query, {"$set": {"behavior_analysis_state": {
            "status": status, "revision": revision, "updated_at": datetime.utcnow(), "error": error,
        }}})

    @staticmethod
    async def invalidate(user_id: str):
        db["users"].update_one({"_id": ObjectId(user_id)}, {
            "$inc": {"journal_revision": 1},
            "$set": {"behavior_analysis_state": {"status": "stale", "updated_at": datetime.utcnow()}},
        })
        behavior_analysis_collection.delete_many({"studentId": user_id})

    @staticmethod
    def _serialize(doc: dict | None):
        if not doc:
            return None
        doc["id"] = str(doc["_id"])
        doc.pop("_id", None)
        return doc

    @staticmethod
    async def create(data: dict):
        data["created_at"] = datetime.utcnow()
        result = behavior_analysis_collection.insert_one(data)
        data["_id"] = result.inserted_id
        return BehaviorAnalysisModel._serialize(data)

    @staticmethod
    async def find_latest_by_user(user_id: str):
        doc = behavior_analysis_collection.find_one(
            {"studentId": user_id},
            sort=[("timestamp", -1)]
        )
        return BehaviorAnalysisModel._serialize(doc)
