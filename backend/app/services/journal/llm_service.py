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
    uncovered_activities: List[str] | None = None,
) -> Dict[str, Any]:
    """Ask the LLM to choose one bank `question_id`. It must not invent text."""
    if not candidates:
        return {"question_id": None, "end_session": True, "task_updates": []}

    history_str = "\n".join(
        [f"Q: {q['question']}\nA: {q['answer']}" for q in qa_history]
    ) or "None yet"

    candidate_lines = "\n".join(
        [
            f"- {c['id']} (intent={c.get('intent_id') or c['id']}): {c['question']} | activities={','.join(c.get('activities') or [])}"
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

    uncovered = uncovered_activities or []
    uncovered_info = (
        f"Uncovered ticked activities (must not end yet): {', '.join(uncovered)}.\n"
        if uncovered
        else "Every ticked activity already has at least one question.\n"
    )
    journal_date = (session_context or {}).get("journal_date")
    day_line = (
        f"This check-in is for calendar date {journal_date}. Ask about that day's activities, even if it is not today.\n"
        if journal_date
        else "This check-in is for today.\n"
    )
    recent_answers = (session_context or {}).get("recent_answers") or []
    if not recent_answers:
        for prior in (session_context or {}).get("recent_sessions") or []:
            for pair in prior.get("qa_history") or []:
                recent_answers.append(
                    {
                        "question": pair.get("question"),
                        "answer": pair.get("answer"),
                        "question_id": pair.get("question_id"),
                    }
                )
        recent_answers = recent_answers[-16:]
    memory_str = (
        "\n".join(
            f"Q: {item.get('question')}\nA: {item.get('answer')}"
            for item in recent_answers
            if item.get("question") or item.get("answer")
        )
        or "None on file"
    )
    exams = (session_context or {}).get("exams") or []

    prompt = f"""
You pick journal check-in questions for student {user_name}.
You MUST pick from the candidate list. Never invent a question, never rewrite one, never invent options or a new id.

{day_line}Activities for that day: {', '.join(selected_activities) or 'unspecified'}.
{uncovered_info}{extra_info}{at_risk_info}
Answers so far this session:
{history_str}

Previous check-in answers (memory — follow these, do not re-ask the same fact):
{memory_str}

Known assignments/tasks:
{json.dumps(tasks, default=str)}

Known exams:
{json.dumps(exams, default=str)}

Questions asked this session: {total_questions_asked}. Soft max: {max_questions}.

CANDIDATES (pick exactly one id):
{candidate_lines}

Rules:
1. Never set end_session true while uncovered activities remain. The backend will reject it.
2. Follow the latest answer in this session. Stay on that activity for one more beat, then rotate to an uncovered activity.
3. Use previous answers, known tasks, and known exams as memory. Do not pick a candidate that asks something they already answered unless today could have changed it.
4. Subjects, deadlines, exam dates, and marks are collected by the backend. Do not try to gather those facts yourself.
5. Prefer a candidate whose intent fits what they just said, that day's activities, and any at-risk tasks.
6. Keep coverage thin: one or two flavour questions per activity is enough, then rotate.
7. If every ticked activity is covered and you have a clear picture of that day, you may set end_session true and question_id null.
8. If the latest answer implies a task progress change, include task_updates. Each update: {{"task_id": (existing id or null), "title": "...", "progress_stage": "...", "deadline": ...}}. Only use progress stages from: {sorted(TASK_PROGRESS_STAGES)}.
9. Respond with JSON only:
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
    if (data.get("end_session") or not question_id) and not uncovered:
        return {
            "question_id": None,
            "end_session": True,
            "task_updates": data.get("task_updates") or [],
        }
    if (data.get("end_session") or not question_id) and uncovered:
        return {
            **_fallback_pick(candidates),
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
    journal_date = (session_context or {}).get("journal_date")
    day_line = (
        f"Write this page as the student's diary for {journal_date}, not necessarily today's date.\n"
        if journal_date
        else "Write this page as today's diary.\n"
    )
    prompt = f"""
You are writing a student diary page for {user_name}.
Return JSON only:
{{
  "narrative": "2-3 short first-person paragraphs separated by a blank line. Natural diary voice. Weave the answers into a story. Never write lists like academic (Yes) or category (answer). Do not mention XP, score, mini-games, or that this is a video game.",
  "highlights": ["one short recap bullet per fact from that day"]
}}

{day_line}Activities: {', '.join(selected_activities) or 'unspecified'}.
Study duration: {study_duration_minutes or 0} minutes.
Subject focus: {subject_focus or 'unspecified'}.
Q&A log: {json.dumps(qa_history, indent=2, default=str)}.
Task updates: {json.dumps(task_updates_summary, default=str)}.
Session context: {json.dumps(session_context or {{}}, default=str)}.

Rules:
- The paragraphs and the bullets must cover the same day.
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

def fallback_period_journal(kind: str, answers: Dict[str, str] | None = None) -> Dict[str, Any]:
    highlights = []
    for question, answer in (answers or {}).items():
        text = str(answer or "").strip()
        if text:
            highlights.append(f"{question}: {text}")
    if kind == "weekly":
        narrative = (
            "This week I paused long enough to look back at the campus days I actually lived, "
            "not only the ones I meant to have.\n\n"
            "The check-ins, the unfinished work, and the small wins are on the page now so next week "
            "does not start from a blank head."
        )
    else:
        narrative = (
            "This semester I can see a shape in the work: the modules I kept returning to, "
            "the weeks I showed up, and the places I still need to be kinder to myself. "
            "Writing it down makes the rest of the term feel like a continuation instead of a restart."
        )
    return {"narrative": narrative, "highlights": highlights[:8]}


async def generate_weekly_summary(
    user_name: str,
    week_data: str,
    answers: Dict[str, str] | None = None,
) -> Dict[str, Any]:
    prompt = f"""
You are writing a weekly student diary page for {user_name}.
Use ONLY the campus journal sessions from that week. Do not invent deadlines, marks, subjects, or days that are not in the data.
Return JSON only:
{{
  "narrative": "2-3 short first-person paragraphs separated by a blank line (\\n\\n). Warm, specific, literary but plain. Weave the week's actual journal entries into one letter. Never mention XP, mini-games, forms, or that this is software.",
  "highlights": ["3 to 6 short recap bullets drawn from that week's sessions"]
}}

Week sessions:
{week_data}
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
            return {
                "narrative": narrative,
                "highlights": highlights or fallback_period_journal("weekly", answers)["highlights"],
            }
    except Exception:
        pass
    return fallback_period_journal("weekly", answers)


async def generate_semester_summary(
    user_name: str,
    semester_data: str,
    answers: Dict[str, str] | None = None,
) -> Dict[str, Any]:
    prompt = f"""
You are writing a semester reflection letter for student {user_name}.
Return JSON only:
{{
  "narrative": "4-7 first-person sentences. A letter to themselves about the term so far: workload, consistency, growth, what still needs care. Never mention XP, games, or the app.",
  "highlights": ["4 to 8 short recap bullets"]
}}

Semester data:
{semester_data}

Reflection answers:
{json.dumps(answers or {}, default=str)}
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
            return {
                "narrative": narrative,
                "highlights": highlights or fallback_period_journal("semester", answers)["highlights"],
            }
    except Exception:
        pass
    return fallback_period_journal("semester", answers)