from fastapi import APIRouter, HTTPException

from app.models.user.user import UserModel
from app.schemas.auth import LoginRequest, RegisterRequest
from app.schemas.user.user import UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


def _to_user_response(user: dict) -> UserResponse:
    return UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        total_xp=user.get("total_xp", 0),
        current_streak=user.get("current_streak", 0),
        longest_streak=user.get("longest_streak", 0),
        badges=user.get("badges", []),
    )


@router.post("/register", response_model=UserResponse)
async def register(req: RegisterRequest):
    existing = await UserModel.find_by_email(req.email)

    if existing and existing.get("password_hash"):
        raise HTTPException(400, "Email already exists")

    if existing and not existing.get("password_hash"):
        await UserModel.set_password(existing["id"], req.password)
        refreshed_user = await UserModel.find_by_id(existing["id"])
        if not refreshed_user:
            raise HTTPException(500, "Failed to update existing account")
        return _to_user_response(refreshed_user)

    user = await UserModel.create_with_password(req.email, req.name, req.password)
    user["id"] = str(user["_id"])
    return _to_user_response(user)


@router.post("/login", response_model=UserResponse)
async def login(req: LoginRequest):
    user = await UserModel.find_by_email(req.email)
    if not user or not UserModel.verify_password(req.password, user.get("password_hash")):
        raise HTTPException(401, "Invalid email or password")

    return _to_user_response(user)
