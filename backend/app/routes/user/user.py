from fastapi import APIRouter, HTTPException
from app.schemas.user import UserCreate, UserResponse
from app.models.user import UserModel

router = APIRouter(prefix="/users", tags=["users"])

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