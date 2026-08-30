/**
 * Persistence for the Career Prediction Engine student survey.
 *
 * The survey collects the 4 features that are not available in MongoDB.
 * Answers are kept in localStorage so the student only fills it in once.
 */

const STORAGE_KEY = 'career_engine_survey';

/**
 * Save the survey answers.
 * @param {object} answers - the 4 survey feature values
 * @returns {boolean} true when the write succeeded
 */
export function saveSurveyAnswers(answers) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
    return true;
  } catch {
    // Private browsing or a full quota - the caller still gets the answers
    // in memory, they just will not survive a reload.
    return false;
  }
}

/**
 * Load the saved survey answers.
 * @returns {object|null} the stored answers, or null if absent/unreadable
 */
export function loadSurveyAnswers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    // Guard against a corrupted or non-object entry.
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Whether the student has completed the survey.
 * @returns {boolean}
 */
export function hasSurveyAnswers() {
  return loadSurveyAnswers() !== null;
}

/**
 * Remove the stored answers (reset / testing).
 * @returns {boolean} true when the removal succeeded
 */
export function clearSurveyAnswers() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
