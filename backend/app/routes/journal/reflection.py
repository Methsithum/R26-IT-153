from fastapi import APIRouter, HTTPException
from app.schemas.journal.reflection import WeeklyReflectionRequest, SemesterReflectionRequest
from app.models.journal.reflection import ReflectionModel
from app.models.journal.daily_session import DailySessionModel
from app.models.user.user import UserModel
from app.services.journal.llm_service import generate_weekly_summary, generate_semester_summary

router = APIRouter(prefix="/reflection", tags=["reflection"])

@router.post("/weekly")
async def weekly_reflection(req: WeeklyReflectionRequest):
    user = await UserModel.find_by_id(req.user_id)
    if not user:
        raise HTTPException(404, "User not found")
    sessions = await DailySessionModel.find_user_sessions(req.user_id, req.week_start, req.week_end)
    journals = [s.get("journal_entry", "") for s in sessions if s.get("completed")]
    data_summary = f"Week from {req.week_start} to {req.week_end}. Journal entries: " + "; ".join(journals)
    summary = await generate_weekly_summary(user["name"], data_summary + f"\nReflection answers: {req.answers}")
    stored = await ReflectionModel.create_weekly({
        "user_id": req.user_id,
        "week_start": req.week_start,
        "week_end": req.week_end,
        "answers": req.answers,
        "summary": summary
    })
    return {"summary": summary, "reflection_id": stored["id"]}

@router.post("/semester")
async def semester_reflection(req: SemesterReflectionRequest):
    user = await UserModel.find_by_id(req.user_id)
    if not user:
        raise HTTPException(404, "User not found")
    sessions = await DailySessionModel.find_user_sessions(req.user_id)
    journals = [s.get("journal_entry", "") for s in sessions if s.get("completed")]
    semester_data = f"Semester: {req.semester}\nJournal entries: {'; '.join(journals)}\nReflection answers: {req.answers}"
    summary = await generate_semester_summary(user["name"], semester_data)
    stored = await ReflectionModel.create_semester({
        "user_id": req.user_id,
        "semester": req.semester,
        "answers": req.answers,
        "summary": summary
    })
    return {"summary": summary, "reflection_id": stored["id"]}


@router.get("/weekly/{user_id}")
async def get_weekly_reflections(user_id: str):
    user = await UserModel.find_by_id(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return {"user_id": user_id, "reflections": await ReflectionModel.find_weekly_by_user(user_id)}


@router.get("/semester/{user_id}")
async def get_semester_reflections(user_id: str):
    user = await UserModel.find_by_id(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return {"user_id": user_id, "reflections": await ReflectionModel.find_semester_by_user(user_id)}