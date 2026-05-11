from fastapi import APIRouter, HTTPException
from app.schemas.user.user import UserCreate, UserResponse, MissionsUpdateRequest
from app.models.user.user import UserModel
from app.models.journal.daily_session import DailySessionModel
from app.models.journal.task import TaskModel
from app.models.journal.reflection import ReflectionModel

router = APIRouter(prefix="/users", tags=["users"])


def _mission_payload(mission):
    if hasattr(mission, "model_dump"):
        return mission.model_dump()
    if hasattr(mission, "dict"):
        return mission.dict()
    return dict(mission)

@router.post("/", response_model=UserResponse)
async def create_user(user_data: UserCreate):
    existing = await UserModel.find_by_email(user_data.email)
    if existing:
        raise HTTPException(400, "Email already exists")
    doc = await UserModel.create(user_data.email, user_data.name)
    return UserResponse(
        id=str(doc["_id"]), email=doc["email"], name=doc["name"],
        total_xp=doc["total_xp"], current_streak=doc["current_streak"],
        longest_streak=doc["longest_streak"], badges=doc["badges"]
    )

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: str):
    user = await UserModel.find_by_id(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return UserResponse(
        id=user["id"], email=user["email"], name=user["name"],
        total_xp=user["total_xp"], current_streak=user["current_streak"],
        longest_streak=user["longest_streak"], badges=user["badges"]
    )


@router.get("/{user_id}/missions")
async def get_user_missions(user_id: str):
    user = await UserModel.find_by_id(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    missions_state = await UserModel.get_journal_missions(user_id)
    return {
        "user_id": user_id,
        "missions": missions_state["missions"] if missions_state else [],
        "updated_at": missions_state["updated_at"] if missions_state else None,
    }


@router.put("/{user_id}/missions")
async def update_user_missions(user_id: str, payload: MissionsUpdateRequest):
    user = await UserModel.find_by_id(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    missions_state = await UserModel.set_journal_missions(user_id, [_mission_payload(mission) for mission in payload.missions])
    return {
        "user_id": user_id,
        "missions": missions_state["missions"],
        "updated_at": missions_state["updated_at"],
    }


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
    completed_sessions = [session for session in sessions if session and session.get("completed")]
    return {
        "user_id": user_id,
        "total_xp": user.get("total_xp", 0),
        "current_streak": user.get("current_streak", 0),
        "longest_streak": user.get("longest_streak", 0),
        "badges": user.get("badges", []),
        "total_sessions": len(sessions),
        "completed_sessions": len(completed_sessions),
    }