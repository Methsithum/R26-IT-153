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
    async def find_weekly_in_range(user_id: str, week_start, week_end):
        doc = weekly_reflection_collection.find_one(
            {"user_id": user_id, "week_start": week_start, "week_end": week_end}
        )
        return ReflectionModel._serialize(doc)

    @staticmethod
    async def upsert_weekly(user_id: str, week_start, week_end, data: dict):
        existing = await ReflectionModel.find_weekly_in_range(user_id, week_start, week_end)
        payload = {**data, "user_id": user_id, "week_start": week_start, "week_end": week_end}
        if existing:
            payload["updated_at"] = datetime.utcnow()
            weekly_reflection_collection.update_one({"_id": ObjectId(existing["id"])}, {"$set": payload})
            return await ReflectionModel.find_weekly_in_range(user_id, week_start, week_end)
        return await ReflectionModel.create_weekly(payload)

    @staticmethod
    async def find_weekly_by_user(user_id: str):
        docs = list(weekly_reflection_collection.find({"user_id": user_id}).sort("week_start", -1))
        return [ReflectionModel._serialize(doc) for doc in docs]

    @staticmethod
    async def find_semester(user_id: str, semester: str):
        doc = semester_reflection_collection.find_one({"user_id": user_id, "semester": semester})
        return ReflectionModel._serialize(doc)

    @staticmethod
    async def upsert_semester(user_id: str, semester: str, data: dict):
        existing = await ReflectionModel.find_semester(user_id, semester)
        payload = {**data, "user_id": user_id, "semester": semester}
        if existing:
            payload["updated_at"] = datetime.utcnow()
            semester_reflection_collection.update_one({"_id": ObjectId(existing["id"])}, {"$set": payload})
            return await ReflectionModel.find_semester(user_id, semester)
        return await ReflectionModel.create_semester(payload)

    @staticmethod
    async def find_semester_by_user(user_id: str):
        docs = list(semester_reflection_collection.find({"user_id": user_id}).sort("created_at", -1))
        return [ReflectionModel._serialize(doc) for doc in docs]