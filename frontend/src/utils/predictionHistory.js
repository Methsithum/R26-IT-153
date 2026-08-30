/**
 * Prediction history for the Career Prediction Engine.
 *
 * MongoDB (collection `career_predictions`) is the source of truth, reached
 * through /career/history. localStorage is kept as a mirror so the panel
 * still renders when the student is offline or the API is unreachable.
 */

import { readStoredUser } from '../services/userApi';
import { summariseDataQuality } from './extractFeatures';

const STORAGE_KEY = 'career_engine_history';
const API_BASE = `${import.meta.env.VITE_API_URL || '/api'}/career`;

/** Only the most recent N predictions are kept. */
const MAX_ENTRIES = 5;

/**
 * Format a Date as "26 Aug 2026 14:32" for display in the history list.
 * @param {Date} d
 * @returns {string}
 */
function formatDate(d) {
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('en-GB', { month: 'short' });
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${day} ${month} ${d.getFullYear()} ${time}`;
}

/**
 * Read the local mirror, tolerating a missing or corrupted entry.
 * @returns {object[]}
 */
function readLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Overwrite the local mirror, ignoring quota failures. */
function writeLocal(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert a stored MongoDB document into the shape the history panel renders.
 * @param {object} doc - a document from /career/history
 * @returns {object}
 */
function fromDocument(doc) {
  const when = doc.created_at ? new Date(doc.created_at) : new Date();
  return {
    id: doc.id ?? doc._id ?? when.getTime(),
    timestamp: doc.created_at ?? when.toISOString(),
    date: formatDate(when),
    academic_risk: doc.academic_risk,
    prob_low: doc.prob_low,
    prob_medium: doc.prob_medium,
    prob_high: doc.prob_high,
    career_score: doc.career_score,
    features_snapshot: doc.features_snapshot ?? {},
    data_quality: doc.data_quality ?? null,
  };
}

/**
 * Save one prediction to MongoDB, mirroring it locally either way.
 *
 * The local write happens even when the request fails, so a student on a
 * flaky connection still sees their own progress.
 *
 * @param {object} prediction - the /career/predict response
 * @param {object} features - the 15 features sent to the model
 * @returns {Promise<object|null>} the stored entry
 */
export async function savePrediction(prediction, features) {
  if (!prediction) return null;

  const now = new Date();
  const entry = {
    id: Date.now(),
    timestamp: now.toISOString(),
    date: formatDate(now),
    academic_risk: prediction.academic_risk,
    prob_low: prediction.prob_low,
    prob_medium: prediction.prob_medium,
    prob_high: prediction.prob_high,
    career_score: prediction.career_score,
    // Spread strips the non-enumerable __estimated marker, leaving exactly
    // the 15 model features.
    features_snapshot: { ...features },
    // How much of this prediction rests on real data, so a later comparison
    // can say whether a score moved or just got better-informed.
    data_quality: summariseDataQuality(features),
  };

  // Mirror locally first so the panel updates even if the request is slow.
  writeLocal([entry, ...readLocal()].slice(0, MAX_ENTRIES));

  const userId = readStoredUser()?.id;
  if (!userId) return entry;

  try {
    await fetch(`${API_BASE}/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        prediction,
        features: { ...features },
        estimated_features: features?.__estimated ?? [],
        data_quality: entry.data_quality,
      }),
    });
  } catch {
    // Offline - the local mirror already holds this entry.
  }

  return entry;
}

/**
 * All stored predictions for the signed-in student, newest first.
 *
 * Reads MongoDB and refreshes the local mirror; falls back to the mirror
 * when the request fails.
 *
 * @returns {Promise<object[]>}
 */
export async function getPredictionHistory() {
  const userId = readStoredUser()?.id;
  if (!userId) return readLocal();

  try {
    const res = await fetch(`${API_BASE}/history/${userId}`);
    if (!res.ok) return readLocal();

    const body = await res.json();
    const entries = (body.predictions ?? []).map(fromDocument);

    writeLocal(entries.slice(0, MAX_ENTRIES));
    return entries;
  } catch {
    return readLocal();
  }
}

/**
 * The most recent prediction.
 * @returns {Promise<object|null>}
 */
export async function getLatestPrediction() {
  const entries = await getPredictionHistory();
  return entries[0] ?? null;
}

/**
 * Whether any prediction has been generated before.
 * @returns {Promise<boolean>}
 */
export async function hasPreviousPrediction() {
  const entries = await getPredictionHistory();
  return entries.length > 0;
}

/**
 * Read the local mirror without touching the network.
 * Used for the first paint, before the API responds.
 * @returns {object[]}
 */
export function getCachedHistory() {
  return readLocal();
}

/**
 * Remove the student's stored predictions from MongoDB and the mirror.
 * @returns {Promise<boolean>}
 */
export async function clearHistory() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* mirror may be unavailable */
  }

  const userId = readStoredUser()?.id;
  if (!userId) return true;

  try {
    const res = await fetch(`${API_BASE}/history/${userId}`, { method: 'DELETE' });
    return res.ok;
  } catch {
    return false;
  }
}
