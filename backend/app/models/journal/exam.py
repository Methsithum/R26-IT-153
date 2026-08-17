from app.config.database import db
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
    async def missing(user_id: str, subjects: list[str], exam_types: list[str]):
        if not subjects or not exam_types:
            return []
        docs = list(
            exam_collection.find(
                {
                    "user_id": user_id,
                    "subject": {"$in": subjects},
                    "exam_type": {"$in": exam_types},
                    "$or": [{"date": None}, {"date": ""}, {"date": {"$exists": False}}],
                }
            )
        )
        return [ExamModel._serialize(d) for d in docs]

    @staticmethod
    async def set_date(exam_id: str, date_value: str):
        exam_collection.update_one(
            {"_id": ObjectId(exam_id)},
            {"$set": {"date": date_value, "updated_at": datetime.utcnow()}},
        )
