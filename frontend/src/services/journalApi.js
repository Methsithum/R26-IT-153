import api from "./apiClient";
import { localTodayIso, campusDateKey } from "./localDate";
import { apiErrorMessage } from "./userApi";

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

export async function fetchLeaderboard(limit = 10) {
  const { data } = await api.get("/leaderboard", { params: { limit } });
  return data;
}

export async function analyzeBehavior(userId) {
  const { data } = await api.post("/behavior/analyze", { user_id: userId });
  return data;
}

// --- Assessment score prediction ("Score Forecast" tab) ---

export function mapPredictionApiError(err) {
  if (err?.response?.status === 503) {
    return new Error("The prediction model is currently unavailable");
  }
  if (!err?.response) {
    return new Error("Network error — please try again.");
  }
  return new Error(apiErrorMessage(err, "Something went wrong."));
}

export async function getUpcomingAssessments(userId) {
  try {
    const { data } = await api.get(`/assessment-prediction/upcoming/${userId}`);
    return data;
  } catch (err) {
    throw mapPredictionApiError(err);
  }
}

export async function predictAssessment(payload) {
  try {
    const { data } = await api.post("/assessment-prediction/predict", payload);
    return data;
  } catch (err) {
    throw mapPredictionApiError(err);
  }
}

export async function getPredictionHistory(userId, limit = 20) {
  try {
    const { data } = await api.get(`/assessment-prediction/history/${userId}`, { params: { limit } });
    return data;
  } catch (err) {
    throw mapPredictionApiError(err);
  }
}
