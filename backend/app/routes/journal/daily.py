from fastapi import APIRouter, HTTPException
from app.schemas.journal.daily import StartDailyRequest, AnswerRequest, NextQuestionResponse
from app.models.journal.daily_session import DailySessionModel
from app.models.journal.task import TaskModel
from app.models.journal.exam import ExamModel
from app.models.user.user import UserModel
from app.services.journal.llm_service import fallback_daily_journal, generate_daily_journal
from app.services.journal.question_picker import pick_next_question
from app.services.journal.gamification import update_streak_and_xp
from app.services.journal.journal_service import build_session_context
from app.services.journal.journal_constants import filter_allowed_activities
from app.services.journal.alerts import generate_proactive_alerts
from app.services.journal.learning_patterns import aggregate_learning_patterns
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

router = APIRouter(prefix="/daily", tags=["daily"])
logger = logging.getLogger(__name__)


def _filter_subjects(raw: List[str], allowed: List[str]) -> List[str]:
    allowed_set = set(allowed or [])
    seen = []
    for item in raw or []:
        if item in allowed_set and item not in seen:
            seen.append(item)
    return seen


def _subject_groups(source: dict, user_subjects: List[str]) -> dict:
    lecture = _filter_subjects(source.get("lecture_subjects") or [], user_subjects)
    assignment = _filter_subjects(source.get("assignment_subjects") or [], user_subjects)
    exam = _filter_subjects(source.get("exam_subjects") or [], user_subjects)
    legacy = _filter_subjects(source.get("today_subjects") or [], user_subjects)
    if not lecture and not assignment and not exam and legacy:
        lecture = list(legacy)
        assignment = list(legacy)
        exam = list(legacy)
    combined = list(dict.fromkeys([*lecture, *assignment, *exam]))
    return {
        "lecture_subjects": lecture,
        "assignment_subjects": assignment,
        "exam_subjects": exam,
        "today_subjects": combined,
    }


def _calculate_max_questions(num_activities: int) -> int:
    return 8 + (num_activities * 2)


def _pack_question(session_id: str, question: Optional[Dict[str, Any]], **extra) -> NextQuestionResponse:
    if not question:
        return NextQuestionResponse(session_id=session_id, completed=extra.get("completed", False), journal_entry=extra.get("journal_entry"))
    return NextQuestionResponse(
        session_id=session_id,
        question_id=question.get("id"),
        question=question.get("question"),
        options=question.get("options"),
        category=question.get("category"),
        answer_type=question.get("answer_type"),
        requires_special_interaction=bool(question.get("requires_special_interaction")),
        interaction_type=question.get("interaction_type"),
        target_location=question.get("target_location"),
        context_field=question.get("context_field"),
        subject=question.get("subject"),
        subject_options=question.get("subject_options") or None,
        missing_exams=[
            {
                "id": str(item.get("id")),
                "subject": item.get("subject"),
                "exam_type": item.get("exam_type"),
            }
            for item in (question.get("missing_exams") or [])
            if item.get("id") and item.get("subject") and item.get("exam_type")
        ] or None,
        completed=extra.get("completed", False),
        journal_entry=extra.get("journal_entry"),
    )


def _pending_fields(question: Optional[Dict[str, Any]]) -> dict:
    if not question:
        return {
            "pending_question_id": None,
            "pending_question": None,
            "pending_options": None,
            "pending_meta": None,
        }
    return {
        "pending_question_id": question.get("id"),
        "pending_question": question.get("question"),
        "pending_options": question.get("options"),
        "pending_meta": {
            "category": question.get("category"),
            "answer_type": question.get("answer_type"),
            "requires_special_interaction": question.get("requires_special_interaction"),
            "interaction_type": question.get("interaction_type"),
            "target_location": question.get("target_location"),
            "context_field": question.get("context_field"),
            "subject": question.get("subject"),
            "subject_options": question.get("subject_options"),
            "missing_exams": question.get("missing_exams"),
        },
    }


def _task_rows(tasks: List[Dict]) -> List[Dict]:
    return [
        {
            "id": t.get("id"),
            "title": t.get("title"),
            "subject": t.get("subject"),
            "progress": t.get("progress_stage"),
            "progress_stage": t.get("progress_stage"),
            "deadline": t.get("deadline"),
            "mark": t.get("mark"),
        }
        for t in tasks
    ]


def _first_token(answer: Any) -> str:
    payload = answer
    if isinstance(answer, str):
        try:
            payload = json.loads(answer)
        except json.JSONDecodeError:
            return answer.strip()
    if isinstance(payload, list) and payload:
        return str(payload[0]).strip()
    if isinstance(payload, dict):
        return str(
            payload.get("id")
            or payload.get("exam_id")
            or payload.get("subject")
            or ""
        ).strip()
    return str(payload or "").strip()


def _parse_mark(answer: Any):
    payload = answer
    if isinstance(answer, str):
        try:
            payload = json.loads(answer)
        except json.JSONDecodeError:
            payload = answer
    if isinstance(payload, dict):
        return payload
    try:
        return float(payload)
    except (TypeError, ValueError):
        return None


def _parse_subject_payload(answer: Any) -> Dict[str, List[str]]:
    payload = answer
    if isinstance(answer, str):
        try:
            payload = json.loads(answer)
        except json.JSONDecodeError:
            payload = [part.strip() for part in answer.split(",") if part.strip()]
    subjects: List[str] = []
    kinds: List[str] = []
    if isinstance(payload, list):
        subjects = [str(item).strip() for item in payload if str(item).strip()]
    elif isinstance(payload, dict):
        raw_subjects = payload.get("subjects") or payload.get("lecture_subjects") or payload.get("assignment_subjects") or []
        subjects = [str(item).strip() for item in raw_subjects if str(item).strip()]
        raw_kinds = payload.get("exam_kinds") or payload.get("kinds") or []
        kinds = [item for item in raw_kinds if item in ("mid", "final")]
    return {"subjects": list(dict.fromkeys(subjects)), "exam_kinds": list(dict.fromkeys(kinds))}


async def _record_structured_answer(session: dict, answer: str) -> dict:
    meta = session.get("pending_meta") or {}
    field = meta.get("context_field")
    user_id = session["user_id"]
    updates: dict = {}

    if field in {"lectureSubjects", "assignmentSubjects", "examSetup"}:
        parsed = _parse_subject_payload(answer)
        subjects = parsed["subjects"]
        combined = list(dict.fromkeys([*(session.get("today_subjects") or []), *subjects]))
        updates["today_subjects"] = combined
        if subjects:
            updates["subject_focus"] = subjects[0]
        if field == "lectureSubjects":
            updates["lecture_subjects"] = subjects
        elif field == "assignmentSubjects":
            updates["assignment_subjects"] = subjects
            for subject in subjects:
                await TaskModel.ensure_assignment(user_id, subject)
        else:
            kinds = parsed["exam_kinds"] or ["mid", "final"]
            updates["exam_subjects"] = subjects
            updates["exam_kinds"] = kinds
            for subject in subjects:
                for kind in kinds:
                    await ExamModel.ensure(user_id, subject, kind)
        return updates

    if field == "examMarkSubject":
        token = _first_token(answer)
        exams_meta = meta.get("missing_exams") or []
        exam_id = token
        for exam in exams_meta:
            label = f"{exam.get('subject')} · {str(exam.get('exam_type') or 'exam').title()}"
            if token in {str(exam.get("id")), exam.get("subject"), label}:
                exam_id = str(exam.get("id"))
                break
        if exam_id:
            updates["pending_mark_exam_id"] = exam_id
        return updates

    if field == "assignmentMarkSubject":
        subject = _first_token(answer)
        if subject:
            updates["pending_mark_subject"] = subject
        return updates

    subject = meta.get("subject") or session.get("pending_mark_subject")
    if not subject:
        if field in {"deadline", "mark", "mark-check"}:
            subject = (session.get("assignment_subjects") or session.get("today_subjects") or [None])[0]
        else:
            subject = (session.get("today_subjects") or [None])[0]
    if field == "deadline" and subject:
        await TaskModel.set_deadline(user_id, subject, answer)
        return updates
    if field in {"mark", "mark-check"} and subject:
        parsed = _parse_mark(answer)
        if parsed is not None and not isinstance(parsed, dict):
            await TaskModel.set_mark(user_id, subject, parsed)
        elif field == "mark-check":
            await TaskModel.record_mark_check(user_id, subject)
        return updates
    if field == "examDates":
        try:
            payload = json.loads(answer) if isinstance(answer, str) else answer
        except json.JSONDecodeError:
            payload = {}
        if isinstance(payload, dict):
            for exam_id, date_value in payload.items():
                if exam_id and date_value:
                    await ExamModel.set_date(str(exam_id), str(date_value))
        return updates
    if field in {"examMark", "exam-mark-check"}:
        exams_meta = meta.get("missing_exams") or []
        exam_id = session.get("pending_mark_exam_id") or (exams_meta[0].get("id") if exams_meta else None)
        parsed = _parse_mark(answer)
        if isinstance(parsed, dict):
            for eid, mark_value in parsed.items():
                try:
                    mark = float(mark_value)
                except (TypeError, ValueError):
                    continue
                if eid:
                    await ExamModel.set_mark(str(eid), mark)
            return updates
        if parsed is not None and exam_id:
            await ExamModel.set_mark(str(exam_id), parsed)
        elif field == "exam-mark-check" and exam_id:
            await ExamModel.record_mark_check(str(exam_id))
        return updates
    return updates


async def _complete_session(session_id: str, session: dict, qa_list: list, task_updates: list, update_data: dict) -> dict:
    context = await build_session_context(session)
    user = await UserModel.find_by_id(session["user_id"])
    try:
        page = await generate_daily_journal(
            user["name"],
            session["selected_activities"],
            session.get("study_duration_minutes") or 0,
            session.get("subject_focus") or "",
            qa_list,
            task_updates,
            context,
        )
    except Exception:
        logger.exception("Failed to generate journal entry; using a local summary")
        page = fallback_daily_journal(qa_list, session.get("selected_activities") or [])

    narrative = page.get("narrative") or ""
    highlights = list(page.get("highlights") or [])
    alerts = generate_proactive_alerts(
        context.get("at_risk_tasks", []),
        context.get("derived", {}),
    )
    if alerts:
        highlights.extend(alerts)

    update_data["completed"] = True
    update_data["journal_entry"] = narrative
    update_data["journal_highlights"] = highlights
    update_data.update(_pending_fields(None))
    await DailySessionModel.update(session_id, update_data)

    try:
        await aggregate_learning_patterns(session["user_id"])
    except Exception as e:
        logger.warning(f"Failed to update learning patterns: {e}")

    await update_streak_and_xp(
        session["user_id"],
        session["date"],
        questions_count=len(qa_list),
        engagement=session.get("engagement"),
        has_at_risk=bool(context.get("at_risk_tasks")),
    )
    return {"narrative": narrative, "highlights": highlights}


@router.post("/start", response_model=NextQuestionResponse)
async def start_daily_session(req: StartDailyRequest):
    user = await UserModel.find_by_id(req.user_id)
    if not user:
        raise HTTPException(404, "User not found")

    selected_activities = filter_allowed_activities(req.selected_activities)
    if not selected_activities:
        raise HTTPException(400, "No valid activities were provided")

    user_subjects = user.get("subjects") or []
    groups = _subject_groups(req.model_dump(), user_subjects)
    lecture_subjects = groups["lecture_subjects"]
    assignment_subjects = groups["assignment_subjects"]
    exam_subjects = groups["exam_subjects"]
    today_subjects = groups["today_subjects"]
    exam_kinds = [k for k in (req.exam_kinds or []) if k in ("mid", "final")]

    if "assignment_work" in selected_activities:
        for subject in assignment_subjects:
            await TaskModel.ensure_assignment(req.user_id, subject)
    if "exam_preparation" in selected_activities:
        kinds = exam_kinds or ["mid", "final"]
        for subject in exam_subjects:
            for kind in kinds:
                await ExamModel.ensure(req.user_id, subject, kind)

    tasks = await TaskModel.find_by_user(req.user_id)
    tasks_data = _task_rows(tasks)
    missing_exams = []
    if "exam_preparation" in selected_activities and exam_subjects and exam_kinds:
        missing_exams = await ExamModel.missing(
            req.user_id, exam_subjects, exam_kinds
        )
    unmarked_exams = await ExamModel.missing_marks(req.user_id)
    unmarked_assignments = await TaskModel.assignments_needing_mark(req.user_id)

    date = req.date
    if date and getattr(date, "tzinfo", None) is not None:
        date = date.astimezone(timezone.utc).replace(tzinfo=None)

    max_questions = _calculate_max_questions(len(selected_activities))
    session_context = {"derived": None, "at_risk_tasks": []}

    try:
        decision = await pick_next_question(
            user_name=user["name"],
            selected_activities=selected_activities,
            asked_ids=[],
            qa_history=[],
            tasks=tasks_data,
            session_context=session_context,
            total_questions_asked=0,
            max_questions=max_questions,
            today_subjects=today_subjects,
            lecture_subjects=lecture_subjects,
            assignment_subjects=assignment_subjects,
            exam_subjects=exam_subjects,
            exam_kinds=exam_kinds,
            registered_subjects=user_subjects,
            missing_exams=missing_exams,
            unmarked_exams=unmarked_exams,
            unmarked_assignments=unmarked_assignments,
        )
        question = decision.get("question")
    except Exception:
        logger.exception("Question pick failed on session start")
        question = None
    if not question:
        raise HTTPException(500, "No journal question could be selected")

    session_doc = {
        "user_id": req.user_id,
        "date": date,
        "selected_activities": selected_activities,
        "today_subjects": today_subjects,
        "lecture_subjects": lecture_subjects,
        "assignment_subjects": assignment_subjects,
        "exam_subjects": exam_subjects,
        "exam_kinds": exam_kinds,
        "max_questions": max_questions,
        "study_duration_minutes": req.study_duration_minutes,
        "engagement": req.engagement,
        "extra_activity_type": req.extra_activity_type,
        "extra_activity_minutes": req.extra_activity_minutes,
        "subject_focus": (
            lecture_subjects[0]
            if lecture_subjects
            else (assignment_subjects[0] if assignment_subjects else (exam_subjects[0] if exam_subjects else req.subject_focus))
        ),
        "asked_question_ids": [],
        "qa_history": [],
        "completed": False,
        "journal_entry": None,
        **_pending_fields(question),
    }
    try:
        session = await DailySessionModel.create(session_doc)
    except Exception:
        logger.exception("Failed to create daily session")
        raise HTTPException(500, "Failed to create session")

    return _pack_question(str(session["_id"]), question)


@router.post("/answer", response_model=NextQuestionResponse)
async def answer_question(req: AnswerRequest):
    session = await DailySessionModel.find_by_id(req.session_id)
    if not session or session.get("completed"):
        raise HTTPException(400, "Invalid or already completed session")

    asked_ids = list(session.get("asked_question_ids") or [])
    if session.get("pending_question_id"):
        asked_ids.append(session["pending_question_id"])

    qa_pair = {
        "question_id": session.get("pending_question_id"),
        "question": session.get("pending_question"),
        "answer": req.answer,
        "timestamp": datetime.utcnow(),
    }
    qa_history = session.get("qa_history", [])
    qa_history.append(qa_pair)

    session_updates = await _record_structured_answer(session, req.answer)
    if session_updates:
        session.update(session_updates)

    update_data = {
        "qa_history": qa_history,
        "asked_question_ids": asked_ids,
        **(session_updates or {}),
        **_pending_fields(None),
    }

    today_subjects = session.get("today_subjects") or []
    lecture_subjects = session.get("lecture_subjects") or []
    assignment_subjects = session.get("assignment_subjects") or []
    exam_subjects = session.get("exam_subjects") or []
    exam_kinds = [k for k in (session.get("exam_kinds") or []) if k in ("mid", "final")]
    tasks = await TaskModel.find_by_user(session["user_id"])
    tasks_data = _task_rows(tasks)
    missing_exams = []
    if "exam_preparation" in (session.get("selected_activities") or []) and exam_subjects and exam_kinds:
        missing_exams = await ExamModel.missing(session["user_id"], exam_subjects, exam_kinds)
    unmarked_exams = await ExamModel.missing_marks(session["user_id"])
    unmarked_assignments = await TaskModel.assignments_needing_mark(session["user_id"])
    qa_list = [{"question": q["question"], "answer": q["answer"]} for q in qa_history]
    user = await UserModel.find_by_id(session["user_id"])
    session_context = await build_session_context(session)
    max_questions = session.get("max_questions", 12)
    registered_subjects = (user or {}).get("subjects") or []

    decision = await pick_next_question(
        user_name=user["name"],
        selected_activities=session["selected_activities"],
        asked_ids=asked_ids,
        qa_history=qa_list,
        tasks=tasks_data,
        session_context=session_context,
        total_questions_asked=len(qa_history),
        max_questions=max_questions,
        today_subjects=today_subjects,
        lecture_subjects=lecture_subjects,
        assignment_subjects=assignment_subjects,
        exam_subjects=exam_subjects,
        exam_kinds=exam_kinds,
        registered_subjects=registered_subjects,
        missing_exams=missing_exams,
        unmarked_exams=unmarked_exams,
        unmarked_assignments=unmarked_assignments,
        pending_mark_exam_id=session.get("pending_mark_exam_id"),
        pending_mark_subject=session.get("pending_mark_subject"),
    )

    if decision.get("end_session") or not decision.get("question") or len(qa_history) >= max_questions:
        page = await _complete_session(
            req.session_id, session, qa_list, decision.get("task_updates") or [], update_data
        )
        return NextQuestionResponse(
            session_id=req.session_id,
            completed=True,
            journal_entry=page.get("narrative"),
            journal_highlights=page.get("highlights") or [],
        )

    next_q = decision["question"]
    update_data.update(_pending_fields(next_q))
    await DailySessionModel.update(req.session_id, update_data)
    return _pack_question(req.session_id, next_q)


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
