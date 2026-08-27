import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export async function predictFocusState(base64Image) {
  const { data } = await axios.post(`${API_BASE}/focus/predict`, {
    image: base64Image,
  });
  return data; // { face_detected, state, confidence, probs }
}

export async function saveFocusSession(payload) {
  const { data } = await axios.post(`${API_BASE}/focus/sessions`, payload);
  return data;
}

export async function getDailyReport(date) {
  const { data } = await axios.get(`${API_BASE}/focus/reports/daily`, {
    params: date ? { date } : undefined,
  });
  return data;
}

export async function getWeeklyReport() {
  const { data } = await axios.get(`${API_BASE}/focus/reports/weekly`);
  return data;
}

export async function getFocusProfile() {
  const { data } = await axios.get(`${API_BASE}/focus/profile`);
  return data;
}

export async function getLeaderboard() {
  const { data } = await axios.get(`${API_BASE}/focus/leaderboard`);
  return data;
}

/** Best-effort flush on tab close. Periodic save is the reliable path. */
export function flushFocusSession(payload) {
  try {
    navigator.sendBeacon(
      `${API_BASE}/focus/sessions`,
      new Blob([JSON.stringify(payload)], { type: "application/json" }),
    );
  } catch {
    // ignore
  }
}
