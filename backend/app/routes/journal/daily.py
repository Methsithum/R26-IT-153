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
import re
from app.config.settings import settings
from datetime import datetime, timezone
from typing import Dict, List, Tuple

router = APIRouter(prefix="/daily", tags=["daily"])
logger = logging.getLogger(__name__)
MIN_QUESTIONS_BEFORE_COMPLETION = 3


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


def _build_fallback_followup_question(selected_activities: List[str], asked_count: int) -> Tuple[str, List[str]]:
    """Provide deterministic follow-up questions when LLM output is incomplete or ends too early."""
    if asked_count <= 1:
        return (
            "What was the biggest challenge you faced while doing this activity?",
            ["Understanding concepts", "Time management", "Technical issue", "No major challenge"]
        )

    if "assignment_work" in selected_activities or "project_development" in selected_activities:
        return (
            "What is your next concrete step for this work?",
            ["Start a new section", "Revise existing work", "Run tests/checks", "Submit/finalize"]
        )

    return (
        "How focused were you during this session?",
        ["Very focused", "Mostly focused", "Some distractions", "Hard to focus"]
    )


def _normalize_question_text(question: str | None) -> str:
    if not question:
        return ""
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s]", "", question.lower())).strip()


def _question_similarity(left: str | None, right: str | None) -> float:
    left_norm = _normalize_question_text(left)
    right_norm = _normalize_question_text(right)
    if not left_norm or not right_norm:
        return 0.0
    if left_norm == right_norm:
        return 1.0

    left_tokens = set(left_norm.split())
    right_tokens = set(right_norm.split())
    if not left_tokens or not right_tokens:
        return 0.0

    intersection = len(left_tokens & right_tokens)
    union = len(left_tokens | right_tokens)
    jaccard = intersection / union if union else 0.0

    if left_norm in right_norm or right_norm in left_norm:
        jaccard = max(jaccard, 0.75)

    return jaccard


def _is_repeated_question(candidate: str | None, previous_questions: List[str]) -> bool:
    candidate_norm = _normalize_question_text(candidate)
    if not candidate_norm:
        return True

    repeated_keywords = {"focus", "focused", "concentration", "concentrate", "concentrated", "attention", "attention span"}
    candidate_has_focus_theme = any(keyword in candidate_norm for keyword in repeated_keywords)

    for previous in previous_questions:
        prev_norm = _normalize_question_text(previous)
        if not prev_norm:
            continue
        if candidate_norm == prev_norm:
            return True
        if _question_similarity(candidate_norm, prev_norm) >= 0.65:
            return True
        if candidate_has_focus_theme and any(keyword in prev_norm for keyword in repeated_keywords):
            return True
    return False


def _build_unique_followup_question(
    selected_activities: List[str],
    asked_count: int,
    previous_questions: List[str],
) -> Tuple[str, List[str]]:
    candidates = [
        (
            "What was the biggest challenge you faced while doing this activity?",
            ["Understanding concepts", "Time management", "Technical issue", "No major challenge"],
        ),
        (
            "What is your next concrete step for this work?",
            ["Start a new section", "Revise existing work", "Run tests/checks", "Submit/finalize"],
        ),
        (
            "How confident do you feel about the progress so far?",
            ["Not confident", "Somewhat confident", "Confident", "Very confident"],
        ),
        (
            "What support or resource would help you most next?",
            ["Notes / lecture material", "Teacher guidance", "Peer discussion", "More time"],
        ),
        (
            "What would make your next session more productive?",
            ["Clearer plan", "Less distraction", "More practice", "Shorter tasks"],
        ),
        (
            "How focused were you during this session?",
            ["Very focused", "Mostly focused", "Some distractions", "Hard to focus"],
        ),
    ]

    if "assignment_work" in selected_activities or "project_development" in selected_activities:
        candidates.insert(1, (
            "Which part of the assignment needs the most attention next?",
            ["Planning", "Research", "Writing", "Reviewing"],
        ))

    if "academic_study" in selected_activities:
        candidates.insert(1, (
            "Which topic or subject needs more revision next?",
            ["Core theory", "Examples", "Past papers", "Weak areas"],
        ))

    for question, options in candidates:
        if not _is_repeated_question(question, previous_questions):
            return question, options

    # Last-resort fallback if the session history is extremely repetitive.
    return (
        f"What is one small improvement you want to make in your next session #{asked_count + 1}?",
        ["Plan ahead", "Reduce distractions", "Start earlier", "Ask for help"],
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
        "question": session.get("pending_question") or "Follow-up question",
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
    tasks_data = [
        {
            "id": t.get("id"),
            "title": t.get("title", "Untitled"),
            "progress_stage": t.get("progress_stage"),
            "deadline": t.get("deadline"),
        }
        for t in (tasks or [])
        if isinstance(t, dict)
    ]

    qa_list = [{"question": q["question"], "answer": q["answer"]} for q in qa_history]
    user = await UserModel.find_by_id(session["user_id"])
    if not user:
        raise HTTPException(404, "User not found")
    # build session context (includes derived flags) and pass to LLM decision function
    try:
        session_context = await build_session_context(session)
    except Exception:
        logger.exception("Failed to build session context; using minimal context")
        session_context = {
            "user_name": user.get("name", "Student"),
            "activities": session.get("selected_activities", []),
            "duration": session.get("study_duration_minutes"),
            "subject": session.get("subject_focus"),
            "qa": session.get("qa_history", []),
            "recent_sessions": [],
            "tasks": [],
            "derived": {},
            "at_risk_tasks": [],
        }
    # Use dynamic max_questions stored in session
    max_questions = session.get("max_questions", 12)
    try:
        decision = await process_answer_and_get_next(
            user_name=user["name"],
            session_qa_history=qa_list,
            selected_activities=session["selected_activities"],
            current_tasks=tasks_data,
            total_questions_asked=len(qa_history),
            max_questions=max_questions,
            session_context=session_context
        )
    except Exception:
        logger.exception("Failed to process next question from LLM; using fallback follow-up")
        fallback_question, fallback_options = _build_fallback_followup_question(
            session["selected_activities"],
            len(qa_history)
        )
        decision = {
            "next_question": fallback_question,
            "options": fallback_options,
            "end_session": len(qa_history) >= max_questions,
            "task_updates": []
        }

    # Apply task updates
    for update in decision.get("task_updates", []):
        if not isinstance(update, dict):
            continue
        if not is_valid_task_stage(update.get("progress_stage")):
            continue
        try:
            if "task_id" in update and update["task_id"]:
                await TaskModel.update(str(update["task_id"]), {"progress_stage": update.get("progress_stage")})
            else:
                new_task = {
                    "user_id": session["user_id"],
                    "title": update.get("title", "Untitled"),
                    "task_type": update.get("task_type", "assignment"),
                    "progress_stage": update.get("progress_stage"),
                    "deadline": update.get("deadline")
                }
                await TaskModel.create(new_task)
        except Exception:
            logger.warning("Skipping invalid task update payload", exc_info=True)
            continue

    # Use dynamic max_questions for session completion check
    max_questions = session.get("max_questions", 12)
    llm_requested_end = bool(decision.get("end_session"))
    reached_max_questions = len(qa_history) >= max_questions
    can_end_by_llm = len(qa_history) >= MIN_QUESTIONS_BEFORE_COMPLETION

    # Guardrail: do not allow ending too early, and ensure a valid next question exists.
    previous_questions = [q.get("question") for q in qa_list if q.get("question")]

    if not reached_max_questions and (
        (llm_requested_end and not can_end_by_llm)
        or not decision.get("next_question")
        or not decision.get("options")
        or _is_repeated_question(decision.get("next_question"), previous_questions)
    ):
        fallback_question, fallback_options = _build_unique_followup_question(
            session["selected_activities"],
            len(qa_history),
            previous_questions,
        )
        decision["end_session"] = False
        decision["next_question"] = fallback_question
        decision["options"] = fallback_options

    if reached_max_questions or (decision.get("end_session") and can_end_by_llm):
        # Generate journal with alerts
        try:
            context = await build_session_context(session)
        except Exception:
            logger.exception("Failed to rebuild completion context; using minimal completion context")
            context = {
                "at_risk_tasks": [],
                "derived": {},
            }
        try:
            journal = await generate_daily_journal(
                user["name"], session["selected_activities"], session.get("study_duration_minutes") or 0,
                session.get("subject_focus") or "", qa_list, decision.get("task_updates", []), context
            )
        except Exception:
            logger.exception("Failed to generate daily journal from LLM; using fallback summary")
            recent_answers = ", ".join([item.get("answer", "") for item in qa_list[-3:]])
            journal = (
                f"Today I worked on {', '.join(session['selected_activities'])}. "
                f"I reflected on my progress and key points: {recent_answers or 'steady progress across tasks'}. "
                "I will continue with clear next steps in my next session."
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
        prev_total_xp = user.get("total_xp", 0)
        prev_level = (prev_total_xp // 250) + 1

        xp_earned, new_badges = await update_streak_and_xp(
            session["user_id"],
            session["date"],
            questions_count=len(qa_history),
            engagement=session.get("engagement"),
            has_at_risk=bool(context.get("at_risk_tasks"))
        )

        # re-fetch user to compute level change
        updated_user = await UserModel.find_by_id(session["user_id"])
        new_total_xp = updated_user.get("total_xp", 0)
        new_level = (new_total_xp // 250) + 1
        level_up = new_level > prev_level

        return NextQuestionResponse(
            session_id=req.session_id,
            completed=True,
            journal_entry=journal,
            xp_earned=xp_earned,
            new_badges=new_badges,
            level_up=level_up
        )
    else:
        next_question = decision.get("next_question")
        next_options = decision.get("options", [])
        if (
            not next_question
            or not isinstance(next_options, list)
            or len(next_options) == 0
            or _is_repeated_question(next_question, previous_questions)
        ):
            fallback_question, fallback_options = _build_unique_followup_question(
                session["selected_activities"],
                len(qa_history),
                previous_questions,
            )
            next_question = fallback_question
            next_options = fallback_options

        update_data["pending_question"] = next_question
        update_data["pending_options"] = next_options
        await DailySessionModel.update(req.session_id, update_data)
        return NextQuestionResponse(
            session_id=req.session_id,
            question=next_question,
            options=next_options,
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