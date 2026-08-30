from app.config.database import db
from app.services.journal.journal_constants import is_mark_check_due
from app.services.time_utils import as_of_day, local_today_iso
from bson import ObjectId
from datetime import datetime

exam_collection = db["exams"]


class ExamModel:
    @staticmethod
    def _serialize(doc: dict | None):
        if not doc:
            return None
        doc["id"] = str(doc["_id"])
        doc.pop("_id", None)
        return doc

    @staticmethod
    def _blank_field_query(field: str) -> dict:
        return {"$or": [{field: None}, {field: ""}, {field: {"$exists": False}}]}

    @staticmethod
    async def ensure(user_id: str, subject: str, exam_type: str):
        existing = exam_collection.find_one(
            {"user_id": user_id, "subject": subject, "exam_type": exam_type}
        )
        if existing:
            return ExamModel._serialize(existing)
        doc = {
            "user_id": user_id,
            "subject": subject,
            "exam_type": exam_type,
            "date": None,
            "mark": None,
            "last_mark_check": None,
            "last_date_check": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        result = exam_collection.insert_one(doc)
        doc["_id"] = result.inserted_id
        return ExamModel._serialize(doc)

    @staticmethod
    async def find_by_user(user_id: str):
        docs = list(exam_collection.find({"user_id": user_id}))
        return [ExamModel._serialize(d) for d in docs]

    @staticmethod
    async def missing(
        user_id: str,
        subjects: list[str] | None = None,
        exam_types: list[str] | None = None,
        as_of=None,
    ):
        query = {
            "user_id": user_id,
            **ExamModel._blank_field_query("date"),
        }
        if subjects:
            query["subject"] = {"$in": subjects}
        if exam_types:
            query["exam_type"] = {"$in": exam_types}
        docs = list(exam_collection.find(query))
        as_of = as_of_day(as_of)
        ready = []
        for doc in docs:
            exam = ExamModel._serialize(doc)
            if is_mark_check_due(exam.get("last_date_check"), today=as_of):
                ready.append(exam)
        return ready

    @staticmethod
    async def dated_kinds(user_id: str) -> list[str]:
        docs = list(
            exam_collection.find(
                {
                    "user_id": user_id,
                    "date": {"$nin": [None, ""], "$exists": True},
                }
            )
        )
        return list(dict.fromkeys(str(doc.get("exam_type") or "") for doc in docs if doc.get("exam_type")))

    @staticmethod
    async def marked_kinds(user_id: str) -> list[str]:
        docs = list(
            exam_collection.find(
                {
                    "user_id": user_id,
                    "mark": {"$nin": [None, ""], "$exists": True},
                }
            )
        )
        return list(dict.fromkeys(str(doc.get("exam_type") or "") for doc in docs if doc.get("exam_type")))

    @staticmethod
    async def missing_marks(
        user_id: str,
        subjects: list[str] | None = None,
        exam_types: list[str] | None = None,
        as_of=None,
    ):
        """Exams whose date has arrived as of the journal day, still have no mark."""
        query = {
            "user_id": user_id,
            "date": {"$nin": [None, ""], "$exists": True},
            **ExamModel._blank_field_query("mark"),
        }
        if subjects:
            query["subject"] = {"$in": subjects}
        if exam_types:
            query["exam_type"] = {"$in": exam_types}
        docs = list(exam_collection.find(query))
        as_of = as_of_day(as_of)
        as_of_iso = as_of.isoformat()
        ready = []
        for doc in docs:
            exam = ExamModel._serialize(doc)
            date_value = str(exam.get("date") or "")[:10]
            if (
                date_value
                and date_value <= as_of_iso
                and is_mark_check_due(exam.get("last_mark_check"), today=as_of)
            ):
                ready.append(exam)
        return ready

    @staticmethod
    async def set_date(exam_id: str, date_value: str):
        exam_collection.update_one(
            {"_id": ObjectId(exam_id)},
            {"$set": {"date": date_value, "updated_at": datetime.utcnow()}},
        )

    @staticmethod
    async def set_mark(exam_id: str, mark):
        today = local_today_iso()
        exam_collection.update_one(
            {"_id": ObjectId(exam_id)},
            {"$set": {"mark": mark, "last_mark_check": today, "updated_at": datetime.utcnow()}},
        )

    @staticmethod
    async def record_date_check(exam_id: str):
        exam_collection.update_one(
            {"_id": ObjectId(exam_id)},
            {
                "$set": {
                    "last_date_check": local_today_iso(),
                    "updated_at": datetime.utcnow(),
                }
            },
        )

    @staticmethod
    async def record_mark_check(exam_id: str):
        exam_collection.update_one(
            {"_id": ObjectId(exam_id)},
            {
                "$set": {
                    "last_mark_check": local_today_iso(),
                    "updated_at": datetime.utcnow(),
                }
            },
        )

    @staticmethod
    async def update(exam_id: str, update_data: dict):
        update_data["updated_at"] = datetime.utcnow()
        exam_collection.update_one({"_id": ObjectId(exam_id)}, {"$set": update_data})

    @staticmethod
    async def delete(exam_id: str):
        try:
            exam_collection.delete_one({"_id": ObjectId(exam_id)})
        except Exception:
            return
