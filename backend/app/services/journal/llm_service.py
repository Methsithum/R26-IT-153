import json
from openai import AsyncOpenAI
from typing import List, Dict, Any, Tuple
from app.config.settings import settings
from app.services.journal.journal_constants import TASK_PROGRESS_STAGES

client = AsyncOpenAI(api_key=settings.openai_api_key)
MODEL = settings.openai_model

async def generate_initial_question(
    user_name: str,
    selected_activities: List[str],
    existing_tasks: List[Dict],
    streak: int
) -> Tuple[str, List[str]]:
    """Return (question_text, list_of_options)"""
    prompt = f"""
You are an AI academic coach. The student {user_name} has completed these activities today: {', '.join(selected_activities)}.
Current streak: {streak} days.
Their existing tasks (deadlines, progress): {json.dumps(existing_tasks, default=str)}.

Generate the FIRST question to better understand their day. Focus on missing details: if "academic_study" is selected, ask about study duration and subject.
If assignments are due soon, ask about progress.
Output a JSON with "question" and "options" (list of 2-5 predefined choices).
Example: {{"question": "How long did you study today?", "options": ["<1 hour", "1-2 hours", "3-4 hours", ">4 hours"]}}
Only output valid JSON.
"""
    resp = await client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0.7
    )
    data = json.loads(resp.choices[0].message.content)
    return data["question"], data.get("options", [])

async def process_answer_and_get_next(
    user_name: str,
    session_qa_history: List[Dict],  # list of {question, answer}
    selected_activities: List[str],
    current_tasks: List[Dict],
    total_questions_asked: int,
    max_questions: int
) -> Dict[str, Any]:
    """
    Returns dict with keys:
      - next_question: str | None
      - options: List[str] | None
      - end_session: bool
      - task_updates: List[Dict] (tasks to update/create)
    """
    # Build context
    history_str = "\n".join([f"Q: {q['question']}\nA: {q['answer']}" for q in session_qa_history])
    prompt = f"""
You are an AI academic coach. Student: {user_name}.
Today's activities: {', '.join(selected_activities)}.
Questions answered so far:
{history_str}

Current tasks and progress:
{json.dumps(current_tasks, default=str, indent=2)}

Total questions asked in this session: {total_questions_asked}. Max allowed: {max_questions}.

Your job:
1. If you have enough information (or reached max questions) set "end_session": true AND "next_question": null.
2. Otherwise, generate the next RELEVANT question. It must NOT repeat previous questions.
3. Provide 2-5 predefined options.
4. If the student’s answer implies a task progress update (e.g., assignment stage changed), output "task_updates" list. Each update: {{"task_id": (existing id or null for new), "title": "...", "progress_stage": "...", "deadline": ...}}
5. Only use progress stages from: {sorted(TASK_PROGRESS_STAGES)}.
5. Always respond with JSON.

Output format:
{{
  "next_question": "string or null",
  "options": ["option1", ...],
  "end_session": boolean,
  "task_updates": []
}}
"""
    resp = await client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0.7
    )
    return json.loads(resp.choices[0].message.content)

async def generate_daily_journal(
    user_name: str,
    selected_activities: List[str],
    study_duration_minutes: int,
    subject_focus: str,
    qa_history: List[Dict],
    task_updates_summary: List[Dict],
    session_context: Dict[str, Any] | None = None,
) -> str:
    prompt = f"""
Generate a natural, concise daily journal entry (2-3 sentences) for student {user_name}.
Activities: {', '.join(selected_activities)}.
Study duration: {study_duration_minutes} minutes. Focus: {subject_focus}.
Q&A log: {json.dumps(qa_history, indent=2)}.
Task updates: {json.dumps(task_updates_summary)}.
Additional session context: {json.dumps(session_context or {}, default=str, indent=2)}.
Write in first person, positive tone.
"""
    resp = await client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.8
    )
    return resp.choices[0].message.content.strip()

async def generate_weekly_summary(user_name: str, week_data: str) -> str:
    prompt = f"Create a weekly academic reflection summary (2-3 paragraphs) for {user_name} based on this data: {week_data}"
    resp = await client.chat.completions.create(model=MODEL, messages=[{"role": "user", "content": prompt}])
    return resp.choices[0].message.content.strip()


async def generate_semester_summary(user_name: str, semester_data: str) -> str:
    prompt = f"""
Create a semester academic reflection summary for {user_name}.
Use the following data to describe overall productivity, workload, consistency, challenges, and growth.
Keep it natural, specific, and suitable for a student reflection document.

Data:
{semester_data}
"""
    resp = await client.chat.completions.create(model=MODEL, messages=[{"role": "user", "content": prompt}])
    return resp.choices[0].message.content.strip()