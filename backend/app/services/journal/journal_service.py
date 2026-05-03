from app.models.task import TaskModel
from app.models.user import UserModel

async def build_session_context(session_doc):
    user = await UserModel.find_by_id(session_doc["user_id"])
    tasks = await TaskModel.find_by_user(session_doc["user_id"])
    return {
        "user_name": user["name"],
        "activities": session_doc["selected_activities"],
        "duration": session_doc.get("study_duration_minutes"),
        "subject": session_doc.get("subject_focus"),
        "qa": session_doc.get("qa_history", []),
        "tasks": [{"title": t["title"], "progress": t.get("progress_stage"), "deadline": t.get("deadline")} for t in tasks]
    }