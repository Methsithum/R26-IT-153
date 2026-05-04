from app.config.database import db
from bson import ObjectId
from datetime import datetime
from typing import Optional, List

user_collection = db["users"]

class UserModel:
    @staticmethod
    async def create(email: str, name: str):
        doc = {
            "email": email,
            "name": name,
            "total_xp": 0,
            "current_streak": 0,
            "longest_streak": 0,
            "badges": [],
            "last_journal_date": None,
            "created_at": datetime.utcnow()
        }
        result = user_collection.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc

    @staticmethod
    async def find_by_id(user_id: str):
        doc = user_collection.find_one({"_id": ObjectId(user_id)})
        if doc:
            doc["id"] = str(doc["_id"])
        return doc

    @staticmethod
    async def find_by_email(email: str):
        doc = user_collection.find_one({"email": email})
        if doc:
            doc["id"] = str(doc["_id"])
        return doc

    @staticmethod
    async def update(user_id: str, update_data: dict):
        user_collection.update_one({"_id": ObjectId(user_id)}, {"$set": update_data})