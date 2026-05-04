from app.config.database import db
from bson import ObjectId
from datetime import datetime

session_collection = db["daily_sessions"]

class DailySessionModel:
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
        result = session_collection.insert_one(data)
        data["_id"] = result.inserted_id
        return data

    @staticmethod
    async def find_by_id(session_id: str):
        try:
            doc = session_collection.find_one({"_id": ObjectId(session_id)})
        except Exception:
            return None
        return DailySessionModel._serialize(doc)

    @staticmethod
    async def update(session_id: str, update_data: dict):
        session_collection.update_one({"_id": ObjectId(session_id)}, {"$set": update_data})

    @staticmethod
    async def find_user_sessions(user_id: str, start_date=None, end_date=None):
        query = {"user_id": user_id}
        if start_date and end_date:
            query["date"] = {"$gte": start_date, "$lte": end_date}
        docs = list(session_collection.find(query))
        return [DailySessionModel._serialize(d) for d in docs]

    @staticmethod
    async def find_recent_user_sessions(user_id: str, limit: int = 10):
        docs = list(session_collection.find({"user_id": user_id}).sort("date", -1).limit(limit))
        return [DailySessionModel._serialize(d) for d in docs]