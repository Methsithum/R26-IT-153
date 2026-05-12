from app.config.database import db
from datetime import datetime

behavior_analysis_collection = db["behavior_analysis"]

class BehaviorAnalysisModel:
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
