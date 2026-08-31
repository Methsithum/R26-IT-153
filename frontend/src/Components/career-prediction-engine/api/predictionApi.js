/**
 * API client for the Career Prediction Engine.
 *
 * Routes live on the shared Smart Uni Guide backend under /career.
 * Requests go through the Vite dev proxy: "/api/*" is forwarded to
 * http://127.0.0.1:8000 with the "/api" prefix stripped, so "/api/career/predict"
 * reaches the backend as "/career/predict". Set VITE_API_URL to override.
 */

const BASE_URL = `${import.meta.env.VITE_API_URL || '/api'}/career`;

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
 * POST /career/predict - send all 15 student features, get risk + career prediction.
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
 * GET /career/profiles - fetch the first 20 student profiles from the holdout set.
 * @returns {Promise<object[]>} each profile has the 15 features plus
 *                              academic_risk_level and career_readiness_score
 */
export async function getProfiles() {
  const res = await fetch(`${BASE_URL}/profiles`);
  return handleResponse(res);
}

/**
 * GET /career/model-metrics - fetch the winning model names and accuracy scores.
 * @returns {Promise<object>} model_A/B winners plus per-algorithm rows
 */
export async function getModelMetrics() {
  const res = await fetch(`${BASE_URL}/model-metrics`);
  return handleResponse(res);
}

export { BASE_URL };
