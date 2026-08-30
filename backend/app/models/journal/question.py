from app.config.database import db

question_collection = db["questions"]

SYSTEM_STAGES = {
    "lecture_subjects_needed",
    "assignment_subjects_needed",
    "exam_setup_needed",
    "lab_subjects_needed",
    "quiz_subjects_needed",
    "next_assignment_check",
    "deadline_needed",
    "deadline_check",
    "exam_date",
    "exam_date_check",
    "assignment_progress",
    "mark_review",
    "mark_entry",
    "mark_subject_needed",
    "exam_mark_review",
    "exam_mark_entry",
    "exam_mark_subject_needed",
    "weekly_career_clarity",
}


class QuestionModel:
    @staticmethod
    def _public(doc: dict | None) -> dict | None:
        if not doc:
            return None
        item = dict(doc)
        item.pop("_id", None)
        return item

    @staticmethod
    def ensure_indexes():
        question_collection.create_index("id", unique=True)
        question_collection.create_index("intent_id")
        question_collection.create_index([("active", 1), ("stage", 1), ("activities", 1)])
        question_collection.create_index([("active", 1), ("system", 1)])

    @staticmethod
    def find_by_qid(question_id: str) -> dict | None:
        return QuestionModel._public(question_collection.find_one({"id": question_id}))

    @staticmethod
    def find_by_qids(question_ids: list[str]) -> list[dict]:
        if not question_ids:
            return []
        docs = question_collection.find({"id": {"$in": list(question_ids)}})
        return [QuestionModel._public(doc) for doc in docs if doc]

    @staticmethod
    def intents_for_ids(question_ids: list[str]) -> list[str]:
        if not question_ids:
            return []
        docs = question_collection.find({"id": {"$in": list(question_ids)}}, {"intent_id": 1, "id": 1})
        intents = []
        seen = set()
        for doc in docs:
            intent = doc.get("intent_id") or doc.get("id")
            if intent and intent not in seen:
                seen.add(intent)
                intents.append(intent)
        return intents

    @staticmethod
    def count_active() -> int:
        return question_collection.count_documents({"active": True})

    @staticmethod
    def upsert_many(docs: list[dict]):
        for doc in docs:
            question_collection.update_one({"id": doc["id"]}, {"$set": doc}, upsert=True)

    @staticmethod
    def insert_missing(docs: list[dict]) -> int:
        if not docs:
            return 0
        existing = {
            item["id"]
            for item in question_collection.find({"id": {"$in": [d["id"] for d in docs]}}, {"id": 1})
        }
        fresh = [doc for doc in docs if doc["id"] not in existing]
        if not fresh:
            return 0
        try:
            question_collection.insert_many(fresh, ordered=False)
            return len(fresh)
        except Exception as exc:
            details = getattr(exc, "details", None) or {}
            return int(details.get("nInserted") or 0)

    @staticmethod
    def flavor_shortlist(
        *,
        selected_activities: list[str],
        exclude_ids: list[str],
        exclude_intents: list[str],
        sample_size: int = 80,
    ) -> list[dict]:
        activity_match = [{"activities": "*"}]
        if selected_activities:
            activity_match.append({"activities": {"$in": selected_activities}})
        query = {
            "active": True,
            "system": {"$ne": True},
            "stage": "daily_checkin",
            "$or": activity_match,
        }
        if exclude_ids:
            query["id"] = {"$nin": exclude_ids}
        if exclude_intents:
            query["intent_id"] = {"$nin": exclude_intents}
        pipeline = [{"$match": query}, {"$sample": {"size": max(1, sample_size)}}]
        return [QuestionModel._public(doc) for doc in question_collection.aggregate(pipeline)]
