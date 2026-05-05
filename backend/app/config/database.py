from pymongo import MongoClient
from .settings import settings

client = MongoClient(settings.mongodb_url)
db = client[settings.database_name]


def test_db_connection() -> bool:
    try:
        client.admin.command("ping")
        return True
    except Exception:
        return False