from app.config.database import db
from bson import ObjectId
from datetime import datetime

weekly_reflection_collection = db["weekly_reflections"]
semester_reflection_collection = db["semester_reflections"]

class ReflectionModel:
    @staticmethod
    def _serialize(doc: dict | None):
        if not doc:
            return None
        doc["id"] = str(doc["_id"])
        doc.pop("_id", None)
        return doc

    @staticmethod
    async def create_weekly(data: dict):
        data["created_at"] = datetime.utcnow()
        result = weekly_reflection_collection.insert_one(data)
        data["_id"] = result.inserted_id
        return ReflectionModel._serialize(data)

    @staticmethod
    async def create_semester(data: dict):
        data["created_at"] = datetime.utcnow()
        result = semester_reflection_collection.insert_one(data)
        data["_id"] = result.inserted_id
        return ReflectionModel._serialize(data)

    @staticmethod
    async def find_weekly_by_user(user_id: str):
        docs = list(weekly_reflection_collection.find({"user_id": user_id}).sort("week_start", -1))
        return [ReflectionModel._serialize(doc) for doc in docs]

    @staticmethod
    async def find_semester_by_user(user_id: str):
        docs = list(semester_reflection_collection.find({"user_id": user_id}).sort("created_at", -1))
        return [ReflectionModel._serialize(doc) for doc in docs]