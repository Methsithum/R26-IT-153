import axios from "axios";
import { readStoredUser } from "../services/userApi";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const USER_KEY = "sug_focus_user_id";

/** Logged-in Mongo user id (`smart-uni-guide-user`), same as journal/planner. */
export function getFocusUserId() {
  const id = readStoredUser()?.id;
  return id ? String(id) : "anonymous";
}

function withUser(params = {}) {
  return { user_id: getFocusUserId(), ...params };
}

// FOCUS GUIDE: Send a webcam image to POST /focus/predict.
export async function predictFocusState(base64Image) {
  const { data } = await axios.post(`${API_BASE}/focus/predict`, {
    image: base64Image,
  });
  return data;
}

// FOCUS GUIDE: Save the logged-in student's cumulative daily summary.
export async function saveFocusSession(payload) {
  const { data } = await axios.post(`${API_BASE}/focus/sessions`, {
    ...payload,
    user_id: getFocusUserId(),
  });
  return data;
}

// FOCUS GUIDE: Fetch saved daily and weekly summaries for the Focus screens.
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

export async function getLeaderboard(period = "daily", month = null) {
  const { data } = await axios.get(`${API_BASE}/focus/leaderboard`, {
    params: withUser(month ? { period, month } : { period }),
  });
  return data;
}

export async function getEmotionalStats() {
  const { data } = await axios.get(`${API_BASE}/focus/emotional`, {
    params: withUser(),
  });
  return data;
}

export async function pingFocusPresence() {
  const uid = getFocusUserId();
  if (!uid || uid === "anonymous") return;
  await axios.post(`${API_BASE}/focus/presence`, null, { params: { user_id: uid } });
}

export function leaveFocusPresence() {
  const uid = getFocusUserId();
  if (!uid || uid === "anonymous") return;
  try {
    navigator.sendBeacon(`${API_BASE}/focus/presence/leave?user_id=${encodeURIComponent(uid)}`);
  } catch {
    // ignore
  }
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
