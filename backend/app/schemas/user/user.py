from pydantic import BaseModel, EmailStr, Field, model_validator
from typing import List, Optional


def student_has_gpa(campus_year: int | None, semester: int | None) -> bool:
    """Year 1 Semester 1 students have not received a GPA yet."""
    return not (campus_year == 1 and semester == 1)


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
    gpa: Optional[float] = Field(default=None, ge=0, le=4)

    @model_validator(mode="after")
    def require_gpa_after_first_semester(self):
        if not student_has_gpa(self.campus_year, self.semester):
            self.gpa = None
            return self
        if self.gpa is None:
            raise ValueError("Enter your current GPA (Year 1 Semester 1 students can skip this).")
        self.gpa = round(float(self.gpa), 2)
        return self


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
    gpa: Optional[float] = None
    subjects: List[str] = []
    total_xp: int
    current_streak: int
    longest_streak: int
    badges: list[str]
    current_day: int = 1
    daily_completed: bool = False
    level: int = 1
