import api from "./apiClient";
import { localTodayIso, campusDateKey } from "./localDate";

export async function startDailySession({
  userId,
  date = `${localTodayIso()}T00:00:00`,
  selectedActivities,
  lectureSubjects = [],
  assignmentSubjects = [],
  examSubjects = [],
  examKinds = [],
}) {
  const { data } = await api.post("/daily/start", {
    user_id: userId,
    date,
    selected_activities: selectedActivities,
    lecture_subjects: lectureSubjects,
    assignment_subjects: assignmentSubjects,
    exam_subjects: examSubjects,
    exam_kinds: examKinds,
  });
  return data;
}

export async function submitDailyAnswer(sessionId, answer) {
  const { data } = await api.post("/daily/answer", {
    session_id: sessionId,
    answer,
  });
  return data;
}

export async function deleteTodayJournal(userId, date = localTodayIso()) {
  const { data } = await api.delete(`/daily/today/${userId}`, {
    params: { date: campusDateKey(date) || localTodayIso() },
  });
  return data;
}

export async function finishDailyRun({ sessionId, xpEarned, score }) {
  const { data } = await api.post("/daily/finish", {
    session_id: sessionId,
    xp_earned: xpEarned,
    score,
  });
  return data;
}
