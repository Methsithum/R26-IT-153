import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  try {
    const user = JSON.parse(localStorage.getItem("smart-uni-guide-user") || "null");
    if (user?.access_token) config.headers.Authorization = `Bearer ${user.access_token}`;
  } catch {
    // Missing or invalid saved state is handled by the authenticated API.
  }
  return config;
});

export default api;
