from pymongo import MongoClient
from app.config.settings import settings

_client = None


def get_client() -> MongoClient:
    global _client
    if _client is None:
        _client = MongoClient(settings.mongodb_url)
    return _client


def get_db():
    return get_client()[settings.database_name]


def test_db_connection() -> bool:
    try:
        get_client().admin.command("ping")
        return True
    except Exception:
        return False