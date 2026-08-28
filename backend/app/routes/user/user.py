from fastapi import APIRouter, HTTPException
from app.schemas.user.user import UserCreate, UserLogin, UserResponse
from app.models.user.user import UserModel
from app.models.journal.daily_session import DailySessionModel
from app.models.journal.task import TaskModel
from app.models.journal.reflection import ReflectionModel
from app.models.journal.exam import ExamModel
from app.services.auth import verify_password
from app.services.journal.gamification import (
    level_from_xp,
    progress_bundle,
    reconcile_user_progress,
)

router = APIRouter(prefix="/users", tags=["users"])

def _to_response(doc: dict, sessions: list[dict] | None = None) -> UserResponse:
    bundle = progress_bundle(sessions or [])
    return UserResponse(
        id=str(doc.get("id") or doc.get("_id")),
        email=doc["email"],
        name=doc["name"],
        age=doc.get("age"),
        university_name=doc.get("university_name"),
        degree_name=doc.get("degree_name"),
        campus_year=doc.get("campus_year"),
        semester=doc.get("semester"),
        gpa=doc.get("gpa"),
        subjects=doc.get("subjects") or [],
        total_xp=doc.get("total_xp", 0),
        current_streak=doc.get("current_streak", 0),
        longest_streak=doc.get("longest_streak", 0),
        badges=doc.get("badges") or [],
        current_day=bundle["current_day"],
        daily_completed=bundle["daily_completed"],
        missed_dates=bundle["missed_dates"],
        play_date=bundle["play_date"],
        level=level_from_xp(doc.get("total_xp", 0)),
    )


@router.post("/register", response_model=UserResponse)
async def register_user(user_data: UserCreate):
    existing = await UserModel.find_by_email(user_data.email)
    if existing:
        raise HTTPException(400, "An account with this email already exists")
    subjects = [s.strip() for s in user_data.subjects if s and s.strip()]
    if not subjects:
        raise HTTPException(400, "Add at least one registered subject")
    doc = await UserModel.create({**user_data.model_dump(), "subjects": subjects})
    doc["id"] = str(doc["_id"])
    return _to_response(doc, [])


@router.post("/login", response_model=UserResponse)
async def login_user(payload: UserLogin):
    user = await UserModel.find_by_email(payload.email)
    if not user or not user.get("password_hash"):
        raise HTTPException(401, "Invalid email or password")
    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    sessions = await DailySessionModel.find_user_sessions(user["id"])
    user = await reconcile_user_progress(user, sessions)
    return _to_response(user, sessions)


@router.post("/", response_model=UserResponse)
async def create_user(user_data: UserCreate):
    return await register_user(user_data)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: str):
    user = await UserModel.find_by_id(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    sessions = await DailySessionModel.find_user_sessions(user_id)
    user = await reconcile_user_progress(user, sessions)
    return _to_response(user, sessions)


@router.get("/{user_id}/sessions")
async def get_user_sessions(user_id: str):
    user = await UserModel.find_by_id(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    sessions = await DailySessionModel.find_user_sessions(user_id)
    return {"user_id": user_id, "sessions": sessions}


@router.get("/{user_id}/tasks")
async def get_user_tasks(user_id: str):
    user = await UserModel.find_by_id(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    tasks = await TaskModel.find_by_user(user_id)
    return {"user_id": user_id, "tasks": tasks}


@router.get("/{user_id}/exams")
async def get_user_exams(user_id: str):
    user = await UserModel.find_by_id(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    exams = await ExamModel.find_by_user(user_id)
    return {"user_id": user_id, "exams": exams}


@router.get("/{user_id}/reflections")
async def get_user_reflections(user_id: str):
    user = await UserModel.find_by_id(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    weekly = await ReflectionModel.find_weekly_by_user(user_id)
    semester = await ReflectionModel.find_semester_by_user(user_id)
    return {"user_id": user_id, "weekly": weekly, "semester": semester}


@router.get("/{user_id}/gamification")
async def get_user_gamification(user_id: str):
    user = await UserModel.find_by_id(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    sessions = await DailySessionModel.find_user_sessions(user_id)
    user = await reconcile_user_progress(user, sessions)
    completed_sessions = [session for session in sessions if session and session.get("completed")]
    bundle = progress_bundle(sessions)
    return {
        "user_id": user_id,
        "total_xp": user.get("total_xp", 0),
        "level": level_from_xp(user.get("total_xp", 0)),
        "current_streak": user.get("current_streak", 0),
        "longest_streak": user.get("longest_streak", 0),
        "badges": user.get("badges", []),
        "total_sessions": len(sessions),
        "completed_sessions": len(completed_sessions),
        "current_day": bundle["current_day"],
        "daily_completed": bundle["daily_completed"],
        "missed_dates": bundle["missed_dates"],
        "play_date": bundle["play_date"],
        "subjects": user.get("subjects") or [],
    }
