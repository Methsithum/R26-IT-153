// Assignment / structured-data journal state.
// This models the "data state" the question-generation layer reads before
// deciding whether a special interaction is actually required.

export const ASSIGNMENT_STATUS = {
  NEW: "NEW",
  DEADLINE_RECORDED: "DEADLINE_RECORDED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  MARK_PENDING: "MARK_PENDING",
  MARK_RECEIVED: "MARK_RECEIVED",
};

// Seed data — in a real app this would come from the backend journal store.
export const initialAssignments = [
  {
    id: "asg-db-01",
    title: "Database Assignment 01",
    subject: "Databases",
    status: ASSIGNMENT_STATUS.MARK_PENDING,
    deadline: "2026-08-20",
    mark: null,
    lastMarkCheckDate: "2026-08-10",
    markCheckFrequencyDays: 7,
  },
  {
    id: "asg-os-02",
    title: "OS Lab Report 02",
    subject: "Operating Systems",
    status: ASSIGNMENT_STATUS.NEW,
    deadline: null,
    mark: null,
    lastMarkCheckDate: null,
    markCheckFrequencyDays: 7,
  },
  {
    id: "asg-web-01",
    title: "Web Dev Project",
    subject: "Web Development",
    status: ASSIGNMENT_STATUS.IN_PROGRESS,
    deadline: "2026-08-25",
    mark: null,
    lastMarkCheckDate: null,
    markCheckFrequencyDays: 14,
  },
];

// Should we periodically re-ask about this assignment's mark?
export function isMarkReviewDue(assignment, today = new Date()) {
  if (assignment.status !== ASSIGNMENT_STATUS.MARK_PENDING) return false;
  if (!assignment.lastMarkCheckDate) return true;
  const last = new Date(assignment.lastMarkCheckDate);
  const diffDays = (today - last) / (1000 * 60 * 60 * 24);
  return diffDays >= assignment.markCheckFrequencyDays;
}

export function needsDeadline(assignment) {
  return assignment.status === ASSIGNMENT_STATUS.NEW && !assignment.deadline;
}
