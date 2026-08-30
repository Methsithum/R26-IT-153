from app.models.journal.task import TaskModel
from app.models.journal.exam import ExamModel
from app.models.journal.daily_session import DailySessionModel
from app.models.user.user import UserModel
from app.services.journal.context_utils import compute_derived_context, identify_at_risk_tasks
from app.services.time_utils import to_local_date

async def build_session_context(session_doc):
    user = await UserModel.find_by_id(session_doc["user_id"])
    tasks = await TaskModel.find_by_user(session_doc["user_id"])
    exams = await ExamModel.find_by_user(session_doc["user_id"])
    recent_sessions = await DailySessionModel.find_recent_user_sessions(session_doc["user_id"], limit=5)
    
    # Compute derived behavioral flags for LLM context
    tasks_data = [{"title": t["title"], "progress_stage": t.get("progress_stage"), "deadline": t.get("deadline")} for t in tasks]
    journal_day = to_local_date(session_doc.get("date"))
    derived = await compute_derived_context(session_doc, tasks_data, as_of=journal_day)
    at_risk_tasks = await identify_at_risk_tasks(tasks_data, as_of=journal_day)
    recent_answers = []
    for prior in recent_sessions or []:
        for pair in prior.get("qa_history") or []:
            question = str(pair.get("question") or "").strip()
            answer = str(pair.get("answer") or "").strip()
            if question or answer:
                recent_answers.append(
                    {
                        "question": question,
                        "answer": answer,
                        "question_id": pair.get("question_id"),
                    }
                )
    return {
        "user_name": user["name"],
        "journal_date": journal_day.isoformat() if journal_day else None,
        "activities": session_doc["selected_activities"],
        "duration": session_doc.get("study_duration_minutes"),
        "subject": session_doc.get("subject_focus"),
        "qa": session_doc.get("qa_history", []),
        "recent_answers": recent_answers[-16:],
        "recent_sessions": [
            {
                "date": s.get("date"),
                "activities": s.get("selected_activities", []),
                "qa_history": s.get("qa_history", []),
                "journal_entry": s.get("journal_entry"),
            }
            for s in recent_sessions
            if s
        ],
        "tasks": [{"title": t["title"], "progress": t.get("progress_stage"), "deadline": t.get("deadline"), "mark": t.get("mark")} for t in tasks],
        "exams": [
            {
                "subject": e.get("subject"),
                "exam_type": e.get("exam_type"),
                "date": e.get("date"),
                "mark": e.get("mark"),
            }
            for e in exams
        ],
        "derived": derived,
        "at_risk_tasks": at_risk_tasks
    }