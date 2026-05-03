from app.config.database import db
from bson import ObjectId
from datetime import datetime

task_collection = db["tasks"]

class TaskModel:
    @staticmethod
    async def create(data: dict):
        data["created_at"] = datetime.utcnow()
        data["updated_at"] = datetime.utcnow()
        result = task_collection.insert_one(data)
        data["_id"] = result.inserted_id
        return data

    @staticmethod
    async def find_by_id(task_id: str):
        doc = task_collection.find_one({"_id": ObjectId(task_id)})
        if doc:
            doc["id"] = str(doc["_id"])
        return doc

    @staticmethod
    async def find_by_user(user_id: str):
        docs = list(task_collection.find({"user_id": user_id}))
        for d in docs:
            d["id"] = str(d["_id"])
        return docs

    @staticmethod
    async def update(task_id: str, update_data: dict):
        update_data["updated_at"] = datetime.utcnow()
        task_collection.update_one({"_id": ObjectId(task_id)}, {"$set": update_data})