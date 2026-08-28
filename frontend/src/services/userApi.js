import api from "./apiClient";

const STORAGE_KEY = "smart-uni-guide-user";

export function readStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function storeUser(user) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  return user;
}

export function clearStoredUser() {
  localStorage.removeItem(STORAGE_KEY);
}

export function apiErrorMessage(err, fallback = "Something went wrong") {
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg || item.message || String(item)).join(" · ");
  }
  return err?.message || fallback;
}

export async function registerUser(payload) {
  const { data } = await api.post("/users/register", payload);
  return storeUser(data);
}

export async function loginUser(email, password) {
  const { data } = await api.post("/users/login", { email, password });
  return storeUser(data);
}

export async function refreshStoredUser() {
  const existing = readStoredUser();
  if (!existing?.id) return null;
  try {
    const { data } = await api.get(`/users/${existing.id}`);
    return storeUser(data);
  } catch (err) {
    if (err?.response?.status === 404) {
      clearStoredUser();
      return null;
    }
    throw err;
  }
}

export async function getUserSessions(userId) {
  const { data } = await api.get(`/users/${userId}/sessions`);
  return data.sessions || [];
}

export async function getUserTasks(userId) {
  const { data } = await api.get(`/users/${userId}/tasks`);
  return data.tasks || [];
}

export async function getUserExams(userId) {
  const { data } = await api.get(`/users/${userId}/exams`);
  return data.exams || [];
}

export async function getUserGamification(userId) {
  const { data } = await api.get(`/users/${userId}/gamification`);
  return data;
}

export async function loadUserWorld(userId) {
  const [sessions, tasks, exams] = await Promise.all([
    getUserSessions(userId),
    getUserTasks(userId),
    getUserExams(userId),
  ]);
  return { sessions, tasks, exams };
}
