import axios from "axios";
import { authHeaders, withAuth } from "../services/apiClient";
import { readStoredUser } from "../services/userApi";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const USER_KEY = "sug_focus_user_id";

const client = axios.create();
client.interceptors.request.use(withAuth);

export function getFocusUserId() {
  const id = readStoredUser()?.id;
  return id ? String(id) : "anonymous";
}

function withUser(params = {}) {
  return { user_id: getFocusUserId(), ...params };
}

export async function predictFocusState(base64Image) {
  const { data } = await client.post(`${API_BASE}/focus/predict`, {
    image: base64Image,
  });
  return data;
}

export async function saveFocusSession(payload) {
  const { data } = await client.post(`${API_BASE}/focus/sessions`, {
    ...payload,
    user_id: getFocusUserId(),
  });
  return data;
}

export async function getDailyReport(date) {
  const { data } = await client.get(`${API_BASE}/focus/reports/daily`, {
    params: withUser(date ? { date } : {}),
  });
  return data;
}

export async function getWeeklyReport() {
  const { data } = await client.get(`${API_BASE}/focus/reports/weekly`, {
    params: withUser(),
  });
  return data;
}

export async function getFocusProfile() {
  const { data } = await client.get(`${API_BASE}/focus/profile`, {
    params: withUser(),
  });
  return data;
}

export async function getLeaderboard(period = "daily", month = null) {
  const { data } = await client.get(`${API_BASE}/focus/leaderboard`, {
    params: withUser(month ? { period, month } : { period }),
  });
  return data;
}

export async function getEmotionalStats() {
  const { data } = await client.get(`${API_BASE}/focus/emotional`, {
    params: withUser(),
  });
  return data;
}

export async function pingFocusPresence() {
  const uid = getFocusUserId();
  if (!uid || uid === "anonymous") return;
  await client.post(`${API_BASE}/focus/presence`, null, { params: { user_id: uid } });
}

export function leaveFocusPresence() {
  const uid = getFocusUserId();
  if (!uid || uid === "anonymous") return;
  try {
    // keepalive fetch instead of sendBeacon: a beacon can't carry the Authorization header.
    fetch(`${API_BASE}/focus/presence/leave?user_id=${encodeURIComponent(uid)}`, {
      method: "POST",
      keepalive: true,
      headers: authHeaders(),
    });
  } catch {
    return;
  }
}

export function flushFocusSession(payload) {
  try {
    fetch(`${API_BASE}/focus/sessions`, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ ...payload, user_id: getFocusUserId() }),
    });
  } catch {
    return;
  }
}
