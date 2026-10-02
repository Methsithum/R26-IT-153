"""Question Bank Explorer: read-only browsing of the curated question bank
that the journal LLM is allowed to pick from (question_bank.py). Nothing is
mutated here."""

from typing import Dict, List, Optional

from app.services.journal.question_bank import QUESTION_BANK


def list_question_catalog(category: Optional[str] = None, activity: Optional[str] = None) -> Dict:
    questions = QUESTION_BANK
    if category:
        questions = [q for q in questions if q.get("category") == category]
    if activity:
        questions = [q for q in questions if activity in (q.get("activities") or [])]

    by_category: Dict[str, int] = {}
    by_activity: Dict[str, int] = {}
    for q in QUESTION_BANK:
        by_category[q.get("category") or "unspecified"] = by_category.get(q.get("category") or "unspecified", 0) + 1
        for act in q.get("activities") or []:
            by_activity[act] = by_activity.get(act, 0) + 1

    return {
        "total_questions": len(QUESTION_BANK),
        "matched_questions": len(questions),
        "categories": sorted(by_category.keys()),
        "activities": sorted(by_activity.keys()),
        "counts_by_category": by_category,
        "counts_by_activity": by_activity,
        "questions": [
            {
                "id": q["id"],
                "question": q["question"],
                "options": q.get("options"),
                "activities": q.get("activities"),
                "category": q.get("category"),
                "answer_type": q.get("answer_type"),
                "stage": q.get("stage"),
                "system": q.get("system"),
            }
            for q in questions
        ],
    }
