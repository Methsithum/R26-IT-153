import api from './apiClient';

export async function getFirstJourneyStatus(userId) {
  const { data } = await api.get(`/first-journey/status/${userId}`);
  return data;
}

export async function startFirstJourney(userId) {
  const { data } = await api.post('/first-journey/start', { user_id: userId });
  return data;
}

export async function answerFirstJourney(userId, questionId, answer) {
  const { data } = await api.post('/first-journey/answer', {
    user_id: userId,
    question_id: questionId,
    answer,
  });
  return data;
}
