import { startDailySession, answerDailySession } from './api';

export { startDailySession, answerDailySession };

export async function startGameSession({ userId, selectedActivities, date }) {
  return startDailySession({
    user_id: userId,
    date: date || new Date().toISOString(),
    selected_activities: selectedActivities,
  });
}

export async function submitCheckpointAnswer({ sessionId, answer, deadline }) {
  const payload = { session_id: sessionId, answer };
  if (deadline) payload.deadline = deadline;
  return answerDailySession(payload);
}
