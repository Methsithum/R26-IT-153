from app.config.database import db
from bson import ObjectId
from datetime import datetime

task_collection = db["tasks"]

class TaskModel:
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
        data["updated_at"] = datetime.utcnow()
        result = task_collection.insert_one(data)
        data["_id"] = result.inserted_id
        return data

    @staticmethod
    async def find_by_id(task_id: str):
        try:
            doc = task_collection.find_one({"_id": ObjectId(task_id)})
        except Exception:
            return None
        return TaskModel._serialize(doc)

    @staticmethod
    async def find_by_user(user_id: str):
        docs = list(task_collection.find({"user_id": user_id}))
        return [TaskModel._serialize(d) for d in docs]

    @staticmethod
    async def find_by_user_and_type(user_id: str, task_type: str):
        docs = list(task_collection.find({"user_id": user_id, "task_type": task_type}))
        return [TaskModel._serialize(d) for d in docs]

    @staticmethod
    async def find_assignment(user_id: str, subject: str):
        doc = task_collection.find_one(
            {"user_id": user_id, "subject": subject, "task_type": "assignment"}
        )
        return TaskModel._serialize(doc)

    @staticmethod
    async def ensure_assignment(user_id: str, subject: str):
        existing = await TaskModel.find_assignment(user_id, subject)
        if existing:
            return existing
        return await TaskModel.create({
            "user_id": user_id,
            "title": f"{subject} assignment",
            "subject": subject,
            "task_type": "assignment",
            "progress_stage": "in_progress",
            "deadline": None,
            "mark": None,
        })

    @staticmethod
    async def set_deadline(user_id: str, subject: str, deadline: str):
        existing = await TaskModel.find_assignment(user_id, subject)
        if existing:
            await TaskModel.update(existing["id"], {"deadline": deadline})
            return
        await TaskModel.create({
            "user_id": user_id,
            "title": f"{subject} assignment",
            "subject": subject,
            "task_type": "assignment",
            "progress_stage": "in_progress",
            "deadline": deadline,
        })

    @staticmethod
    async def set_mark(user_id: str, subject: str, mark):
        existing = await TaskModel.find_assignment(user_id, subject)
        if existing:
            await TaskModel.update(existing["id"], {"mark": mark, "progress_stage": "completed"})
            return
        await TaskModel.create({
            "user_id": user_id,
            "title": f"{subject} assignment",
            "subject": subject,
            "task_type": "assignment",
            "progress_stage": "completed",
            "mark": mark,
        })

    @staticmethod
    async def update(task_id: str, update_data: dict):
        update_data["updated_at"] = datetime.utcnow()
        task_collection.update_one({"_id": ObjectId(task_id)}, {"$set": update_data})