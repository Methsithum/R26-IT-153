// Question data model + generation layer.
//
// Question shape:
// {
//   id, questionText, answers, answerType, category,
//   requiresSpecialInteraction, interactionType, targetLocation, status
// }

import { ASSIGNMENT_STATUS, isMarkReviewDue, needsDeadline } from "./assignments";
import { getBuildingForInteraction, getFacultyForSubject } from "./buildings";
import { pendingExams } from "./exams";

export const NORMAL_QUESTION_POOL = [
  {
    id: "q-lecture",
    questionText: "Did you attend a lecture today?",
    answers: ["Yes", "No"],
    answerType: "choice",
    category: "attendance",
  },
  {
    id: "q-assignment-work",
    questionText: "Did you work on an assignment today?",
    answers: ["Yes", "No"],
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
    answers: ["Yes", "No"],
    answerType: "choice",
    category: "wellbeing",
  },
  {
    id: "q-exam-study",
    questionText: "Did you study for an examination today?",
    answers: ["Yes", "No"],
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

  for (const assignment of assignments) {
    if (needsDeadline(assignment)) {
      special.push(
        makeQuestion(
          {
            id: `q-deadline-${assignment.id}`,
            questionText: `When is the deadline for "${assignment.title}"?`,
            answerType: "date",
            category: "assignment",
          },
          {
            requiresSpecialInteraction: true,
            interactionType: "date",
            targetLocation: getBuildingForInteraction("date").id,
            context: { assignmentId: assignment.id, field: "deadline" },
          }
        )
      );
      continue;
    }

    if (isMarkReviewDue(assignment, today)) {
      special.push(
        makeQuestion(
          {
            id: `q-mark-check-${assignment.id}-${assignment.lastMarkCheckDate ?? "first"}`,
            questionText: `Have you received the mark for "${assignment.title}"?`,
            answers: ["Yes", "Not yet"],
            answerType: "choice",
            category: "assignment",
          },
          {
            // First a simple yes/no lane question — only escalates to the
            // structured numeric interaction if the answer is "Yes".
            requiresSpecialInteraction: false,
            interactionType: "marks",
            targetLocation: getFacultyForSubject(assignment.subject),
            context: { assignmentId: assignment.id, field: "mark-check" },
          }
        )
      );
    }
  }

  const stillPending = pendingExams(exams);
  if (stillPending.length > 0) {
    special.push(
      makeQuestion(
        {
          id: `q-exam-dates-${stillPending.map((e) => e.id).join("-")}`,
          questionText: "You have exam dates that still need to be confirmed.",
          answerType: "date",
          category: "exam",
        },
        {
          requiresSpecialInteraction: true,
          interactionType: "examDate",
          targetLocation: "exam-hall",
          context: { field: "examDates" },
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
  // Bias toward categories implied by the student's Daily Activity
  // Selection, without ever excluding the rest of the pool.
  const shuffled = [...NORMAL_QUESTION_POOL].sort(() => Math.random() - 0.5);
  const preferred = shuffled.filter((q) => preferredCategories.includes(q.category));
  const rest = shuffled.filter((q) => !preferredCategories.includes(q.category));
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
 * Given a mark-check question's answer, decide whether the numeric
 * special interaction (entering a building to key in the actual mark)
 * should now trigger.
 */
export function shouldEscalateToMarkEntry(question, answerValue) {
  return question.context?.field === "mark-check" && answerValue === "Yes";
}
