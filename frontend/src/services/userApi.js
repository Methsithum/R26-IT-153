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

export async function ensureGuestUser(name = "Alex") {
  const existing = readStoredUser();
  if (existing?.id) {
    try {
      const { data } = await api.get(`/users/${existing.id}`);
      return storeUser(data);
    } catch {
      // stale id — fall through and recreate
    }
  }

  const stamp = existing?.email || `alex.${Date.now()}@smartuniguide.app`;
  const { data } = await api.post("/users/ensure", { email: stamp, name });
  return storeUser(data);
}

export async function getUserSessions(userId) {
  const { data } = await api.get(`/users/${userId}/sessions`);
  return data.sessions || [];
}

export async function getUserGamification(userId) {
  const { data } = await api.get(`/users/${userId}/gamification`);
  return data;
}
