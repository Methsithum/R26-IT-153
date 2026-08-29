from datetime import datetime, timedelta

from app.config.database import db
from bson import ObjectId
from app.services.auth import hash_password


user_collection = db["users"]
ONLINE_WINDOW_SECONDS = 150


class UserModel:
    @staticmethod
    def _serialize(doc: dict | None):
        if not doc:
            return None
        doc["id"] = str(doc["_id"])
        doc.pop("_id", None)
        doc.pop("password_hash", None)
        return doc

    @staticmethod
    async def create(data: dict):
        password = data.pop("password", None)
        doc = {
            "email": data["email"].strip().lower(),
            "name": data["name"].strip(),
            "password_hash": hash_password(password) if password else None,
            "age": data.get("age"),
            "university_name": data.get("university_name"),
            "degree_name": data.get("degree_name"),
            "campus_year": data.get("campus_year"),
            "semester": data.get("semester"),
            "gpa": data.get("gpa") if "gpa" in data else None,
            "subjects": [s.strip() for s in (data.get("subjects") or []) if str(s).strip()],
            "total_xp": 0,
            "current_streak": 0,
            "longest_streak": 0,
            "badges": [],
            "last_journal_date": None,
            "created_at": datetime.utcnow(),
        }
        result = user_collection.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc

    @staticmethod
    async def find_by_id(user_id: str):
        try:
            doc = user_collection.find_one({"_id": ObjectId(user_id)})
        except Exception:
            return None
        if doc:
            doc["id"] = str(doc["_id"])
        return doc

    @staticmethod
    async def find_by_email(email: str):
        doc = user_collection.find_one({"email": email.strip().lower()})
        if doc:
            doc["id"] = str(doc["_id"])
        return doc

    @staticmethod
    def ensure_gpa_field():
        """Older accounts were created before GPA existed. Keep the field present as null."""
        user_collection.update_many({"gpa": {"$exists": False}}, {"$set": {"gpa": None}})

    @staticmethod
    async def update(user_id: str, update_data: dict):
        user_collection.update_one({"_id": ObjectId(user_id)}, {"$set": update_data})

    @staticmethod
    def touch_last_seen(user_id: str) -> None:
        try:
            oid = ObjectId(user_id)
        except Exception:
            return
        user_collection.update_one({"_id": oid}, {"$set": {"last_seen": datetime.utcnow()}})

    @staticmethod
    def clear_last_seen(user_id: str) -> None:
        try:
            oid = ObjectId(user_id)
        except Exception:
            return
        user_collection.update_one({"_id": oid}, {"$set": {"last_seen": None}})

    @staticmethod
    def list_online(extra_ids: list[str] | None = None) -> list[dict]:
        """Users whose last_seen is recent, plus any extra ids (current viewer)."""
        cutoff = datetime.utcnow() - timedelta(seconds=ONLINE_WINDOW_SECONDS)
        oids = []
        for raw in extra_ids or []:
            try:
                oids.append(ObjectId(raw))
            except Exception:
                pass
        query = {"$or": [{"last_seen": {"$gte": cutoff}}]}
        if oids:
            query["$or"].append({"_id": {"$in": oids}})
        docs = list(user_collection.find(query))
        out = []
        seen = set()
        for doc in docs:
            uid = str(doc["_id"])
            if uid in seen:
                continue
            seen.add(uid)
            last = doc.get("last_seen")
            online = isinstance(last, datetime) and last >= cutoff
            out.append({
                "id": uid,
                "name": doc.get("name") or "Student",
                "email": doc.get("email") or "",
                "university_name": doc.get("university_name") or "",
                "online": online,
            })
        out.sort(key=lambda u: (not u["online"], u["name"].lower()))
        return out

    @staticmethod
    async def list_users():
        docs = list(user_collection.find({}))
        for doc in docs:
            doc["id"] = str(doc["_id"])
            doc.pop("_id", None)
            doc.pop("password_hash", None)
        return docs
