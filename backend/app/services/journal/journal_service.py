from app.models.journal.task import TaskModel
from app.models.journal.daily_session import DailySessionModel
from app.models.user.user import UserModel
from app.services.journal.context_utils import compute_derived_context, identify_at_risk_tasks

async def build_session_context(session_doc):
    user = await UserModel.find_by_id(session_doc["user_id"])
    tasks = await TaskModel.find_by_user(session_doc["user_id"])
    recent_sessions = await DailySessionModel.find_recent_user_sessions(session_doc["user_id"], limit=5)
    
    # Compute derived behavioral flags for LLM context
    tasks_data = [{"title": t["title"], "progress_stage": t.get("progress_stage"), "deadline": t.get("deadline")} for t in tasks]
    derived = await compute_derived_context(session_doc, tasks_data)
    
    # Identify at-risk tasks for prioritization
    at_risk_tasks = await identify_at_risk_tasks(tasks_data)
    
    return {
        "user_name": user["name"],
        "activities": session_doc["selected_activities"],
        "duration": session_doc.get("study_duration_minutes"),
        "subject": session_doc.get("subject_focus"),
        "qa": session_doc.get("qa_history", []),
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
        "tasks": [{"title": t["title"], "progress": t.get("progress_stage"), "deadline": t.get("deadline")} for t in tasks],
        "derived": derived,
        "at_risk_tasks": at_risk_tasks
    }