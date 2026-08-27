/**
 * API client for the Career Prediction Engine backend.
 *
 * Backend must be running:
 *   cd backend/app/career-prediction-engine
 *   python -m uvicorn prediction_api:app --reload --port 8001
 */

const BASE_URL = 'http://localhost:8001';

/**
 * Shared response handler - throws a readable Error when the request fails,
 * so every caller can rely on a rejected promise instead of checking res.ok.
 */
async function handleResponse(res) {
  if (!res.ok) {
    // FastAPI puts validation/error text in `detail`; fall back to the status.
    const body = await res.json().catch(() => ({}));
    const detail =
      typeof body.detail === 'string'
        ? body.detail
        : Array.isArray(body.detail)
          ? body.detail.map((d) => d.msg).join(', ')
          : `HTTP ${res.status}`;
    throw new Error(detail);
  }
  return res.json();
}

/**
 * POST /predict - send all 15 student features, get risk + career prediction.
 * @param {object} features - the 15 feature values keyed by exact feature name
 * @returns {Promise<object>} academic_risk, prob_low/medium/high,
 *                            career_score, risk_label_color
 */
export async function predictStudent(features) {
  const res = await fetch(`${BASE_URL}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(features),
  });
  return handleResponse(res);
}

/**
 * GET /profiles - fetch the first 20 student profiles from the holdout set.
 * @returns {Promise<object[]>} each profile has the 15 features plus
 *                              academic_risk_level and career_readiness_score
 */
export async function getProfiles() {
  const res = await fetch(`${BASE_URL}/profiles`);
  return handleResponse(res);
}

/**
 * GET /model-metrics - fetch the winning model names and accuracy scores.
 * @returns {Promise<object>} model_A_winner/accuracy/f1, model_B_winner/r2/mae
 */
export async function getModelMetrics() {
  const res = await fetch(`${BASE_URL}/model-metrics`);
  return handleResponse(res);
}

export { BASE_URL };
