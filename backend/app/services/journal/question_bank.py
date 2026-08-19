"""Curated journal question bank.

The LLM never invents runner questions. It only picks a `question_id` from a
filtered shortlist of these templates. Every choice question ships 4 lane
answers so the campus runner can map one option to each lane.
"""

from typing import Any, Optional


def _q(
    qid: str,
    question: str,
    options: Optional[list[str]],
    activities: list[str],
    *,
    category: str = "academic",
    answer_type: str = "choice",
    special: bool = False,
    interaction_type: Optional[str] = None,
    target_location: Optional[str] = None,
    stage: str = "daily_checkin",
    context_field: Optional[str] = None,
) -> dict[str, Any]:
    return {
        "id": qid,
        "question": question,
        "options": options,
        "activities": activities,
        "category": category,
        "answer_type": answer_type,
        "requires_special_interaction": special,
        "interaction_type": interaction_type,
        "target_location": target_location,
        "stage": stage,
        "context_field": context_field,
    }


ANY = ["*"]
STUDY = ["academic_study"]
ASG = ["assignment_work"]
EXAM = ["exam_preparation"]
PROJ = ["project_development"]
INTERN = ["internship"]
CLUB = ["club_participation", "event_participation", "sports"]
ACADEMIC = ["academic_study", "assignment_work", "exam_preparation", "project_development"]

QUESTION_BANK: list[dict[str, Any]] = [
    # --- lectures / study ---
    _q("lecture-subjects", "Which lectures did you attend today?",
       None, STUDY, answer_type="choice", special=True, interaction_type="subjectPick",
       target_location="lecture-hall", stage="lecture_subjects_needed", context_field="lectureSubjects"),
    _q("study-attend", "Did you attend a lecture today?",
       ["Yes, all of them", "Yes, some of them", "No, I self-studied", "No, I skipped"],
       STUDY, category="attendance"),
    _q("study-focus", "How focused was your study session today?",
       ["Very focused", "Mostly focused", "Some distractions", "Need a better plan"],
       STUDY, category="academic"),
    _q("study-duration", "How long did you study today?",
       ["Under 1 hour", "1–2 hours", "2–3 hours", "More than 3 hours"],
       STUDY, category="academic"),
    _q("study-subject", "Which area did you spend most study time on?",
       ["Core lecture material", "Tutorial / lab work", "Revision", "Extra reading"],
       STUDY, category="academic"),
    _q("study-method", "How did you study today?",
       ["Notes and reading", "Practice questions", "Group study", "Video / recorded lecture"],
       STUDY, category="academic"),
    _q("study-understood", "How well did you understand today's material?",
       ["Fully", "Mostly", "Partly", "I need to revisit it"],
       STUDY, category="academic"),
    _q("study-notes", "Did you finish organising today's notes?",
       ["Yes, they're complete", "Partly", "Not yet", "I studied without notes"],
       STUDY, category="academic"),
    _q("study-questions", "Did you ask or follow up on anything you didn't understand?",
       ["Yes, in class", "Yes, with a friend", "Not yet", "Nothing was unclear"],
       STUDY, category="academic"),
    # --- assignments ---
    _q("assignment-subjects", "Which assignment subject(s) did you work on today?",
       None, ASG, answer_type="choice", special=True, interaction_type="subjectPick",
       target_location="library", stage="assignment_subjects_needed", context_field="assignmentSubjects"),
    _q("asg-worked", "Did you work on an assignment today?",
       ["Yes, made good progress", "Yes, a little", "Planned only", "Not today"],
       ASG, category="academic"),
    _q("asg-status", "What is the current status of your assignment work?",
       ["Not started", "In progress", "Almost done", "Submitted"],
       ASG, category="academic", context_field="assignmentProgress"),
    _q("asg-blockers", "What is slowing your assignment down right now?",
       ["Unclear requirements", "Time", "A technical issue", "Nothing major"],
       ASG, category="academic"),
    _q("asg-hours", "How many hours did you put into assignments today?",
       ["None", "Under 1 hour", "1–3 hours", "More than 3 hours"],
       ASG, category="academic"),
    _q("asg-next", "What is the next assignment step?",
       ["Research", "Drafting", "Reviewing", "Submit"],
       ASG, category="academic"),
    _q("asg-confidence", "How confident are you about the assignment quality?",
       ["Very", "Somewhat", "Not very", "Too early to say"],
       ASG, category="academic"),
    _q("asg-deadline-check", "Has the deadline for {subject} been given?",
       ["Yes", "Not yet", "Only a tentative date", "I need to check"],
       ASG, category="academic", stage="deadline_check", context_field="deadline-check",
       interaction_type="date", target_location="library"),
    _q("asg-deadline", "When is your next assignment due?",
       None, ASG, answer_type="date", special=True, interaction_type="date",
       target_location="library", stage="deadline_needed", context_field="deadline"),
    _q("asg-mark-pick", "Which assignment do you want to log a mark for?",
       None, ANY, answer_type="choice", special=True, interaction_type="markTarget",
       target_location="faculty-science", stage="mark_subject_needed", context_field="assignmentMarkSubject"),
    _q("asg-mark-check", "Have you received a mark for a submitted assignment?",
       ["Yes", "Not yet", "Partial feedback only", "Waiting on the lecturer"],
       ANY, category="academic", stage="mark_review", context_field="mark-check",
       interaction_type="marks", target_location="faculty-science"),
    _q("asg-mark-enter", "Log the mark you received.",
       None, ANY, answer_type="number", special=True, interaction_type="marks",
       target_location="faculty-science", stage="mark_entry", context_field="mark"),
    # --- exams ---
    _q("exam-setup", "Which exam subject(s) did you prepare, and was it Mid, Final, or both?",
       None, EXAM, answer_type="choice", special=True, interaction_type="examSetup",
       target_location="exam-hall", stage="exam_setup_needed", context_field="examSetup"),
    _q("exam-studied", "Did you study for an examination today?",
       ["Yes, a full session", "Yes, a short review", "Only planned it", "Not today"],
       EXAM, category="academic"),
    _q("exam-readiness", "How ready do you feel for your next exam?",
       ["Ready", "Getting there", "Behind", "Not sure yet"],
       EXAM, category="academic"),
    _q("exam-topic", "What did exam prep focus on?",
       ["Past papers", "Lecture revision", "Memorising notes", "Group discussion"],
       EXAM, category="academic"),
    _q("exam-hours", "How long did you spend on exam preparation?",
       ["Under 1 hour", "1–2 hours", "2–4 hours", "More than 4 hours"],
       EXAM, category="academic"),
    _q("exam-dates-check", "Have exam dates been released?",
       ["Yes", "Not yet", "Only some of them", "I need to check"],
       EXAM, category="academic", stage="exam_date_check", context_field="exam-dates-check",
       interaction_type="examDate", target_location="exam-hall"),
    _q("exam-dates", "Confirm the dates for exams that are still missing.",
       None, EXAM, answer_type="date", special=True, interaction_type="examDate",
       target_location="exam-hall", stage="exam_date", context_field="examDates"),
    _q("exam-mark-pick", "Which exam result do you want to log?",
       None, ANY, answer_type="choice", special=True, interaction_type="markTarget",
       target_location="exam-hall", stage="exam_mark_subject_needed", context_field="examMarkSubject"),
    _q("exam-mark-check", "Have you received a mark for a completed exam?",
       ["Yes", "Not yet", "Partial results only", "Waiting on the lecturer"],
       ANY, category="academic", stage="exam_mark_review", context_field="exam-mark-check",
       interaction_type="marks", target_location="exam-hall"),
    _q("exam-mark-enter", "Log the exam mark you received.",
       None, ANY, answer_type="number", special=True, interaction_type="marks",
       target_location="exam-hall", stage="exam_mark_entry", context_field="examMark"),
    _q("exam-anxiety", "How is exam stress today?",
       ["Calm", "Manageable", "High", "Overwhelming"],
       EXAM, category="wellbeing"),
    # --- projects ---
    _q("proj-worked", "Did you work on a personal or course project today?",
       ["Yes, coded / built", "Yes, planned", "Reviewed only", "Not today"],
       PROJ, category="activity"),
    _q("proj-part", "What part of the project did you work on?",
       ["Planning", "Building", "Testing", "Documentation"],
       PROJ, category="activity"),
    _q("proj-progress", "How is the project progressing?",
       ["On track", "Slightly behind", "Stuck", "Ahead"],
       PROJ, category="activity"),
    _q("proj-hours", "How long did you spend on the project?",
       ["Under 1 hour", "1–2 hours", "2–4 hours", "More than 4 hours"],
       PROJ, category="activity"),
    # --- internship ---
    _q("intern-today", "What internship activity did you do today?",
       ["Worked a shift / tasks", "Applied", "Interview prep", "Nothing today"],
       INTERN, category="activity"),
    _q("intern-status", "Where are you in the internship process?",
       ["Not applied", "Application pending", "Interview pending", "Joined / working"],
       INTERN, category="activity"),
    _q("intern-learn", "What did you take away from internship work today?",
       ["A new skill", "Workplace routine", "Feedback from a supervisor", "Nothing notable"],
       INTERN, category="activity"),
    _q("intern-hours", "How long was internship / work time today?",
       ["None", "Under 2 hours", "Half day", "Full day"],
       INTERN, category="activity"),
    # --- extra-curricular ---
    _q("club-today", "Did you take part in a club, sport, or event today?",
       ["Yes, a club", "Yes, sport", "Yes, an event", "Not today"],
       CLUB, category="wellbeing"),
    _q("club-energy", "Did extra-curricular activity help or drain you today?",
       ["It recharged me", "Balanced", "A bit tiring", "It got in the way of study"],
       CLUB, category="wellbeing"),
    _q("club-time", "How long did extra-curricular activities take?",
       ["Under 1 hour", "1–2 hours", "2–4 hours", "More than 4 hours"],
       CLUB, category="wellbeing"),
    # --- wellbeing / generic (eligible any day) ---
    _q("day-energy", "How was your energy level today?",
       ["Low", "Okay", "Good", "Great"],
       ANY, category="wellbeing"),
    _q("day-win", "What was your biggest academic win today?",
       ["Finished a tough topic", "Stayed consistent", "Submitted work", "Rested when I needed to"],
       ANY, category="wellbeing"),
    _q("day-balance", "How balanced was study vs everything else today?",
       ["Study-heavy", "Balanced", "Life-heavy", "Neither really happened"],
       ANY, category="wellbeing"),
    _q("day-sleep", "How was last night's sleep before today?",
       ["Good", "Okay", "Short", "Poor"],
       ANY, category="wellbeing"),
    _q("day-plan", "Do you already know tomorrow's main academic task?",
       ["Yes, clearly", "Roughly", "Not yet", "I have a rest day"],
       ACADEMIC, category="academic"),
    _q("day-help", "Did you need help from anyone today?",
       ["Lecturer / tutor", "Friends", "No, I managed", "I needed help but didn't ask"],
       ACADEMIC, category="academic"),
]


QUESTION_BY_ID = {q["id"]: q for q in QUESTION_BANK}


def get_question(question_id: str) -> Optional[dict[str, Any]]:
    return QUESTION_BY_ID.get(question_id)


def pad_options(options: Optional[list[str]]) -> Optional[list[str]]:
    if not options:
        return None
    padded = list(options)
    while len(padded) < 4:
        padded.append(padded[-1])
    return padded[:4]
