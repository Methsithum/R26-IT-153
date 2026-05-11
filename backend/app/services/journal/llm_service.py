import json
from openai import AsyncOpenAI
from typing import List, Dict, Any, Tuple
from app.config.settings import settings
from app.services.journal.journal_constants import TASK_PROGRESS_STAGES

client = AsyncOpenAI(api_key=settings.openai_api_key)
MODEL = settings.openai_model


def _build_initial_question_from_activities(selected_activities: List[str]) -> Tuple[str, List[str]]:
    """Pick the first question from today's activities (deterministic, not LLM)."""
    if "academic_study" in selected_activities:
        return "How long did you study today?", ["<1 hour", "1-2 hours", "2-3 hours", ">3 hours"]
    
    if "assignment_work" in selected_activities:
        return "What is the current status of your assignment work?", ["Not started", "In progress", "Almost done", "Completed"]
    
    if "project_development" in selected_activities:
        return "What part of your project did you work on today?", ["Planning", "Coding", "Testing", "Documentation"]
    
    if "internship" in selected_activities:
        return "What internship activity did you do today?", ["Applied", "Interview prep", "Worked at internship", "Followed up"]
    
    if any(activity in selected_activities for activity in ["sports", "club_participation", "event_participation"]):
        return "What extra-curricular activity did you do today?", ["Sports", "Club activity", "Event participation", "Volunteering"]
    
    return "What was your main activity today?", ["Study", "Assignments", "Project", "Extra-curricular"]


async def generate_initial_question(
    user_name: str,
    selected_activities: List[str],
    existing_tasks: List[Dict],
    streak: int
) -> Tuple[str, List[str]]:
    """Return (question_text, list_of_options) - ACTIVITY-BASED first."""
    try:
        # Try deterministic activity-based selection first
        question, options = _build_initial_question_from_activities(selected_activities)
        return question, options
    except Exception:
        pass
    
    # Fallback to LLM if deterministic selector fails
    prompt = f"""
You are an AI academic coach. The student {user_name} has completed these activities today: {', '.join(selected_activities)}.
Current streak: {streak} days.
Their existing tasks (deadlines, progress): {json.dumps(existing_tasks, default=str)}.

Generate the FIRST question to deeply understand their day and learning journey.
Focus on:
- Study duration/intensity if academic_study is selected
- Assignment progress if assignment_work is selected
- Learning challenges or breakthroughs
- Motivation and engagement level
- What worked well or what they'd change

Ask a meaningful question that starts the reflection, not just a status check.
Examples:
- "How would you rate your focus during today's study session, and what helped or distracted you?"
- "What was the most challenging part of your assignment today?"
- "On a scale of 1-10, how effective do you feel today's work was, and why?"

Output a JSON with "question" and "options" (list of 2-5 predefined choices that encourage reflection).
Example: {{"question": "How would you rate your overall productivity today?", "options": ["Very productive - achieved goals", "Good progress - on track", "Moderate - some distractions", "Struggled - need to adjust approach"]}}
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
    max_questions: int,
    session_context: Dict[str, Any] | None = None,
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

    # Extract PREVIOUSLY ASKED questions for hardened deduplication
    previous_questions = [q['question'] for q in session_qa_history]
    do_not_ask_list = "\n".join([f"- {q}" for q in previous_questions]) if previous_questions else "None yet"

    # Include derived context when available to steer the LLM towards high-impact questions
    derived = session_context.get("derived") if session_context else None
    extra_info = ""
    if derived:
        extra_info = (
            f"Derived flags: low_study={derived.get('low_study')}, deadline_pressure={derived.get('deadline_pressure')}, "
            f"overloaded={derived.get('overloaded')}, inactive={derived.get('inactive')}, low_engagement={derived.get('low_engagement')}\n"
        )
    
    # Include at-risk tasks if available for prioritization
    at_risk_tasks = session_context.get("at_risk_tasks", []) if session_context else []
    at_risk_info = ""
    if at_risk_tasks:
        at_risk_str = "\n".join([
            f"- '{t['title']}': Due in {t['days_left']} day(s), status={t['progress']} (URGENCY: {t['urgency']})"
            for t in at_risk_tasks
        ])
        at_risk_info = f"\n🚨 AT-RISK TASKS (PRIORITIZE QUESTIONS ABOUT THESE):\n{at_risk_str}\n"

    prompt = f"""
You are an AI academic coach conducting a deep learning reflection with student {user_name}.
Today's activities: {', '.join(selected_activities)}.
{extra_info}{at_risk_info}
Questions answered so far:
{history_str}

Current tasks and progress:
{json.dumps(current_tasks, default=str, indent=2)}

Total questions asked in this session: {total_questions_asked}. Max allowed: {max_questions}.

⚠️ HARDENED DEDUPLICATION - ABSOLUTELY DO NOT ASK THESE QUESTIONS AGAIN:
{do_not_ask_list}

Your job:
1. If you have enough information (or reached max questions) set "end_session": true AND "next_question": null.
2. If there are AT-RISK TASKS above, PRIORITIZE asking about them first before asking generic questions.
3. Otherwise, generate a COMPLETELY DIFFERENT next question. NEVER repeat, rephrase, or ask similar variations of the questions above.

IMPORTANT: Ask comprehensive, insightful questions that explore:
- CHALLENGES & BARRIERS: What obstacles did they face? Why?
- LEARNING INSIGHTS: Did they learn something new? How effective was their approach?
- DEEPER UNDERSTANDING: Why did they choose that approach? What worked/didn't work?
- MOTIVATION & ENGAGEMENT: How motivated were they? What helped/hindered focus?
- STUDY TECHNIQUES: What methods did they use? Would they change anything?
- REFLECTION: What's their biggest takeaway? How will they apply it next time?

Examples of good deeper questions:
- "What was the biggest challenge in understanding [topic]? What would help you overcome it?"
- "How did today's approach differ from what normally works for you?"
- "What's one thing you wish you'd done differently during this session?"
- "Which part felt most rewarding today, and why?"

4. Provide 2-5 predefined options that encourage deeper reflection, not just task status updates.
5. If the student's answer implies a task progress update (e.g., assignment stage changed), output "task_updates" list. Each update: {{"task_id": (existing id or null for new), "title": "...", "progress_stage": "...", "deadline": ...}}
6. If a task has NO deadline and the student mentions timing/urgency, ask them to set a deadline with question_type: "deadline_picker".
7. Only use progress stages from: {sorted(TASK_PROGRESS_STAGES)}.
8. Always respond with JSON.

Output format:
{{
  "next_question": "string or null",
  "options": ["option1", ...],
  "question_type": "deadline_picker" or "regular",
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