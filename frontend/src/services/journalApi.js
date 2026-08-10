import api from './apiClient';

export async function getTodayJournal(userId) {
  const { data } = await api.get(`/daily/user/${userId}`);
  const sessions = data?.sessions || [];
  const today = new Date().toDateString();
  const todaySession = sessions.find((s) => {
    const d = s.date ? new Date(s.date).toDateString() : null;
    return d === today && s.completed;
  });
  return todaySession || null;
}

export async function getJournalHistory(userId) {
  const { data } = await api.get(`/daily/user/${userId}`);
  return (data?.sessions || [])
    .filter((s) => s.completed && s.journal_entry)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

export async function getWeeklyReflections(userId) {
  const { data } = await api.get(`/reflection/weekly/${userId}`);
  return data?.reflections || [];
}

export async function getSemesterReflections(userId) {
  const { data } = await api.get(`/reflection/semester/${userId}`);
  return data?.reflections || [];
}

export async function submitWeeklyReflection(payload) {
  const { data } = await api.post('/reflection/weekly', payload);
  return data;
}

export async function submitSemesterReflection(payload) {
  const { data } = await api.post('/reflection/semester', payload);
  return data;
}
