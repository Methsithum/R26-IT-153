from fastapi import APIRouter, HTTPException
from app.schemas.journal.daily import StartDailyRequest, AnswerRequest, NextQuestionResponse
from app.models.journal.daily_session import DailySessionModel
from app.models.journal.task import TaskModel
from app.models.user.user import UserModel
from app.services.journal.llm_service import generate_initial_question, process_answer_and_get_next, generate_daily_journal
from app.services.journal.gamification import update_streak_and_xp
from app.services.journal.journal_service import build_session_context
from app.config.settings import settings
from datetime import datetime

router = APIRouter(prefix="/daily", tags=["daily"])
MAX_QS = settings.max_questions_per_session

@router.post("/start", response_model=NextQuestionResponse)
async def start_daily_session(req: StartDailyRequest):
    user = await UserModel.find_by_id(req.user_id)
    if not user:
        raise HTTPException(404, "User not found")

    tasks = await TaskModel.find_by_user(req.user_id)
    tasks_data = [{"title": t["title"], "progress": t.get("progress_stage"), "deadline": t.get("deadline")} for t in tasks]

    question, options = await generate_initial_question(
        user["name"], req.selected_activities, tasks_data, user["current_streak"]
    )

    session_doc = {
        "user_id": req.user_id,
        "date": req.date,
        "selected_activities": req.selected_activities,
        "study_duration_minutes": req.study_duration_minutes,
        "subject_focus": req.subject_focus,
        "pending_question": question,
        "pending_options": options,
        "qa_history": [],
        "completed": False,
        "journal_entry": None
    }
    session = await DailySessionModel.create(session_doc)

    return NextQuestionResponse(
        session_id=str(session["_id"]),
        question=question,
        options=options,
        completed=False
    )

@router.post("/answer", response_model=NextQuestionResponse)
async def answer_question(req: AnswerRequest):
    session = await DailySessionModel.find_by_id(req.session_id)
    if not session or session.get("completed"):
        raise HTTPException(400, "Invalid or already completed session")

    # Append Q&A to history
    qa_pair = {
        "question": session["pending_question"],
        "answer": req.answer,
        "timestamp": datetime.utcnow()
    }
    qa_history = session.get("qa_history", [])
    qa_history.append(qa_pair)

    # Clear pending
    update_data = {
        "qa_history": qa_history,
        "pending_question": None,
        "pending_options": None
    }

    # Get existing tasks for LLM
    tasks = await TaskModel.find_by_user(session["user_id"])
    tasks_data = [{"id": t["id"], "title": t["title"], "progress_stage": t.get("progress_stage"), "deadline": t.get("deadline")} for t in tasks]

    qa_list = [{"question": q["question"], "answer": q["answer"]} for q in qa_history]
    user = await UserModel.find_by_id(session["user_id"])

    decision = await process_answer_and_get_next(
        user_name=user["name"],
        session_qa_history=qa_list,
        selected_activities=session["selected_activities"],
        current_tasks=tasks_data,
        total_questions_asked=len(qa_history),
        max_questions=MAX_QS
    )

    # Apply task updates
    for update in decision.get("task_updates", []):
        if "task_id" in update and update["task_id"]:
            await TaskModel.update(update["task_id"], {"progress_stage": update.get("progress_stage")})
        else:
            new_task = {
                "user_id": session["user_id"],
                "title": update.get("title", "Untitled"),
                "task_type": update.get("task_type", "assignment"),
                "progress_stage": update.get("progress_stage"),
                "deadline": update.get("deadline")
            }
            await TaskModel.create(new_task)

    if decision.get("end_session") or len(qa_history) >= MAX_QS:
        # Generate journal
        context = await build_session_context(session)
        journal = await generate_daily_journal(
            user["name"], session["selected_activities"], session.get("study_duration_minutes") or 0,
            session.get("subject_focus") or "", qa_list, decision.get("task_updates", [])
        )
        update_data["completed"] = True
        update_data["journal_entry"] = journal
        await DailySessionModel.update(req.session_id, update_data)

        # Gamification
        await update_streak_and_xp(session["user_id"], session["date"])

        return NextQuestionResponse(
            session_id=req.session_id,
            completed=True,
            journal_entry=journal
        )
    else:
        update_data["pending_question"] = decision["next_question"]
        update_data["pending_options"] = decision.get("options", [])
        await DailySessionModel.update(req.session_id, update_data)
        return NextQuestionResponse(
            session_id=req.session_id,
            question=decision["next_question"],
            options=decision.get("options", []),
            completed=False
        )