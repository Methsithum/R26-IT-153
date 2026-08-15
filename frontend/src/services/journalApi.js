import api from "./apiClient";

export async function startDailySession({
  userId,
  date = new Date().toISOString(),
  selectedActivities,
}) {
  const { data } = await api.post("/daily/start", {
    user_id: userId,
    date,
    selected_activities: selectedActivities,
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
