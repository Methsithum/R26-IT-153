from app.config.database import db
from bson import ObjectId
from datetime import datetime
import hashlib
import secrets

user_collection = db["users"]


PASSWORD_HASH_ITERATIONS = 120000

class UserModel:
    @staticmethod
    def _hash_password(password: str, salt: str | None = None) -> str:
        password_salt = salt or secrets.token_hex(16)
        derived_key = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            bytes.fromhex(password_salt),
            PASSWORD_HASH_ITERATIONS,
        )
        return f"{PASSWORD_HASH_ITERATIONS}${password_salt}${derived_key.hex()}"

    @staticmethod
    def verify_password(password: str, password_hash: str | None) -> bool:
        if not password_hash:
            return False

        try:
            iterations_text, salt, stored_hash = password_hash.split("$", 2)
            iterations = int(iterations_text)
        except ValueError:
            return False

        derived_key = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            bytes.fromhex(salt),
            iterations,
        )
        return secrets.compare_digest(derived_key.hex(), stored_hash)

    @staticmethod
    async def create(email: str, name: str, password_hash: str | None = None):
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
        if password_hash:
            doc["password_hash"] = password_hash
        result = user_collection.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc

    @staticmethod
    async def create_with_password(email: str, name: str, password: str):
        return await UserModel.create(email, name, UserModel._hash_password(password))

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
    async def set_password(user_id: str, password: str):
        user_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"password_hash": UserModel._hash_password(password)}}
        )

    @staticmethod
    async def update(user_id: str, update_data: dict):
        user_collection.update_one({"_id": ObjectId(user_id)}, {"$set": update_data})

    @staticmethod
    async def list_users():
        docs = list(user_collection.find({}))
        for doc in docs:
            doc["id"] = str(doc["_id"])
            doc.pop("_id", None)
        return docs