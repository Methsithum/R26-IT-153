import api from "./apiClient";

export async function fetchReflectionStatus(userId, date) {
  const { data } = await api.get(`/reflection/status/${userId}`, {
    params: date ? { date } : undefined,
  });
  return data;
}

export async function fetchWeeklyReflections(userId) {
  const { data } = await api.get(`/reflection/weekly/${userId}`);
  return data.reflections || [];
}

export async function submitWeeklyReflection({ userId, weekStart, weekEnd }) {
  const { data } = await api.post(
    "/reflection/weekly",
    {
      user_id: userId,
      week_start: `${weekStart}T00:00:00`,
      week_end: `${weekEnd}T00:00:00`,
    },
    { timeout: 60000 }
  );
  return data;
}
