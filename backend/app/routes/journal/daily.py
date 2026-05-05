from fastapi import APIRouter, HTTPException
from app.schemas.journal.daily import StartDailyRequest, AnswerRequest, NextQuestionResponse
from app.models.journal.daily_session import DailySessionModel
from app.models.journal.task import TaskModel
from app.models.user.user import UserModel
from app.services.journal.llm_service import generate_initial_question, process_answer_and_get_next, generate_daily_journal
from app.services.journal.gamification import update_streak_and_xp
from app.services.journal.journal_service import build_session_context
from app.services.journal.journal_constants import filter_allowed_activities, is_valid_task_stage
from app.services.journal.alerts import generate_proactive_alerts, format_alerts_for_journal
from app.services.journal.learning_patterns import aggregate_learning_patterns
import logging
from app.config.settings import settings
from datetime import datetime, timezone
from typing import Dict, List, Tuple

router = APIRouter(prefix="/daily", tags=["daily"])
logger = logging.getLogger(__name__)


def _calculate_max_questions(num_activities: int) -> int:
    """Calculate dynamic max questions based on number of activities.
    Formula: 8 + (num_activities * 2)
    """
    return 8 + (num_activities * 2)


def _build_fallback_initial_question(
    selected_activities: List[str],
    tasks_data: List[Dict]
) -> Tuple[str, List[str]]:
    # Prefer a deadline-focused question when there are near due tasks.
    now_utc = datetime.utcnow().replace(tzinfo=timezone.utc)
    for task in tasks_data:
        deadline = task.get("deadline")
        if not deadline:
            continue
        try:
            deadline_dt = deadline if isinstance(deadline, datetime) else datetime.fromisoformat(str(deadline).replace("Z", "+00:00"))
            if deadline_dt.tzinfo is None:
                deadline_dt = deadline_dt.replace(tzinfo=timezone.utc)
            days_left = (deadline_dt - now_utc).days
            if days_left <= 3:
                title = task.get("title", "your upcoming task")
                return (
                    f"How is your progress on '{title}' before the deadline?",
                    ["Not started", "In progress", "Almost done", "Completed"]
                )
        except Exception:
            continue

    if "academic_study" in selected_activities:
        return (
            "How effective was your study session today?",
            ["Very focused", "Mostly focused", "Some distractions", "Need a better plan"]
        )

    if "assignments" in selected_activities:
        return (
            "What is your current assignment progress status?",
            ["Planning", "Drafting", "Revising", "Submitted"]
        )

    return (
        "What was your biggest academic win today?",
        ["Finished a tough topic", "Completed tasks on time", "Improved understanding", "Stayed consistent"]
    )

@router.post("/start", response_model=NextQuestionResponse)
async def start_daily_session(req: StartDailyRequest):
    user = await UserModel.find_by_id(req.user_id)
    if not user:
        raise HTTPException(404, "User not found")

    selected_activities = filter_allowed_activities(req.selected_activities)
    if not selected_activities:
        raise HTTPException(400, "No valid activities were provided")

    tasks = await TaskModel.find_by_user(req.user_id)
    tasks_data = [{"title": t["title"], "progress": t.get("progress_stage"), "deadline": t.get("deadline")} for t in tasks]

    try:
        question, options = await generate_initial_question(
            user["name"], selected_activities, tasks_data, user["current_streak"]
        )
    except Exception:
        logger.exception("Failed to generate initial question from LLM; using fallback")
        question, options = _build_fallback_initial_question(selected_activities, tasks_data)

    # normalize incoming date to naive UTC for MongoDB
    date = req.date
    if date and getattr(date, "tzinfo", None) is not None:
        date = date.astimezone(timezone.utc).replace(tzinfo=None)

    # Calculate max questions dynamically based on number of activities
    max_questions = _calculate_max_questions(len(selected_activities))
    
    session_doc = {
        "user_id": req.user_id,
        "date": date,
        "selected_activities": selected_activities,
        "max_questions": max_questions,
        "study_duration_minutes": req.study_duration_minutes,
        "engagement": req.engagement,
        "extra_activity_type": req.extra_activity_type,
        "extra_activity_minutes": req.extra_activity_minutes,
        "subject_focus": req.subject_focus,
        "pending_question": question,
        "pending_options": options,
        "qa_history": [],
        "completed": False,
        "journal_entry": None
    }
    try:
        session = await DailySessionModel.create(session_doc)
    except Exception:
        logger.exception("Failed to create daily session")
        raise HTTPException(500, "Failed to create session")

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
    # build session context (includes derived flags) and pass to LLM decision function
    session_context = await build_session_context(session)
    # Use dynamic max_questions stored in session
    max_questions = session.get("max_questions", 12)
    decision = await process_answer_and_get_next(
        user_name=user["name"],
        session_qa_history=qa_list,
        selected_activities=session["selected_activities"],
        current_tasks=tasks_data,
        total_questions_asked=len(qa_history),
        max_questions=max_questions,
        session_context=session_context
    )

    # Apply task updates
    for update in decision.get("task_updates", []):
        if not is_valid_task_stage(update.get("progress_stage")):
            continue
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

    # Use dynamic max_questions for session completion check
    max_questions = session.get("max_questions", 12)
    if decision.get("end_session") or len(qa_history) >= max_questions:
        # Generate journal with alerts
        context = await build_session_context(session)
        journal = await generate_daily_journal(
            user["name"], session["selected_activities"], session.get("study_duration_minutes") or 0,
            session.get("subject_focus") or "", qa_list, decision.get("task_updates", []), context
        )
        
        # Generate proactive alerts based on at-risk tasks and derived flags
        alerts = generate_proactive_alerts(
            context.get("at_risk_tasks", []),
            context.get("derived", {})
        )
        
        # Add alerts to journal if any exist
        if alerts:
            journal += format_alerts_for_journal(alerts)
        
        update_data["completed"] = True
        update_data["journal_entry"] = journal
        await DailySessionModel.update(req.session_id, update_data)

        # Update learning patterns
        try:
            await aggregate_learning_patterns(session["user_id"])
        except Exception as e:
            logger.warning(f"Failed to update learning patterns: {e}")

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


@router.get("/{session_id}")
async def get_daily_session(session_id: str):
    session = await DailySessionModel.find_by_id(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    return session


@router.get("/user/{user_id}")
async def get_user_daily_sessions(user_id: str):
    sessions = await DailySessionModel.find_user_sessions(user_id)
    return {"user_id": user_id, "sessions": sessions}