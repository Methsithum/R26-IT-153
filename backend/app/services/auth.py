import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta

from fastapi import HTTPException, Request
from bson import ObjectId
from bson.errors import InvalidId

from app.config.database import db


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, digest_hex = stored.split("$", 1)
    except ValueError:
        return False
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), 120_000
    )
    return hmac.compare_digest(digest.hex(), digest_hex)


def issue_access_token(user_id: str) -> str:
    """Keep only a hash of the opaque bearer token on the server."""
    token = secrets.token_urlsafe(32)
    sessions = db["auth_sessions"]
    sessions.create_index("expires_at", expireAfterSeconds=0)
    sessions.insert_one({
        "token_hash": hashlib.sha256(token.encode()).hexdigest(),
        "user_id": user_id,
        "expires_at": datetime.utcnow() + timedelta(days=7),
    })
    return token


async def require_journal_owner(request: Request) -> str:
    """Authenticate private journal access and check every supplied owner/session."""
    authorization = request.headers.get("authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(401, "Please sign in again", headers={"WWW-Authenticate": "Bearer"})
    auth = db["auth_sessions"].find_one({
        "token_hash": hashlib.sha256(token.strip().encode()).hexdigest(),
        "expires_at": {"$gt": datetime.utcnow()},
    })
    if not auth or not db["users"].find_one({"_id": ObjectId(auth["user_id"])}):
        raise HTTPException(401, "Your session has expired. Please sign in again", headers={"WWW-Authenticate": "Bearer"})
    owner = auth["user_id"]
    payload = {}
    if request.method in {"POST", "PUT", "PATCH"}:
        try:
            payload = await request.json()
        except (ValueError, UnicodeDecodeError):
            pass
    if not isinstance(payload, dict):
        payload = {}
    for supplied in (request.path_params.get("user_id"), payload.get("user_id")):
        if supplied is not None and supplied != owner:
            raise HTTPException(403, "You can only access your own journal")
    session_id = request.path_params.get("session_id") or payload.get("session_id")
    if session_id:
        try:
            session = db["daily_sessions"].find_one({"_id": ObjectId(session_id)})
        except (ValueError, TypeError, InvalidId):
            session = None
        if session and session.get("user_id") != owner:
            raise HTTPException(403, "You can only access your own journal")
    return owner
