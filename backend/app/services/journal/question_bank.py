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
    intent_id: Optional[str] = None,
    system: bool = False,
) -> dict[str, Any]:
    return {
        "id": qid,
        "intent_id": intent_id or _intent_from_id(qid, system or bool(stage != "daily_checkin")),
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
        "system": system or stage != "daily_checkin",
        "active": True,
    }


def _intent_from_id(qid: str, locked: bool) -> str:
    if locked:
        return qid
    if len(qid) > 2 and qid[-2] == "-" and qid[-1] in "abcdefghijklmnopqrstuvwxyz":
        return qid[:-2]
    return qid


ANY = ["*"]
STUDY = ["academic_study"]
ASG = ["assignment_work"]
EXAM = ["exam_preparation"]
LAB = ["lab_practical"]
QUIZ = ["quiz_work"]
PROJ = ["project_development"]
INTERN = ["internship"]
CLUB = ["club_participation", "event_participation", "sports"]
ACADEMIC = [
    "academic_study",
    "assignment_work",
    "exam_preparation",
    "lab_practical",
    "quiz_work",
    "project_development",
]

QUESTION_BANK: list[dict[str, Any]] = [
    # --- lectures / study ---
    _q("lecture-subjects", "Which lectures did you attend today?",
       None, STUDY, answer_type="choice", special=True, interaction_type="subjectPick",
       target_location="lecture-hall", stage="lecture_subjects_needed", context_field="lectureSubjects"),
    _q("study-attend", "Did you attend a lecture today?",
       ["Yes, all of them", "Yes, some of them", "No, I self-studied", "No, I skipped"],
       STUDY, category="attendance"),
    _q("study-attend-b", "How did today's lectures go for you?",
       ["I was there for all of them", "I caught some", "I studied on my own", "I missed them"],
       STUDY, category="attendance"),
    _q("study-attend-c", "Were you present for class today?",
       ["Fully present", "Part of the day", "Self-study instead", "I skipped"],
       STUDY, category="attendance"),
    _q("study-focus", "How focused was your study session today?",
       ["Very focused", "Mostly focused", "Some distractions", "Need a better plan"],
       STUDY, category="academic"),
    _q("study-focus-b", "Could you concentrate while studying today?",
       ["Yes, locked in", "Mostly", "On and off", "Barely"],
       STUDY, category="academic"),
    _q("study-duration", "How long did you study today?",
       ["Under 1 hour", "1–2 hours", "2–3 hours", "More than 3 hours"],
       STUDY, category="academic"),
    _q("study-duration-b", "How much study time did you actually get in?",
       ["A short burst", "About an hour or two", "A solid block", "Most of the day"],
       STUDY, category="academic"),
    _q("study-subject", "Which area did you spend most study time on?",
       ["Core lecture material", "Tutorial / lab work", "Revision", "Extra reading"],
       STUDY, category="academic"),
    _q("study-subject-b", "What did today's study mainly cover?",
       ["New lecture content", "Practice / tutorials", "Revision", "Catch-up reading"],
       STUDY, category="academic"),
    _q("study-method", "How did you study today?",
       ["Notes and reading", "Practice questions", "Group study", "Video / recorded lecture"],
       STUDY, category="academic"),
    _q("study-method-b", "What study method did you use today?",
       ["Rewriting notes", "Past questions", "With friends", "Recorded lectures"],
       STUDY, category="academic"),
    _q("study-understood", "How well did you understand today's material?",
       ["Fully", "Mostly", "Partly", "I need to revisit it"],
       STUDY, category="academic"),
    _q("study-understood-b", "Did today's content click for you?",
       ["Yes, clearly", "Most of it", "Some of it", "I am still lost"],
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
    _q("asg-worked-b", "How far did assignment work get today?",
       ["A real chunk done", "A small start", "Just planning", "I didn't touch it"],
       ASG, category="academic"),
    _q("asg-worked-c", "Was assignment work part of today?",
       ["Yes, a focused session", "Yes, briefly", "I only thought about it", "No"],
       ASG, category="academic"),
    _q("asg-status", "What is the current status of your {subject} assignment?",
       ["Not started", "In progress", "Almost done", "Submitted"],
       ASG, category="academic", stage="assignment_progress", context_field="assignmentProgress"),
    _q("asg-status-b", "Where does the {subject} assignment stand right now?",
       ["Not started", "In progress", "Almost done", "Submitted"],
       ASG, category="academic", stage="assignment_progress", context_field="assignmentProgress"),
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
    _q("asg-next-assignment", "Is this the next assignment for {subject}?",
       ["Yes", "No, still the previous one", "Not yet", "Just catching up on the old one"],
       ASG, category="academic", stage="next_assignment_check", context_field="next-assignment"),
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
    _q("exam-studied-b", "How did exam prep go today?",
       ["A full study block", "A quick recap", "I only planned it", "I skipped it"],
       EXAM, category="academic"),
    _q("exam-studied-c", "Was today an exam-prep day?",
       ["Yes, I sat down for it", "A little revision", "Just organising topics", "Not today"],
       EXAM, category="academic"),
    _q("exam-readiness", "How ready do you feel for your next exam?",
       ["Ready", "Getting there", "Behind", "Not sure yet"],
       EXAM, category="academic"),
    _q("exam-readiness-b", "If the paper was this week, how would you feel?",
       ["I could sit it", "Need a few more days", "Not ready", "Hard to tell"],
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
    _q("exam-mark-check", "Have exam results come out?",
       ["Yes", "Not yet", "Only some subjects", "Waiting on the lecturer"],
       ANY, category="academic", stage="exam_mark_review", context_field="exam-mark-check",
       interaction_type="marks", target_location="exam-hall"),
    _q("exam-mark-enter", "Log the exam mark you received.",
       None, ANY, answer_type="number", special=True, interaction_type="marks",
       target_location="exam-hall", stage="exam_mark_entry", context_field="examMark"),
    _q("exam-anxiety", "How is exam stress today?",
       ["Calm", "Manageable", "High", "Overwhelming"],
       EXAM, category="wellbeing"),
    # --- lab ---
    _q("lab-subjects", "Which lab subject(s) did you work on today?",
       None, LAB, answer_type="choice", special=True, interaction_type="subjectPick",
       target_location="library", stage="lab_subjects_needed", context_field="labSubjects"),
    _q("lab-today", "Did you have a lab session today?",
       ["Yes, I completed it", "Yes, partly", "It was scheduled but I missed it", "No lab today"],
       LAB, category="academic"),
    _q("lab-today-b", "How did practical / lab work go?",
       ["Finished the practical", "Got part-way", "Missed it", "No lab today"],
       LAB, category="academic"),
    _q("lab-today-c", "Was lab work part of today?",
       ["Yes, a full practical", "A short lab task", "I only prepped for it", "Not today"],
       LAB, category="academic"),
    _q("lab-report", "How is the lab report sitting?",
       ["Not started", "In progress", "Almost done", "Submitted"],
       LAB, category="academic"),
    # --- quiz ---
    _q("quiz-subjects", "Which quiz subject(s) did you sit or prepare today?",
       None, QUIZ, answer_type="choice", special=True, interaction_type="subjectPick",
       target_location="library", stage="quiz_subjects_needed", context_field="quizSubjects"),
    _q("quiz-today", "Did you sit or prepare a quiz today?",
       ["Sat it", "Prepared for one", "Both", "Not today"],
       QUIZ, category="academic"),
    _q("quiz-today-b", "How did quiz work go today?",
       ["I sat the quiz", "I revised for it", "I only glanced at it", "No quiz today"],
       QUIZ, category="academic"),
    _q("quiz-today-c", "Was there a quiz on today's plate?",
       ["Yes, I sat it", "Yes, I prepped", "It is coming up", "Not today"],
       QUIZ, category="academic"),
    _q("quiz-feel", "How did the quiz feel?",
       ["Straightforward", "Okay", "Tricky", "Too early to say"],
       QUIZ, category="academic"),
    # --- projects ---
    _q("proj-worked", "Did you work on a personal or course project today?",
       ["Yes, coded / built", "Yes, planned", "Reviewed only", "Not today"],
       PROJ, category="activity"),
    _q("proj-worked-b", "How did project work go today?",
       ["I built something", "I planned the next step", "I only reviewed it", "I left it"],
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
    _q("intern-today-b", "Did internship / work feature today?",
       ["I worked a shift", "I sent an application", "I prepped for an interview", "Not today"],
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
    _q("club-today-b", "Any extra-curricular time today?",
       ["Club", "Sport", "An event", "None"],
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
    _q("day-energy-b", "How did you feel physically today?",
       ["Drained", "Okay", "Steady", "Really good"],
       ANY, category="wellbeing"),
    _q("day-win", "What was your biggest academic win today?",
       ["Finished a tough topic", "Stayed consistent", "Submitted work", "Rested when I needed to"],
       ANY, category="wellbeing"),
    _q("day-win-b", "What are you glad you did today?",
       ["Pushed through a hard topic", "Kept a routine", "Got work in", "Took a proper break"],
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
    _q(
        "career-clarity",
        "How confident are you this week about your career direction?",
        ["Poor", "Fair", "Good", "Strong"],
        ANY,
        category="career",
        stage="weekly_career_clarity",
        context_field="careerClarity",
    ),
]


QUESTION_BY_ID = {q["id"]: q for q in QUESTION_BANK}


def get_question(question_id: str) -> Optional[dict[str, Any]]:
    if not question_id:
        return None
    try:
        from app.models.journal.question import QuestionModel

        doc = QuestionModel.find_by_qid(question_id)
        if doc:
            return doc
    except Exception:
        pass
    found = QUESTION_BY_ID.get(question_id)
    return dict(found) if found else None


def get_questions(question_ids: list[str]) -> list[dict[str, Any]]:
    ids = [qid for qid in question_ids or [] if qid]
    if not ids:
        return []
    found: dict[str, dict[str, Any]] = {}
    try:
        from app.models.journal.question import QuestionModel

        for doc in QuestionModel.find_by_qids(ids):
            if doc and doc.get("id"):
                found[doc["id"]] = doc
    except Exception:
        pass
    result = []
    for qid in ids:
        doc = found.get(qid) or QUESTION_BY_ID.get(qid)
        if doc:
            result.append(dict(doc))
    return result


def pad_options(options: Optional[list[str]]) -> Optional[list[str]]:
    if not options:
        return None
    padded = list(options)
    while len(padded) < 4:
        padded.append(padded[-1])
    return padded[:4]
