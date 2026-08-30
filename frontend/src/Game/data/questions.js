// Question data model + generation layer.
//
// Question shape:
// {
//   id, questionText, answers, answerType, category,
//   requiresSpecialInteraction, interactionType, targetLocation, status
// }

import { ASSIGNMENT_STATUS, isMarkReviewDue, needsDeadline } from "./assignments";
import { getBuildingForInteraction, getFacultyForSubject } from "./buildings";
import { pendingExams, examsNeedingMark } from "./exams";

export const ACTIVITY_TO_CATEGORY = {
  academic_study: "attendance",
  assignment_work: "academic",
  exam_preparation: "academic",
  lab_practical: "academic",
  quiz_work: "academic",
  project_development: "activity",
  internship: "activity",
  club_participation: "wellbeing",
  event_participation: "wellbeing",
  sports: "wellbeing",
  other: "wellbeing",
  attendance: "attendance",
  academic: "academic",
  wellbeing: "wellbeing",
  activity: "activity",
};

export const NORMAL_QUESTION_POOL = [
  {
    id: "q-lecture",
    questionText: "Did you attend a lecture today?",
    answers: ["Yes, all of them", "Yes, some of them", "No, I self-studied", "No, I skipped"],
    answerType: "choice",
    category: "attendance",
  },
  {
    id: "q-assignment-work",
    questionText: "Did you work on an assignment today?",
    answers: ["Yes, made good progress", "Yes, a little", "Planned only", "Not today"],
    answerType: "choice",
    category: "academic",
  },
  {
    id: "q-main-activity",
    questionText: "What did you mainly work on today?",
    answers: ["Assignment", "Lecture", "Internship", "Personal Project"],
    answerType: "choice",
    category: "activity",
  },
  {
    id: "q-extracurricular",
    questionText: "Did you take part in an extracurricular activity?",
    answers: ["Yes, a club", "Yes, sport", "Yes, an event", "Not today"],
    answerType: "choice",
    category: "wellbeing",
  },
  {
    id: "q-exam-study",
    questionText: "Did you study for an examination today?",
    answers: ["Yes, a full session", "Yes, a short review", "Only planned it", "Not today"],
    answerType: "choice",
    category: "academic",
  },
  {
    id: "q-mood",
    questionText: "How was your energy level today?",
    answers: ["Low", "Okay", "Good", "Great"],
    answerType: "choice",
    category: "wellbeing",
  },
];

// Build a fresh, structured question object.
function makeQuestion(base, overrides = {}) {
  return {
    id: base.id,
    questionText: base.questionText,
    answers: base.answers ?? null,
    answerType: base.answerType,
    category: base.category,
    requiresSpecialInteraction: false,
    interactionType: null,
    targetLocation: null,
    status: "pending",
    ...overrides,
  };
}

/**
 * Inspect the current journal/assignment data state and decide which
 * "special interaction" questions are actually due today.
 * This is what keeps RULE 4-8 true: nothing is asked just because a
 * building exists, and nothing already-collected gets asked again.
 */
function generateSpecialQuestions(assignments, exams = [], today = new Date()) {
  const special = [];

  const dueMarks = [];
  for (const assignment of assignments) {
    if (needsDeadline(assignment)) {
      special.push(
        makeQuestion(
          {
            id: `q-deadline-check-${assignment.id}`,
            questionText: `Has the deadline for ${assignment.subject} been given?`,
            answers: ["Yes", "Not yet", "Only a tentative date", "I need to check"],
            answerType: "choice",
            category: "assignment",
          },
          {
            requiresSpecialInteraction: false,
            interactionType: "date",
            targetLocation: getBuildingForInteraction("date").id,
            context: { assignmentId: assignment.id, field: "deadline-check", subject: assignment.subject },
          }
        )
      );
      continue;
    }

    if (isMarkReviewDue(assignment, today)) {
      dueMarks.push(assignment);
    }
  }

  if (dueMarks.length > 1) {
    special.push(
      makeQuestion(
        {
          id: "q-asg-mark-pick",
          questionText: "Which assignment do you want to log a mark for?",
          answerType: "choice",
          category: "assignment",
        },
        {
          requiresSpecialInteraction: true,
          interactionType: "markTarget",
          targetLocation: getFacultyForSubject(dueMarks[0].subject),
          context: {
            field: "assignmentMarkSubject",
            subjectOptions: dueMarks.map((item) => item.subject).filter(Boolean),
          },
        }
      )
    );
  } else if (dueMarks.length === 1) {
    const assignment = dueMarks[0];
    special.push(
      makeQuestion(
        {
          id: `q-mark-check-${assignment.id}-${assignment.lastMarkCheckDate ?? "first"}`,
          questionText: `Have you received the mark for ${assignment.subject}?`,
          answers: ["Yes", "Not yet"],
          answerType: "choice",
          category: "assignment",
        },
        {
          requiresSpecialInteraction: false,
          interactionType: "marks",
          targetLocation: getFacultyForSubject(assignment.subject),
          context: { assignmentId: assignment.id, field: "mark-check", subject: assignment.subject },
        }
      )
    );
  }

  const stillPending = pendingExams(exams);
  if (stillPending.length > 0) {
    const labels = stillPending.map((exam) => {
      const kind = String(exam.examType || exam.exam_type || "exam").replace(/^\w/, (c) => c.toUpperCase());
      return `${exam.subject} · ${kind}`;
    });
    special.push(
      makeQuestion(
        {
          id: `q-exam-dates-check-${stillPending.map((e) => e.id).join("-")}`,
          questionText:
            labels.length === 1
              ? `Have ${labels[0]} dates been released?`
              : `Have exam dates been released for ${labels.join(", ")}?`,
          answers: ["Yes", "Not yet", "Only some of them", "I need to check"],
          answerType: "choice",
          category: "exam",
        },
        {
          requiresSpecialInteraction: false,
          interactionType: "examDate",
          targetLocation: "exam-hall",
          context: { field: "exam-dates-check", missingExams: stillPending },
        }
      )
    );
  }

  const needMarks = examsNeedingMark(exams, today);
  if (needMarks.length > 1) {
    special.push(
      makeQuestion(
        {
          id: `q-exam-mark-pick-${needMarks.map((item) => item.id).join("-")}`,
          questionText: "Which exam result do you want to log?",
          answerType: "choice",
          category: "exam",
        },
        {
          requiresSpecialInteraction: true,
          interactionType: "markTarget",
          targetLocation: "exam-hall",
          context: { field: "examMarkSubject", missingExams: needMarks },
        }
      )
    );
  } else if (needMarks.length === 1) {
    const exam = needMarks[0];
    const kind = String(exam.examType || exam.exam_type || "exam").replace(/^\w/, (c) => c.toUpperCase());
    special.push(
      makeQuestion(
        {
          id: `q-exam-mark-check-${exam.id}`,
          questionText: `Have you received a mark for ${exam.subject} · ${kind}?`,
          answers: ["Yes", "Not yet"],
          answerType: "choice",
          category: "exam",
        },
        {
          requiresSpecialInteraction: false,
          interactionType: "marks",
          targetLocation: "exam-hall",
          context: { field: "exam-mark-check", missingExams: [exam], subject: exam.subject },
        }
      )
    );
  }

  return special;
}

/**
 * Build today's full question queue: a handful of normal questions
 * interleaved with any special-interaction questions currently due.
 * Zero special questions is a perfectly valid, expected result.
 */
export function generateDailyQuestions({
  assignments,
  exams = [],
  questionCount = 4,
  today = new Date(),
  preferredCategories = [],
}) {
  const preferredKeys = preferredCategories.map((k) => ACTIVITY_TO_CATEGORY[k] || k);
  const shuffled = [...NORMAL_QUESTION_POOL].sort(() => Math.random() - 0.5);
  const preferred = shuffled.filter((q) => preferredKeys.includes(q.category));
  const rest = shuffled.filter((q) => !preferredKeys.includes(q.category));
  const shuffledNormal = [...preferred, ...rest]
    .slice(0, questionCount)
    .map((q) => makeQuestion(q));

  const specials = generateSpecialQuestions(assignments, exams, today);

  // Interleave: normal, normal, [special if any], normal...
  const queue = [];
  let specialIdx = 0;
  shuffledNormal.forEach((q, i) => {
    queue.push(q);
    if (i === 1 && specialIdx < specials.length) {
      queue.push(specials[specialIdx++]);
    }
  });
  while (specialIdx < specials.length) queue.push(specials[specialIdx++]);

  return queue;
}

/**
 * Yes on a date/mark gate should open the building mini-game.
 * "Not yet" leaves the saved date/mark null and asks again another week.
 * After a Yes on a multi-exam mark gate, the next question is a subject pick — do not escalate yet.
 */
function isAffirmative(answerValue) {
  return (
    answerValue === "Yes" ||
    answerValue === "Only some of them" ||
    answerValue === "Only some subjects" ||
    answerValue === "I need to check" ||
    answerValue === "Only a tentative date" ||
    answerValue === "Partial results only" ||
    answerValue === "Partial feedback only"
  );
}

export function shouldEscalateToSpecialEntry(question, answerValue) {
  const field = question?.context?.field;
  if (!isAffirmative(answerValue)) return false;
  if (field === "deadline-check") {
    return (
      answerValue === "Yes" ||
      answerValue === "Only a tentative date" ||
      answerValue === "I need to check"
    );
  }
  if (field === "exam-dates-check") return true;
  if (field === "mark-check") {
    const options = question?.context?.subjectOptions || [];
    if (options.length > 1 && !question?.subject && !question?.context?.subject) return false;
    return answerValue === "Yes" || answerValue === "Partial feedback only";
  }
  if (field === "exam-mark-check") {
    const remaining = question?.context?.missingExams?.length || 0;
    if (remaining > 1) return false;
    return answerValue === "Yes" || answerValue === "Only some subjects" || answerValue === "Partial results only";
  }
  return false;
}

export const shouldEscalateToMarkEntry = shouldEscalateToSpecialEntry;
