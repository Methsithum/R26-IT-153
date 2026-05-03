from app.config.database import db
from bson import ObjectId
from datetime import datetime

weekly_reflection_collection = db["weekly_reflections"]
semester_reflection_collection = db["semester_reflections"]

class ReflectionModel:
    @staticmethod
    async def create_weekly(data: dict):
        data["created_at"] = datetime.utcnow()
        result = weekly_reflection_collection.insert_one(data)
        data["_id"] = result.inserted_id
        return data

    @staticmethod
    async def create_semester(data: dict):
        data["created_at"] = datetime.utcnow()
        result = semester_reflection_collection.insert_one(data)
        data["_id"] = result.inserted_id
        return data