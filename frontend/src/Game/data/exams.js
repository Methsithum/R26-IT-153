// Exam date tracking — mirrors assignments.js but for upcoming exams.
// Feeds the Exam Hall's "Calendar Sort" special interaction: whenever any
// exam is missing a confirmed date, that becomes the trigger.

export const EXAM_STATUS = {
  PENDING: "PENDING",
  DATE_RECORDED: "DATE_RECORDED",
  MARK_RECEIVED: "MARK_RECEIVED",
};

export const initialExams = [
  { id: "exam-db", subject: "Databases", examType: "mid", status: EXAM_STATUS.PENDING, date: null, mark: null },
  { id: "exam-os", subject: "Operating Systems", examType: "final", status: EXAM_STATUS.PENDING, date: null, mark: null },
  { id: "exam-web", subject: "Web Development", examType: "mid", status: EXAM_STATUS.DATE_RECORDED, date: "2026-09-05", mark: null },
];

export function pendingExams(exams) {
  return exams.filter((e) => e.status === EXAM_STATUS.PENDING || !e.date);
}

export function examsNeedingMark(exams, today = new Date()) {
  const todayKey = today.toISOString().slice(0, 10);
  return exams.filter((e) => {
    if (e.mark != null && e.mark !== "") return false;
    if (e.status === EXAM_STATUS.MARK_RECEIVED) return false;
    if (!e.date) return false;
    if (String(e.date).slice(0, 10) > todayKey) return false;
    const lastCheck = e.lastMarkCheckDate || e.last_mark_check;
    if (!lastCheck) return true;
    const last = new Date(lastCheck);
    const diffDays = (today - last) / (1000 * 60 * 60 * 24);
    return diffDays >= (e.markCheckFrequencyDays || 7);
  });
}
