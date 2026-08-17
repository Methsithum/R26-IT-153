import json
from openai import AsyncOpenAI
from typing import List, Dict, Any
from app.config.settings import settings
from app.services.journal.journal_constants import TASK_PROGRESS_STAGES

client = AsyncOpenAI(api_key=settings.openai_api_key)
MODEL = settings.openai_model


def _fallback_pick(candidates: List[Dict]) -> Dict[str, Any]:
    if not candidates:
        return {"question_id": None, "end_session": True, "task_updates": []}
    return {"question_id": candidates[0]["id"], "end_session": False, "task_updates": []}


async def pick_question_id(
    *,
    user_name: str,
    selected_activities: List[str],
    qa_history: List[Dict],
    tasks: List[Dict],
    candidates: List[Dict],
    session_context: Dict[str, Any] | None = None,
    total_questions_asked: int = 0,
    max_questions: int = 12,
) -> Dict[str, Any]:
    """Ask the LLM to choose one bank `question_id`. It must not invent text."""
    if not candidates:
        return {"question_id": None, "end_session": True, "task_updates": []}

    history_str = "\n".join(
        [f"Q: {q['question']}\nA: {q['answer']}" for q in qa_history]
    ) or "None yet"

    candidate_lines = "\n".join(
        [
            f"- {c['id']}: {c['question']} | activities={','.join(c.get('activities') or [])} | stage={c.get('stage')}"
            for c in candidates
        ]
    )
    allowed_ids = {c["id"] for c in candidates}

    derived = session_context.get("derived") if session_context else None
    extra_info = ""
    if derived:
        extra_info = (
            f"Derived flags: low_study={derived.get('low_study')}, "
            f"deadline_pressure={derived.get('deadline_pressure')}, "
            f"overloaded={derived.get('overloaded')}, inactive={derived.get('inactive')}, "
            f"low_engagement={derived.get('low_engagement')}\n"
        )

    at_risk_tasks = session_context.get("at_risk_tasks", []) if session_context else []
    at_risk_info = ""
    if at_risk_tasks:
        at_risk_str = "\n".join(
            [
                f"- '{t['title']}': Due in {t['days_left']} day(s), status={t['progress']} (URGENCY: {t['urgency']})"
                for t in at_risk_tasks
            ]
        )
        at_risk_info = f"\nAT-RISK TASKS (prefer questions about these):\n{at_risk_str}\n"

    prompt = f"""
You pick journal check-in questions for student {user_name}.
You MUST pick from the candidate list. Never invent a question, never rewrite one, never invent options.

Today's activities: {', '.join(selected_activities) or 'unspecified'}.
{extra_info}{at_risk_info}
Answers so far:
{history_str}

Known tasks:
{json.dumps(tasks, default=str)}

Questions asked this session: {total_questions_asked}. Max allowed: {max_questions}.

CANDIDATES (pick exactly one id):
{candidate_lines}

Rules:
1. If you already have enough of a picture of today, or {total_questions_asked} is close to the max, set end_session true and question_id null.
2. Prefer candidates that match today's activities and any at-risk tasks.
3. Do not pick a candidate that repeats what was already answered.
4. If the latest answer implies a task progress change, include task_updates. Each update: {{"task_id": (existing id or null), "title": "...", "progress_stage": "...", "deadline": ...}}. Only use progress stages from: {sorted(TASK_PROGRESS_STAGES)}.
5. Respond with JSON only:
{{
  "question_id": "one-of-the-candidate-ids-or-null",
  "end_session": false,
  "task_updates": []
}}
"""
    try:
        resp = await client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        data = json.loads(resp.choices[0].message.content)
    except Exception:
        return _fallback_pick(candidates)

    question_id = data.get("question_id")
    if data.get("end_session") or not question_id:
        return {
            "question_id": None,
            "end_session": True,
            "task_updates": data.get("task_updates") or [],
        }
    if question_id not in allowed_ids:
        return {
            **_fallback_pick(candidates),
            "task_updates": data.get("task_updates") or [],
        }
    return {
        "question_id": question_id,
        "end_session": False,
        "task_updates": data.get("task_updates") or [],
    }


def fallback_daily_journal(
    qa_history: List[Dict],
    selected_activities: List[str] | None = None,
) -> Dict[str, Any]:
    highlights = []
    activities = [a.replace("_", " ") for a in (selected_activities or []) if a]
    if activities:
        highlights.append("Today's activities: " + ", ".join(activities))
    for pair in qa_history or []:
        question = str(pair.get("question") or "Check-in").rstrip("?").strip()
        answer = str(pair.get("answer") or "—").strip()
        if question or answer:
            highlights.append(f"{question}: {answer}")
    count = len(qa_history or [])
    narrative = (
        "Today I showed up for my campus journal and wrote down how the day actually went. "
        f"I logged {count} check-in{'s' if count != 1 else ''} "
        "so lectures, study, and anything still outstanding are on the page instead of only in my head."
    )
    return {"narrative": narrative, "highlights": highlights}


async def generate_daily_journal(
    user_name: str,
    selected_activities: List[str],
    study_duration_minutes: int,
    subject_focus: str,
    qa_history: List[Dict],
    task_updates_summary: List[Dict],
    session_context: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    prompt = f"""
You are writing a student diary page for {user_name}.
Return JSON only:
{{
  "narrative": "2-4 first-person sentences. Natural diary voice. Weave the answers into a story. Never write lists like academic (Yes) or category (answer). Do not mention XP, score, mini-games, or that this is a video game.",
  "highlights": ["one short recap bullet per fact from today"]
}}

Today's activities: {', '.join(selected_activities) or 'unspecified'}.
Study duration: {study_duration_minutes or 0} minutes.
Subject focus: {subject_focus or 'unspecified'}.
Q&A log: {json.dumps(qa_history, indent=2, default=str)}.
Task updates: {json.dumps(task_updates_summary, default=str)}.
Session context: {json.dumps(session_context or {{}}, default=str)}.

Rules:
- The paragraph and the bullets must cover the same day.
- Highlights: 3 to 8 bullets. Each bullet is one fact (focus, attendance, subject, deadline, mark, exam date, exam mark, activity).
- Be specific. Use the student's actual answers, subjects, and dates.
"""
    try:
        resp = await client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.7,
        )
        data = json.loads(resp.choices[0].message.content)
        narrative = str(data.get("narrative") or "").strip()
        highlights = [str(item).strip() for item in (data.get("highlights") or []) if str(item).strip()]
        if narrative:
            return {"narrative": narrative, "highlights": highlights or fallback_daily_journal(qa_history, selected_activities)["highlights"]}
    except Exception:
        pass
    return fallback_daily_journal(qa_history, selected_activities)

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