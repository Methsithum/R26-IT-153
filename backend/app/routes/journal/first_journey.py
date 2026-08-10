from fastapi import APIRouter, HTTPException
from app.schemas.journal.first_journey import (
    FirstJourneyStartRequest,
    FirstJourneyAnswerRequest,
    FirstJourneyQuestionResponse,
)
from app.models.user.user import UserModel
from app.services.journal.first_journey_service import (
    get_next_question,
    apply_answer,
    is_journey_complete,
)

router = APIRouter(prefix="/first-journey", tags=["first-journey"])


def _build_response(user: dict) -> FirstJourneyQuestionResponse:
    profile = user.get("student_profile") or {}
    answered = user.get("first_journey_answers") or []
    answered_ids = [a.get("question_id") for a in answered if a.get("question_id")]

    if user.get("first_journey_completed") or is_journey_complete(profile, answered_ids):
        return FirstJourneyQuestionResponse(completed=True, profile=profile)

    step = get_next_question(profile, answered_ids)
    if not step:
        return FirstJourneyQuestionResponse(completed=True, profile=profile)

    return FirstJourneyQuestionResponse(
        completed=False,
        question_id=step["id"],
        question=step["question"],
        options=step.get("options") or [],
        question_type=step.get("question_type", "lane"),
        profile=profile,
    )


@router.get("/status/{user_id}", response_model=FirstJourneyQuestionResponse)
async def first_journey_status(user_id: str):
    user = await UserModel.find_by_id(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return _build_response(user)


@router.post("/start", response_model=FirstJourneyQuestionResponse)
async def start_first_journey(req: FirstJourneyStartRequest):
    user = await UserModel.find_by_id(req.user_id)
    if not user:
        raise HTTPException(404, "User not found")

    if user.get("first_journey_completed"):
        return FirstJourneyQuestionResponse(
            completed=True,
            profile=user.get("student_profile") or {},
        )

    return _build_response(user)


@router.post("/answer", response_model=FirstJourneyQuestionResponse)
async def answer_first_journey(req: FirstJourneyAnswerRequest):
    user = await UserModel.find_by_id(req.user_id)
    if not user:
        raise HTTPException(404, "User not found")

    if user.get("first_journey_completed"):
        return FirstJourneyQuestionResponse(
            completed=True,
            profile=user.get("student_profile") or {},
        )

    profile = user.get("student_profile") or {}
    answered = list(user.get("first_journey_answers") or [])
    answered_ids = [a.get("question_id") for a in answered if a.get("question_id")]

    step = get_next_question(profile, answered_ids)
    if not step or step["id"] != req.question_id:
        raise HTTPException(400, "Invalid or out-of-order question")

    profile = apply_answer(profile, step, req.answer)
    answered.append({"question_id": req.question_id, "answer": req.answer})

    completed = is_journey_complete(profile, [a["question_id"] for a in answered])
    update = {
        "student_profile": profile,
        "first_journey_answers": answered,
        "first_journey_completed": completed,
    }
    if completed and "first_explorer" not in (user.get("badges") or []):
        update["badges"] = list(user.get("badges") or []) + ["first_explorer"]

    await UserModel.update(req.user_id, update)

    user = await UserModel.find_by_id(req.user_id)
    return _build_response(user)
