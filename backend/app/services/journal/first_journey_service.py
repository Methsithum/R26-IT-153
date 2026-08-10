"""First Journey — baseline student context collected through gameplay-style questions."""

from typing import Any, Dict, List, Optional, Tuple

FIRST_JOURNEY_STEPS: List[Dict[str, Any]] = [
    {
        "id": "study_year",
        "question": "Which year of study are you in?",
        "options": ["Year 1", "Year 2", "Year 3", "Year 4+"],
        "question_type": "lane",
        "profile_key": "study_year",
    },
    {
        "id": "study_area",
        "question": "What is your main study area?",
        "options": ["Computing / IT", "Engineering", "Business", "Other field"],
        "question_type": "lane",
        "profile_key": "study_area",
    },
    {
        "id": "has_gpa",
        "question": "Have you received a university GPA yet?",
        "options": ["Yes, I have a GPA", "Not yet", "First year — N/A", "Prefer not to say"],
        "question_type": "lane",
        "profile_key": "has_gpa",
    },
    {
        "id": "gpa_value",
        "question": "Enter your current GPA (e.g. 3.21)",
        "options": [],
        "question_type": "number",
        "profile_key": "gpa",
        "skip_unless": {"has_gpa": "Yes, I have a GPA"},
    },
    {
        "id": "subjects",
        "question": "What are you mainly studying right now?",
        "options": ["Core modules", "Electives", "Mixed subjects", "Exam prep"],
        "question_type": "lane",
        "profile_key": "current_subjects",
    },
    {
        "id": "study_pattern",
        "question": "When do you usually study?",
        "options": ["Morning", "Afternoon", "Evening", "Late night"],
        "question_type": "lane",
        "profile_key": "study_pattern",
    },
    {
        "id": "confidence",
        "question": "How confident do you feel academically?",
        "options": ["Still building", "Fairly confident", "Very confident", "It varies"],
        "question_type": "lane",
        "profile_key": "academic_confidence",
    },
    {
        "id": "extracurricular",
        "question": "Are you involved in extracurricular activities?",
        "options": ["Sports", "Clubs / societies", "Both", "Not currently"],
        "question_type": "lane",
        "profile_key": "extracurricular",
    },
]


def _should_skip_step(step: Dict[str, Any], profile: Dict[str, Any]) -> bool:
    skip_unless = step.get("skip_unless")
    if not skip_unless:
        return False
    for key, expected in skip_unless.items():
        if profile.get(key) != expected:
            return True
    return False


def get_next_question(profile: Dict[str, Any], answered_ids: List[str]) -> Optional[Dict[str, Any]]:
    for step in FIRST_JOURNEY_STEPS:
        if step["id"] in answered_ids:
            continue
        if _should_skip_step(step, profile):
            continue
        return step
    return None


def apply_answer(profile: Dict[str, Any], step: Dict[str, Any], answer: str) -> Dict[str, Any]:
    updated = {**profile}
    key = step.get("profile_key", step["id"])
    if step["question_type"] == "number":
        try:
            updated[key] = float(answer)
        except ValueError:
            updated[key] = None
    elif answer in ("Not yet", "First year — N/A", "Prefer not to say") and key == "has_gpa":
        updated[key] = answer
        updated["gpa"] = None
        updated["gpa_available"] = False
    elif key == "has_gpa" and answer == "Yes, I have a GPA":
        updated[key] = answer
        updated["gpa_available"] = True
    else:
        updated[key] = answer
    return updated


def is_journey_complete(profile: Dict[str, Any], answered_ids: List[str]) -> bool:
    return get_next_question(profile, answered_ids) is None
