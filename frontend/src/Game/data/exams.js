// Exam date tracking — mirrors assignments.js but for upcoming exams.
// Feeds the Exam Hall's "Calendar Sort" special interaction: whenever any
// exam is missing a confirmed date, that becomes the trigger.

export const EXAM_STATUS = {
  PENDING: "PENDING",
  DATE_RECORDED: "DATE_RECORDED",
};

export const initialExams = [
  { id: "exam-db", subject: "Databases", status: EXAM_STATUS.PENDING, date: null },
  { id: "exam-os", subject: "Operating Systems", status: EXAM_STATUS.PENDING, date: null },
  { id: "exam-web", subject: "Web Development", status: EXAM_STATUS.DATE_RECORDED, date: "2026-09-05" },
];

export function pendingExams(exams) {
  return exams.filter((e) => e.status === EXAM_STATUS.PENDING);
}
