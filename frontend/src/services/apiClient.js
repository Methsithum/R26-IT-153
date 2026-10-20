import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  timeout: 30000,
});

/** Bearer header for the signed-in user, or {} - shared by every module's API client. */
export function authHeaders() {
  try {
    const user = JSON.parse(localStorage.getItem("smart-uni-guide-user") || "null");
    if (user?.access_token) return { Authorization: `Bearer ${user.access_token}` };
  } catch {
    // Missing or invalid saved state is handled by the authenticated API.
  }
  return {};
}

export function withAuth(config) {
  Object.assign(config.headers, authHeaders());
  return config;
}

api.interceptors.request.use(withAuth);

export default api;
