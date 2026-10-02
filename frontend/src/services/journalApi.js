import api from "./apiClient";
import { localTodayIso, campusDateKey } from "./localDate";

export async function abandonDailySession(userId, sessionId) {
  const { data } = await api.post("/daily/abandon", {
    user_id: userId,
    session_id: sessionId,
  });
  return data;
}

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

export async function fetchGamificationSummary(userId) {
  const { data } = await api.get(`/gamification/${userId}`);
  return data;
}

export async function analyzeBehavior(userId) {
  const { data } = await api.post("/behavior/analyze", { user_id: userId });
  return data;
}

export async function fetchStudyInsights(userId) {
  const { data } = await api.get(`/analytics/insights/${userId}`);
  return data;
}

export async function fetchDataQuality(userId) {
  const { data } = await api.get(`/analytics/data-quality/${userId}`);
  return data;
}

export async function fetchAlertRuleCatalog() {
  const { data } = await api.get("/analytics/alert-rules");
  return data;
}

export async function fetchAlertRulesForUser(userId) {
  const { data } = await api.get(`/analytics/alert-rules/${userId}`);
  return data;
}

export async function fetchQuestionBank({ category, activity } = {}) {
  const { data } = await api.get("/analytics/question-bank", {
    params: { category: category || undefined, activity: activity || undefined },
  });
  return data;
}

export async function simulateGamification(payload) {
  const { data } = await api.post("/analytics/gamification-simulator", payload);
  return data;
}
