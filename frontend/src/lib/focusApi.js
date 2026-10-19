import axios from "axios";
import { readStoredUser } from "../services/userApi";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const USER_KEY = "sug_focus_user_id";

/** Logged-in Mongo user id (`smart-uni-guide-user`), same as journal/planner. */
// VIVA SI: Login වූ studentගේ ID එක ගනී; නැත්නම් anonymous භාවිත කරයි.
export function getFocusUserId() {
  const id = readStoredUser()?.id;
  return id ? String(id) : "anonymous";
}

function withUser(params = {}) {
  return { user_id: getFocusUserId(), ...params };
}

// VIVA SI: Webcam image එක POST /focus/predict endpoint එකට යවයි; model එක run වන්නේ backend එකේය. | FOCUS GUIDE: Send a webcam image to POST /focus/predict.
export async function predictFocusState(base64Image) {
  const { data } = await axios.post(`${API_BASE}/focus/predict`, {
    image: base64Image,
  });
  return data;
}

// VIVA SI: Logged-in studentගේ දවසේ එකතු වූ summary එක save කිරීමට request යවයි. | FOCUS GUIDE: Save the logged-in student's cumulative daily summary.
export async function saveFocusSession(payload) {
  const { data } = await axios.post(`${API_BASE}/focus/sessions`, {
    ...payload,
    user_id: getFocusUserId(),
  });
  return data;
}

// VIVA SI: Database එකේ save කළ daily report එක ගනී. Weekly report function එකත් පහළ තියෙනවා. | FOCUS GUIDE: Fetch saved daily and weekly summaries for the Focus screens.
export async function getDailyReport(date) {
  const { data } = await axios.get(`${API_BASE}/focus/reports/daily`, {
    params: withUser(date ? { date } : {}),
  });
  return data;
}

// VIVA SI: පසුගිය දින හතේ report එක backend එකෙන් ගනී.
export async function getWeeklyReport() {
  const { data } = await axios.get(`${API_BASE}/focus/reports/weekly`, {
    params: withUser(),
  });
  return data;
}

// VIVA SI: Studentගේ all-time totals සහ unlocked badges ගනී.
export async function getFocusProfile() {
  const { data } = await axios.get(`${API_BASE}/focus/profile`, {
    params: withUser(),
  });
  return data;
}

// VIVA SI: Period සහ month අනුව sorted ranking list එක backend එකෙන් ඉල්ලයි.
export async function getLeaderboard(period = "daily", month = null) {
  const { data } = await axios.get(`${API_BASE}/focus/leaderboard`, {
    params: withUser(month ? { period, month } : { period }),
  });
  return data;
}

// VIVA SI: Backend එකේ derived emotional summary අගයන් ගනී.
export async function getEmotionalStats() {
  const { data } = await axios.get(`${API_BASE}/focus/emotional`, {
    params: withUser(),
  });
  return data;
}

// VIVA SI: Student Focus page එකේ online බව දන්වයි.
export async function pingFocusPresence() {
  const uid = getFocusUserId();
  if (!uid || uid === "anonymous") return;
  await axios.post(`${API_BASE}/focus/presence`, null, { params: { user_id: uid } });
}

// VIVA SI: Page එකෙන් යන විට online presence ඉවත් කරන්න දන්වයි.
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
// VIVA SI: Tab එක වසන විට summary එක යවන්න උත්සාහ කරයි; මෙය guaranteed save එකක් නොවේ.
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
