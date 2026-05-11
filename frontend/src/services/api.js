import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function createUser(payload) {
  const { data } = await api.post('/users/', payload);
  return data;
}

export async function getUser(userId) {
  const { data } = await api.get(`/users/${userId}`);
  return data;
}

export async function getUserGamification(userId) {
  const { data } = await api.get(`/users/${userId}/gamification`);
  return data;
}

export async function getUserMissions(userId) {
  const { data } = await api.get(`/users/${userId}/missions`);
  return data;
}

export async function saveUserMissions(userId, missions) {
  const { data } = await api.put(`/users/${userId}/missions`, { missions });
  return data;
}

export async function startDailySession(payload) {
  const { data } = await api.post('/daily/start', payload);
  return data;
}

export async function answerDailySession(payload) {
  const { data } = await api.post('/daily/answer', payload);
  return data;
}

export async function analyzeBehavior(payload) {
  const { data } = await api.post('/behavior/analyze', payload);
  return data;
}

export async function registerUser(payload) {
  const { data } = await api.post('/auth/register', payload);
  return data;
}

export async function loginUser(payload) {
  const { data } = await api.post('/auth/login', payload);
  return data;
}
