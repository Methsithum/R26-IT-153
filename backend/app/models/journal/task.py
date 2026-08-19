from app.config.database import db
from app.services.journal.journal_constants import MARK_RECEIVED_STAGES, is_mark_check_due
from app.services.time_utils import local_today_iso
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
            "last_mark_check": None,
        })

    @staticmethod
    async def set_progress(user_id: str, subject: str, progress_stage: str):
        existing = await TaskModel.find_assignment(user_id, subject)
        if not existing:
            return None
        if existing.get("mark") not in (None, "") and progress_stage != "completed":
            return existing
        await TaskModel.update(existing["id"], {"progress_stage": progress_stage})
        existing["progress_stage"] = progress_stage
        return existing

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
    async def assignments_needing_mark(user_id: str):
        docs = list(task_collection.find({"user_id": user_id, "task_type": "assignment"}))
        ready = []
        for doc in docs:
            task = TaskModel._serialize(doc)
            stage = str(task.get("progress_stage") or "").lower()
            if stage not in MARK_RECEIVED_STAGES:
                continue
            if task.get("mark") not in (None, ""):
                continue
            if is_mark_check_due(task.get("last_mark_check")):
                ready.append(task)
        return ready

    @staticmethod
    async def set_mark(user_id: str, subject: str, mark):
        today = local_today_iso()
        existing = await TaskModel.find_assignment(user_id, subject)
        if existing:
            await TaskModel.update(
                existing["id"],
                {"mark": mark, "progress_stage": "completed", "last_mark_check": today},
            )
            return
        await TaskModel.create({
            "user_id": user_id,
            "title": f"{subject} assignment",
            "subject": subject,
            "task_type": "assignment",
            "progress_stage": "completed",
            "mark": mark,
            "last_mark_check": today,
        })

    @staticmethod
    async def record_mark_check(user_id: str, subject: str):
        existing = await TaskModel.find_assignment(user_id, subject)
        if existing:
            await TaskModel.update(
                existing["id"],
                {"last_mark_check": local_today_iso()},
            )

    @staticmethod
    async def update(task_id: str, update_data: dict):
        update_data["updated_at"] = datetime.utcnow()
        task_collection.update_one({"_id": ObjectId(task_id)}, {"$set": update_data})

    @staticmethod
    async def delete(task_id: str):
        try:
            task_collection.delete_one({"_id": ObjectId(task_id)})
        except Exception:
            return