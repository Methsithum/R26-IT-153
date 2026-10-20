"""
study_session.py

Permanent, per-session history of what the Study Planner actually scheduled,
and what the student says happened to it. One document per session:

    {
      user_id, date ("YYYY-MM-DD"), time_slot ("HH:MM-HH:MM"),
      start_time, end_time, task_id, module, task_type, duration_minutes,
      deadline_date,
      status: "pending" | "done" | "missed",
      reschedule_decision: None | "pending" | "this_week" | "next_week" | "declined",
      rescheduled_from / rescheduled_to: the other session's id, if moved,
      source: "schedule" (came from a generated plan) | "manual_reschedule",
      frozen_at, marked_at, decided_at, created_at
    }

Why this exists: generated schedules are stateless (schedule_service.py) and
the frontend's historicalScheduleByDate only lives in one browser's
localStorage - neither is a durable record of whether a student really
studied in a session. (user_id, date, task_id, time_slot) is the natural key
- generated sessions carry no id of their own - and is unique, so saving the
same session twice is always a no-op instead of a duplicate.
"""

from datetime import datetime

from bson import ObjectId
from pymongo import ASCENDING

from app.config.database import db

session_collection = db["study_sessions"]

SESSION_FIELDS = ("date", "time_slot", "task_id", "module", "task_type", "duration_minutes", "deadline_date")


def _key(user_id: str, session: dict) -> dict:
    return {
        "user_id": user_id,
        "date": session["date"],
        "task_id": session["task_id"],
        "time_slot": session["time_slot"],
    }


def _new_doc(user_id: str, session: dict, source: str = "schedule") -> dict:
    start_time, end_time = session["time_slot"].split("-")
    return {
        "user_id": user_id,
        **{field: session.get(field) for field in SESSION_FIELDS},
        "task_type": session.get("task_type") or "assignment",
        "start_time": start_time,
        "end_time": end_time,
        "status": "pending",
        "reschedule_decision": None,
        "rescheduled_from": None,
        "rescheduled_to": None,
        "source": source,
        "frozen_at": datetime.utcnow(),
        "marked_at": None,
        "decided_at": None,
        "created_at": datetime.utcnow(),
    }


class StudySessionModel:
    @staticmethod
    def ensure_indexes():
        session_collection.create_index(
            [("user_id", ASCENDING), ("date", ASCENDING), ("task_id", ASCENDING), ("time_slot", ASCENDING)],
            unique=True,
        )

    @staticmethod
    def _serialize(doc: dict | None):
        if not doc:
            return None
        doc = dict(doc)
        doc["id"] = str(doc["_id"])
        doc.pop("_id", None)
        return doc

    @staticmethod
    async def snapshot(user_id: str, sessions: list[dict]) -> int:
        """
        Append-only save, same rule as the frontend's freezePastDates(): a
        session already stored is never overwritten (so a later regeneration
        can't rewrite history, and a status the student already marked is
        never reset to "pending"). Returns how many were newly inserted.
        """
        inserted = 0
        for session in sessions:
            result = session_collection.update_one(
                _key(user_id, session), {"$setOnInsert": _new_doc(user_id, session)}, upsert=True
            )
            if result.upserted_id is not None:
                inserted += 1
        return inserted

    @staticmethod
    async def find_by_key(user_id: str, session: dict):
        return StudySessionModel._serialize(session_collection.find_one(_key(user_id, session)))

    @staticmethod
    async def find_by_id(session_id: str):
        try:
            doc = session_collection.find_one({"_id": ObjectId(session_id)})
        except Exception:
            return None
        return StudySessionModel._serialize(doc)

    @staticmethod
    async def upsert_and_set(user_id: str, session: dict, update: dict):
        """Saves the session if it isn't stored yet (e.g. one of today's, not frozen yet), then applies `update`."""
        key = _key(user_id, session)
        insert_doc = {k: v for k, v in _new_doc(user_id, session).items() if k not in update}
        session_collection.update_one(key, {"$setOnInsert": insert_doc, "$set": update}, upsert=True)
        return StudySessionModel._serialize(session_collection.find_one(key))

    @staticmethod
    async def create_manual(user_id: str, session: dict, rescheduled_from: str):
        doc = _new_doc(user_id, session, source="manual_reschedule")
        doc["rescheduled_from"] = rescheduled_from
        result = session_collection.insert_one(doc)
        doc["_id"] = result.inserted_id
        return StudySessionModel._serialize(doc)

    @staticmethod
    async def update(session_id: str, update_data: dict):
        session_collection.update_one({"_id": ObjectId(session_id)}, {"$set": update_data})

    @staticmethod
    async def find_range(user_id: str, start_date: str, end_date: str):
        docs = session_collection.find(
            {"user_id": user_id, "date": {"$gte": start_date, "$lte": end_date}}
        ).sort([("date", ASCENDING), ("start_time", ASCENDING)])
        return [StudySessionModel._serialize(d) for d in docs]

    @staticmethod
    async def find_pending_decisions(user_id: str):
        docs = session_collection.find(
            {"user_id": user_id, "status": "missed", "reschedule_decision": "pending"}
        ).sort("date", ASCENDING)
        return [StudySessionModel._serialize(d) for d in docs]

    @staticmethod
    async def find_upcoming_manual(user_id: str, from_date: str):
        """Manually rescheduled sessions still ahead - the slots the generator must keep free."""
        docs = session_collection.find(
            {
                "user_id": user_id,
                "source": "manual_reschedule",
                "status": "pending",
                "date": {"$gte": from_date},
            }
        ).sort([("date", ASCENDING), ("start_time", ASCENDING)])
        return [StudySessionModel._serialize(d) for d in docs]

    @staticmethod
    async def status_counts(user_id: str) -> dict:
        pipeline = [
            {"$match": {"user_id": user_id}},
            {"$group": {"_id": "$status", "count": {"$sum": 1}, "minutes": {"$sum": "$duration_minutes"}}},
        ]
        return {
            row["_id"]: {"count": row["count"], "minutes": row["minutes"]}
            for row in session_collection.aggregate(pipeline)
        }
