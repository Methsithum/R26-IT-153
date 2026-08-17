from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional


class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str = Field(min_length=6)
    age: int = Field(ge=16, le=80)
    university_name: str
    degree_name: str
    campus_year: int = Field(ge=1, le=6)
    semester: int = Field(ge=1, le=2)
    subjects: List[str] = Field(min_length=1)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    age: Optional[int] = None
    university_name: Optional[str] = None
    degree_name: Optional[str] = None
    campus_year: Optional[int] = None
    semester: Optional[int] = None
    subjects: List[str] = []
    total_xp: int
    current_streak: int
    longest_streak: int
    badges: list[str]
    current_day: int = 1
    daily_completed: bool = False
