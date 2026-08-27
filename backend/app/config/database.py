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


class _LazyDB:
    """Lets `from app.config.database import db` keep working."""

    def __getitem__(self, name):
        return get_db()[name]

    def __getattr__(self, name):
        return getattr(get_db(), name)


db = _LazyDB()


def test_db_connection() -> bool:
    try:
        get_client().admin.command("ping")
        return True
    except Exception:
        return False