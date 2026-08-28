import { daysRemaining, formatDeadlineCopy } from "./dateHelpers";

// Builds real notifications from the student's actual assignments/exams/
// modules — upcoming deadlines, missed tasks, upcoming exams, and a gentle
// nudge for any module with a real (not placeholder) low grade. Replaces
// the old static MOCK_NOTIFICATIONS list, which referenced fictional
// modules/tasks that no longer exist once real journal data is synced.
export function buildNotificationsFromRealData({ assignments = [], exams = [], modules = [] }) {
  const notifications = [];

  assignments.forEach((a) => {
    if (a.status === "pending") {
      const days = daysRemaining(a.deadlineDate);
      if (days >= 0 && days <= 3) {
        notifications.push({
          id: `deadline-${a.taskId}`,
          type: "deadline",
          title: `${a.title} — ${formatDeadlineCopy(a.deadlineDate).toLowerCase()}`,
          body: a.moduleName,
        });
      }
    } else if (a.status === "missed") {
      notifications.push({
        id: `missed-${a.taskId}`,
        type: "missed",
        title: "Missed study session",
        body: `${a.moduleName} — "${a.title}" wasn't completed by its deadline. Tap to review.`,
      });
    }
  });

  exams.forEach((e) => {
    const days = daysRemaining(e.date);
    if (days >= 0 && days <= 7) {
      notifications.push({
        id: `exam-${e.id}`,
        type: "deadline",
        title: `${e.type} — ${formatDeadlineCopy(e.date).toLowerCase()}`,
        body: e.moduleName,
      });
    }
  });

  modules
    .filter((m) => m.hasGradeData !== false && m.currentGrade < 70)
    .slice(0, 2)
    .forEach((m) => {
      notifications.push({
        id: `recommendation-${m.code}`,
        type: "recommendation",
        title: `Study recommendation for ${m.name}`,
        body: `Currently at ${m.currentGrade}% — a little extra focus here could help. Not a judgment, just a nudge.`,
      });
    });

  return notifications;
}
