from pydantic import BaseModel


class LeaderboardEntry(BaseModel):
    name: str
    points: int
    rank: int


class ProfileResponse(BaseModel):
    total_points: int
    achievements_unlocked: list[str]
