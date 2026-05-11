from pydantic import BaseModel, EmailStr

class UserCreate(BaseModel):
    email: EmailStr
    name: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    total_xp: int
    current_streak: int
    longest_streak: int
    badges: list[str]


class MissionItem(BaseModel):
    id: str
    name: str
    subject: str
    type: str
    xp: int
    difficulty: str
    status: str
    icon: str
    progress: int


class MissionsUpdateRequest(BaseModel):
    missions: list[MissionItem]