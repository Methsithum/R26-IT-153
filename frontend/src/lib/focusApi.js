import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "";
const USER_KEY = "sug_focus_user_id";

export function getFocusUserId() {
  try {
    let id = localStorage.getItem(USER_KEY);
    if (!id) {
      id = (crypto.randomUUID && crypto.randomUUID()) || `user-${Date.now()}`;
      localStorage.setItem(USER_KEY, id);
    }
    return id;
  } catch {
    return "anonymous";
  }
}

function withUser(params = {}) {
  return { user_id: getFocusUserId(), ...params };
}

export async function predictFocusState(base64Image) {
  const { data } = await axios.post(`${API_BASE}/focus/predict`, {
    image: base64Image,
  });
  return data;
}

export async function saveFocusSession(payload) {
  const { data } = await axios.post(`${API_BASE}/focus/sessions`, {
    ...payload,
    user_id: payload.user_id || getFocusUserId(),
  });
  return data;
}

export async function getDailyReport(date) {
  const { data } = await axios.get(`${API_BASE}/focus/reports/daily`, {
    params: withUser(date ? { date } : {}),
  });
  return data;
}

export async function getWeeklyReport() {
  const { data } = await axios.get(`${API_BASE}/focus/reports/weekly`, {
    params: withUser(),
  });
  return data;
}

export async function getFocusProfile() {
  const { data } = await axios.get(`${API_BASE}/focus/profile`, {
    params: withUser(),
  });
  return data;
}

export async function getLeaderboard() {
  const { data } = await axios.get(`${API_BASE}/focus/leaderboard`, {
    params: withUser(),
  });
  return data;
}

export async function getEmotionalStats() {
  const { data } = await axios.get(`${API_BASE}/focus/emotional`, {
    params: withUser(),
  });
  return data;
}

/** Best-effort flush on tab close. Periodic save is the reliable path. */
export function flushFocusSession(payload) {
  try {
    navigator.sendBeacon(
      `${API_BASE}/focus/sessions`,
      new Blob([JSON.stringify({ ...payload, user_id: getFocusUserId() })], {
        type: "application/json",
      }),
    );
  } catch {
    // ignore
  }
}
