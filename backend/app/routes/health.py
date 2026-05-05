from fastapi import APIRouter
from ..config.database import test_db_connection

router = APIRouter()


@router.get("/health")
def health_check():
    db_status = test_db_connection()
    return {
        "api_status": "running",
        "database_status": "connected" if db_status else "disconnected"
    }