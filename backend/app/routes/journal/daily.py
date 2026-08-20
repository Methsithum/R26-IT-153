from fastapi import APIRouter, HTTPException
from app.schemas.journal.daily import StartDailyRequest, AnswerRequest, FinishRunRequest, NextQuestionResponse
from app.models.journal.daily_session import DailySessionModel
from app.models.journal.task import TaskModel
from app.models.journal.exam import ExamModel
from app.models.user.user import UserModel
from app.services.journal.llm_service import fallback_daily_journal, generate_daily_journal
from app.services.journal.question_picker import pick_next_question
from app.services.journal.gamification import _calculate_xp, apply_run_rewards, progress_fields, reconcile_user_progress, update_streak_and_xp, level_from_xp
from app.services.journal.journal_service import build_session_context
from app.services.journal.journal_constants import ASSIGNMENT_STATUS_ANSWERS, filter_allowed_activities
from app.services.journal.alerts import generate_proactive_alerts
from app.services.journal.learning_patterns import aggregate_learning_patterns
import json
import logging
import re
from datetime import datetime, time
from typing import Any, Dict, List, Optional

from app.services.time_utils import calendar_datetime, local_today_iso, to_local_date

router = APIRouter(prefix="/daily", tags=["daily"])
logger = logging.getLogger(__name__)
_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}")


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
            "task_type": t.get("task_type"),
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


def _assignment_progress_stage(answer: Any) -> Optional[str]:
    text = str(answer or "").strip().lower().replace("_", " ").replace("-", " ")
    text = " ".join(text.split())
    return ASSIGNMENT_STATUS_ANSWERS.get(text)


async def _drop_stray_assignment_tasks(user_id: str, session: dict) -> None:
    """Remove empty assignment rows created from exam/lecture subjects today."""
    assignment_subjects = {item for item in (session.get("assignment_subjects") or []) if item}
    today = local_today_iso()
    for task in await TaskModel.find_by_user(user_id):
        if str(task.get("task_type") or "") != "assignment":
            continue
        subject = task.get("subject")
        if not subject or subject in assignment_subjects:
            continue
        if task.get("deadline") or task.get("mark") not in (None, ""):
            continue
        if (task.get("progress_stage") or "in_progress") != "in_progress":
            continue
        if _session_date_key(task.get("created_at")) != today:
            continue
        await TaskModel.delete(task["id"])


def _iso_date(answer: Any) -> Optional[str]:
    if answer is None or isinstance(answer, (dict, list)):
        return None
    text = str(answer).strip()
    if _ISO_DATE.match(text):
        return text[:10]
    return None


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

    if field == "assignmentProgress" or session.get("pending_question_id") == "asg-status":
        stage = _assignment_progress_stage(answer)
        if stage:
            subjects = list(dict.fromkeys(session.get("assignment_subjects") or []))
            meta_subject = meta.get("subject")
            if meta_subject and meta_subject in subjects:
                subjects = list(dict.fromkeys([meta_subject, *subjects]))
            for subject in subjects:
                if subject:
                    await TaskModel.set_progress(user_id, subject, stage)
        await _drop_stray_assignment_tasks(user_id, session)
        return updates

    subject = meta.get("subject") or session.get("pending_mark_subject")
    if not subject:
        if field in {"deadline", "deadline-check", "mark", "mark-check"}:
            subject = (session.get("assignment_subjects") or [None])[0]
        else:
            subject = (session.get("today_subjects") or [None])[0]
    if field in {"deadline", "deadline-check"} and subject:
        iso = _iso_date(answer)
        if iso:
            await TaskModel.set_deadline(user_id, subject, iso)
        checked = list(session.get("asked_deadline_subjects") or [])
        if subject not in checked:
            checked.append(subject)
        updates["asked_deadline_subjects"] = checked
        return updates
    if field in {"mark", "mark-check"} and subject:
        parsed = _parse_mark(answer)
        if parsed is not None and not isinstance(parsed, dict):
            await TaskModel.set_mark(user_id, subject, parsed)
        elif field == "mark-check":
            await TaskModel.record_mark_check(user_id, subject)
        return updates
    if field in {"examDates", "exam-dates-check"}:
        try:
            payload = json.loads(answer) if isinstance(answer, str) else answer
        except json.JSONDecodeError:
            payload = {}
        if isinstance(payload, dict):
            for exam_id, date_value in payload.items():
                iso = _iso_date(date_value)
                if exam_id and iso:
                    await ExamModel.set_date(str(exam_id), iso)
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


def _session_date_key(value) -> Optional[str]:
    day = to_local_date(value)
    return day.isoformat() if day else None


def _record_snapshot(tasks: List[Dict], exams: List[Dict]) -> dict:
    return {
        "tasks": [
            {
                "id": t.get("id"),
                "deadline": t.get("deadline"),
                "mark": t.get("mark"),
                "last_mark_check": t.get("last_mark_check"),
                "progress_stage": t.get("progress_stage"),
            }
            for t in (tasks or [])
            if t.get("id")
        ],
        "exams": [
            {
                "id": e.get("id"),
                "date": e.get("date"),
                "mark": e.get("mark"),
                "last_mark_check": e.get("last_mark_check"),
            }
            for e in (exams or [])
            if e.get("id")
        ],
    }


def _json_object(value: Any) -> Optional[dict]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        text = value.strip()
        if not text.startswith("{"):
            return None
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            return None
        return parsed if isinstance(parsed, dict) else None
    return None


async def _clear_todays_structured_writes(user_id: str, sessions: List[dict]) -> None:
    """Undo exam/assignment writes from today's sessions when no start snapshot exists."""
    today = local_today_iso()
    exam_date_ids: set[str] = set()
    exam_mark_ids: set[str] = set()
    iso_answers: set[str] = set()
    numeric_marks: set[float] = set()

    for session in sessions:
        for qa in session.get("qa_history") or []:
            answer = qa.get("answer")
            payload = _json_object(answer)
            if payload:
                for key, value in payload.items():
                    iso = _iso_date(value)
                    if iso:
                        exam_date_ids.add(str(key))
                        iso_answers.add(iso)
                        continue
                    parsed = _parse_mark(value)
                    if parsed is not None and not isinstance(parsed, dict):
                        exam_mark_ids.add(str(key))
                        numeric_marks.add(float(parsed))
                continue
            iso = _iso_date(answer)
            if iso:
                iso_answers.add(iso)
                continue
            parsed = _parse_mark(answer)
            if parsed is not None and not isinstance(parsed, dict):
                numeric_marks.add(float(parsed))

    for exam in await ExamModel.find_by_user(user_id):
        eid = str(exam.get("id") or "")
        created_today = _session_date_key(exam.get("created_at")) == today
        updated_today = _session_date_key(exam.get("updated_at")) == today
        updates: dict = {}
        if created_today or eid in exam_date_ids or (updated_today and exam.get("date") in iso_answers):
            updates["date"] = None
        mark_value = exam.get("mark")
        try:
            mark_num = float(mark_value) if mark_value not in (None, "") else None
        except (TypeError, ValueError):
            mark_num = None
        if created_today or eid in exam_mark_ids or (updated_today and mark_num in numeric_marks):
            updates["mark"] = None
            updates["last_mark_check"] = None
        if updates:
            await ExamModel.update(eid, updates)

    for task in await TaskModel.find_by_user(user_id):
        if str(task.get("task_type") or "") not in {"assignment", ""}:
            continue
        tid = task.get("id")
        created_today = _session_date_key(task.get("created_at")) == today
        updated_today = _session_date_key(task.get("updated_at")) == today
        updates: dict = {}
        if created_today or (task.get("deadline") in iso_answers):
            updates["deadline"] = None
        mark_value = task.get("mark")
        try:
            mark_num = float(mark_value) if mark_value not in (None, "") else None
        except (TypeError, ValueError):
            mark_num = None
        if created_today or (updated_today and mark_num in numeric_marks):
            updates["mark"] = None
            updates["last_mark_check"] = None
            if created_today:
                updates["progress_stage"] = "in_progress"
        if tid and updates:
            await TaskModel.update(tid, updates)


async def _restore_record_snapshot(user_id: str, snapshot: dict) -> None:
    snap_tasks = {item["id"]: item for item in (snapshot.get("tasks") or []) if item.get("id")}
    snap_exams = {item["id"]: item for item in (snapshot.get("exams") or []) if item.get("id")}
    for task in await TaskModel.find_by_user(user_id):
        tid = task.get("id")
        if tid not in snap_tasks:
            await TaskModel.delete(tid)
            continue
        prev = snap_tasks[tid]
        await TaskModel.update(
            tid,
            {
                "deadline": prev.get("deadline"),
                "mark": prev.get("mark"),
                "last_mark_check": prev.get("last_mark_check"),
                "progress_stage": prev.get("progress_stage") or task.get("progress_stage"),
            },
        )
    for exam in await ExamModel.find_by_user(user_id):
        eid = exam.get("id")
        if eid not in snap_exams:
            await ExamModel.delete(eid)
            continue
        prev = snap_exams[eid]
        await ExamModel.update(
            eid,
            {
                "date": prev.get("date"),
                "mark": prev.get("mark"),
                "last_mark_check": prev.get("last_mark_check"),
            },
        )


async def _revert_gamification(user: dict, xp_to_remove: int, remaining_sessions: list) -> None:
    total_xp = max(0, int(user.get("total_xp") or 0) - max(0, xp_to_remove))
    await reconcile_user_progress(user, remaining_sessions, total_xp=total_xp)


def _progress_from_sessions(sessions: list[dict]) -> tuple[int, bool]:
    completed = [s for s in (sessions or []) if s and s.get("completed")]
    completed.sort(key=lambda s: str(s.get("date") or ""))
    today = local_today_iso()
    today_done = any(_session_date_key(s.get("date")) == today for s in completed)
    if today_done:
        return max(1, len(completed)), True
    return len(completed) + 1, False


async def _complete_session(session_id: str, session: dict, qa_list: list, task_updates: list, update_data: dict) -> dict:
    await _drop_stray_assignment_tasks(session["user_id"], session)
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

    xp_earned, new_badges = await update_streak_and_xp(
        session["user_id"],
        session["date"],
        questions_count=len(qa_list),
        engagement=session.get("engagement"),
        has_at_risk=bool(context.get("at_risk_tasks")),
    )
    await DailySessionModel.update(session_id, {"xp_earned": xp_earned})
    user = await UserModel.find_by_id(session["user_id"]) or user
    sessions = await DailySessionModel.find_user_sessions(session["user_id"])
    current_day, daily_completed = _progress_from_sessions(sessions)
    return {
        "narrative": narrative,
        "highlights": highlights,
        **progress_fields(
            user,
            current_day=current_day,
            daily_completed=daily_completed,
            xp_earned=xp_earned,
            new_badges=new_badges,
        ),
    }


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
    exams = await ExamModel.find_by_user(req.user_id)
    tasks_data = _task_rows(tasks)
    missing_exams = []
    if "exam_preparation" in selected_activities and exam_subjects and exam_kinds:
        missing_exams = await ExamModel.missing(
            req.user_id, exam_subjects, exam_kinds
        )
    unmarked_exams = await ExamModel.missing_marks(req.user_id)
    unmarked_assignments = await TaskModel.assignments_needing_mark(req.user_id)

    date = calendar_datetime(req.date)

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
        "asked_deadline_subjects": [],
        "qa_history": [],
        "completed": False,
        "journal_entry": None,
        "record_snapshot": _record_snapshot(tasks, exams),
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
        asked_deadline_subjects=session.get("asked_deadline_subjects") or [],
    )

    if decision.get("end_session") or not decision.get("question"):
        page = await _complete_session(
            req.session_id, session, qa_list, decision.get("task_updates") or [], update_data
        )
        return NextQuestionResponse(
            session_id=req.session_id,
            completed=True,
            journal_entry=page.get("narrative"),
            journal_highlights=page.get("highlights") or [],
            total_xp=page.get("total_xp"),
            level=page.get("level"),
            xp_earned=page.get("xp_earned"),
            current_streak=page.get("current_streak"),
            longest_streak=page.get("longest_streak"),
            badges=page.get("badges"),
            new_badges=page.get("new_badges"),
            current_day=page.get("current_day"),
            daily_completed=page.get("daily_completed"),
        )

    next_q = decision["question"]
    update_data.update(_pending_fields(next_q))
    await DailySessionModel.update(req.session_id, update_data)
    return _pack_question(req.session_id, next_q)


@router.post("/finish")
async def finish_daily_run(req: FinishRunRequest):
    session = await DailySessionModel.find_by_id(req.session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if not session.get("completed"):
        raise HTTPException(400, "Finish the journal questions before closing the run")
    payload = await apply_run_rewards(session["user_id"], req.session_id, req.xp_earned, req.score)
    if not payload:
        raise HTTPException(404, "User not found")
    return payload


@router.delete("/today/{user_id}")
async def delete_today_journal(user_id: str):
    user = await UserModel.find_by_id(user_id)
    if not user:
        raise HTTPException(404, "User not found")

    sessions = await DailySessionModel.find_user_sessions(user_id)
    today = local_today_iso()
    todays = [s for s in sessions if s and _session_date_key(s.get("date")) == today]
    if not todays:
        raise HTTPException(404, "No journal was saved for today")

    snapshot = None
    xp_to_remove = 0
    for session in todays:
        if snapshot is None and session.get("record_snapshot"):
            snapshot = session.get("record_snapshot")
        if not session.get("completed"):
            continue
        if session.get("xp_earned") is not None:
            xp_to_remove += int(session.get("xp_earned") or 0)
        else:
            xp_to_remove += _calculate_xp(
                len(session.get("qa_history") or []),
                session.get("engagement"),
                False,
            )

    if snapshot:
        await _restore_record_snapshot(user_id, snapshot)
    else:
        await _clear_todays_structured_writes(user_id, todays)

    for session in todays:
        await DailySessionModel.delete(session["id"])

    remaining = await DailySessionModel.find_user_sessions(user_id)
    await _revert_gamification(user, xp_to_remove, remaining)
    user = await UserModel.find_by_id(user_id)
    current_day, daily_completed = _progress_from_sessions(remaining)
    return {
        "id": str(user.get("id") or user_id),
        "email": user.get("email"),
        "name": user.get("name"),
        "age": user.get("age"),
        "university_name": user.get("university_name"),
        "degree_name": user.get("degree_name"),
        "campus_year": user.get("campus_year"),
        "semester": user.get("semester"),
        "gpa": user.get("gpa"),
        "subjects": user.get("subjects") or [],
        "total_xp": user.get("total_xp", 0),
        "current_streak": user.get("current_streak", 0),
        "longest_streak": user.get("longest_streak", 0),
        "badges": user.get("badges") or [],
        "current_day": current_day,
        "daily_completed": daily_completed,
        "level": level_from_xp(user.get("total_xp", 0)),
        "sessions": remaining,
        "tasks": await TaskModel.find_by_user(user_id),
        "exams": await ExamModel.find_by_user(user_id),
    }


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
