from app.config.database import db
from bson import ObjectId
from datetime import datetime

learning_patterns_collection = db["learning_patterns"]


class LearningPatternModel:
    @staticmethod
    def _serialize(doc: dict | None):
        if not doc:
            return None
        doc["id"] = str(doc["_id"])
        doc.pop("_id", None)
        return doc

    @staticmethod
    async def create(data: dict):
        """Create or update learning pattern entry."""
        data["updated_at"] = datetime.utcnow()
        if "created_at" not in data:
            data["created_at"] = datetime.utcnow()
        result = learning_patterns_collection.insert_one(data)
        data["_id"] = result.inserted_id
        return LearningPatternModel._serialize(data)

    @staticmethod
    async def find_by_user(user_id: str):
        """Get learning patterns for a user."""
        doc = learning_patterns_collection.find_one({"user_id": user_id})
        return LearningPatternModel._serialize(doc)

    @staticmethod
    async def update(user_id: str, update_data: dict):
        """Update learning pattern for a user."""
        update_data["updated_at"] = datetime.utcnow()
        learning_patterns_collection.update_one(
            {"user_id": user_id},
            {"$set": update_data},
            upsert=True
        )
