/**
 * Builds the 15 model features for the Career Prediction Engine.
 *
 *   11 features come from MongoDB via the shared backend API.
 *    4 features come from the one-time student survey (localStorage).
 *
 * Every MongoDB-derived value falls back to a training-set-realistic default
 * when the underlying collection has no data yet, so a brand-new student
 * still gets a usable prediction instead of a failed request.
 */

import { readStoredUser } from '../services/userApi';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

/**
 * Defaults used when a collection has no data for this user.
 * Values are the medians of the training set so a missing signal stays
 * neutral rather than dragging the prediction to an extreme.
 */
const DEFAULTS = {
  gpa_cumulative: 3.0,
  gpa_trend: 0.0,
  assignment_completion_rate: 0.8,
  late_submission_rate: 0.15,
  resit_count: 0,
  project_performance: 70,
  attendance_rate: 0.8,
  weekly_study_hours: 14,
  // Emotional fallbacks, used only when focus_emotional_stats has no
  // document for this user yet.
  stress_level: 50,
  anxiety_score: 10,
  mood_stability: 60,
};

/** Fallbacks for the 3 survey questions, used before the student answers. */
const SURVEY_DEFAULTS = {
  sleep_hours_avg: 6.5,
  sleep_consistency: 1.2,
  part_time_work_hours: 10,
};

/**
 * career_clarity_score is not collected anywhere yet - no teammate component
 * writes it and the survey no longer asks. 50 is the neutral midpoint until
 * a real source exists.
 */
const CAREER_CLARITY_DEFAULT = 50;

/** Clamp helper so no derived feature leaves its valid range. */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * GET a JSON endpoint, resolving to null instead of throwing.
 * One empty collection must not break the whole feature vector.
 */
async function safeGet(path) {
  try {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Assignment completion and lateness from the student's tasks.
 *
 * A task counts as done when `progress_stage` ends in "completed"
 * ("report_completed" or "completed") or is "joined", matching the rule in
 * backend behavior_analysis._count_completed_tasks.
 *
 * @returns {{assignment_completion_rate:number, late_submission_rate:number}|null}
 */
function deriveTaskFeatures(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) return null;

  const isDone = (t) => {
    const stage = String(t.progress_stage ?? '').toLowerCase();
    return stage.endsWith('completed') || stage === 'joined';
  };

  const done = tasks.filter(isDone);

  // Lateness is deliberately NOT derived here.
  //
  // A task carries no submission timestamp. `updated_at` looks like one but
  // is bumped by unrelated writes - a weekly mark check sets last_mark_check
  // and moves updated_at - so comparing it against `deadline` reports work as
  // late that was handed in on time. Returning null keeps the feature marked
  // as estimated instead of feeding the model a false signal.
  const overdue = tasks.filter((t) => {
    if (isDone(t)) return false;
    return t.deadline && new Date(`${t.deadline}T23:59:59`) < new Date();
  });

  return {
    assignment_completion_rate: clamp(done.length / tasks.length, 0, 1),
    // Share of assignments still unfinished past their deadline - a genuine
    // signal that needs no submission timestamp.
    late_submission_rate: clamp(overdue.length / tasks.length, 0, 1),
  };
}

/**
 * Resit count and project performance from exams and marked assignments.
 *
 * Marks live in `mark` on both collections and stay null until the student
 * records a result, so early-semester students have nothing here.
 *
 * @returns {{resit_count:number, project_performance:number|null}}
 */
function deriveExamFeatures(exams, tasks) {
  const examList = Array.isArray(exams) ? exams : [];
  const taskList = Array.isArray(tasks) ? tasks : [];

  const resits = examList.filter(
    (e) => String(e.exam_type ?? '').toLowerCase() === 'resit',
  ).length;

  // Pool exam and assignment marks - both are 0-100 performance signals.
  const marks = [...examList, ...taskList]
    .map((r) => r.mark)
    .filter((m) => typeof m === 'number' && !Number.isNaN(m));

  return {
    resit_count: resits,
    // null (not a default) so the caller can tell "no marks yet" apart from
    // a genuine average, and report it as estimated.
    project_performance: marks.length
      ? clamp(marks.reduce((a, b) => a + b, 0) / marks.length, 0, 100)
      : null,
  };
}

/**
 * Attendance from daily session history.
 *
 * The denominator is the number of days the student could actually have
 * attended - their account age, capped at the 30-day window. Dividing by a
 * flat 30 would penalise someone who joined a week ago for the 23 days
 * before their account existed.
 *
 * @param {object[]} sessions - daily_sessions documents
 * @param {string} [createdAt] - users.created_at
 * @returns {number|null} attendance rate 0-1, or null when there is nothing to measure
 */
function deriveAttendance(sessions, createdAt) {
  if (!Array.isArray(sessions) || sessions.length === 0) return null;

  const WINDOW_DAYS = 30;
  const cutoff = Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000;

  // Distinct days with a COMPLETED session inside the window. Counting days
  // rather than rows stops two sessions in one day reading as two days.
  const attendedDays = new Set(
    sessions
      .filter((s) => s.completed === true)
      .map((s) => s.date || s.session_date || s.created_at)
      .filter(Boolean)
      .filter((d) => new Date(d).getTime() >= cutoff)
      .map((d) => new Date(d).toISOString().slice(0, 10)),
  );

  // Use days since account created as denominator.
  // Capped at 30 days max.
  // Prevents penalising new students.
  //
  // The /users endpoint does not currently return created_at, so when the
  // caller has no date we fall back to the student's earliest session - the
  // first day they could possibly have attended.
  let created = createdAt ? new Date(createdAt).getTime() : NaN;

  if (Number.isNaN(created)) {
    const timestamps = sessions
      .map((s) => new Date(s.date || s.session_date || s.created_at).getTime())
      .filter((t) => !Number.isNaN(t));
    if (timestamps.length) created = Math.min(...timestamps);
  }

  const daysSinceJoined = Number.isNaN(created)
    ? WINDOW_DAYS
    : Math.max(1, Math.floor((Date.now() - created) / (1000 * 60 * 60 * 24)));

  const denominator = Math.min(daysSinceJoined, WINDOW_DAYS);

  return clamp(attendedDays.size / denominator, 0, 1);
}

/**
 * Study hours and GPA trend from aggregated learning patterns.
 * @returns {{weekly_study_hours:number|null, gpa_trend:number|null}}
 */
function deriveLearningFeatures(insights) {
  const p = insights?.patterns;
  if (!p) return { weekly_study_hours: null, gpa_trend: null };

  // total_study_time is minutes logged over data_period_days (default 30).
  // The journal only records this when the student enters a study duration,
  // so it is commonly 0 even for an active student.
  let weekly = null;
  const totalMin = p.total_study_time ?? p.totalStudyTime;
  const days = p.data_period_days ?? 30;

  if (typeof totalMin === 'number' && totalMin > 0) {
    weekly = clamp((totalMin / 60 / days) * 7, 0, 80);
  }
  // Leave `weekly` null when no duration was ever logged - the caller marks
  // the feature as estimated rather than inventing an hours figure from
  // session counts, which measure journal usage, not study time.

  // Engagement trend stands in for GPA direction.
  //
  // "stable", "neutral" and "unknown" all mean "no movement detected", which
  // is a real answer of 0.0 - not missing data. Anything unrecognised also
  // falls back to 0.0, so this never returns undefined or null.
  const trendMap = {
    improving: 0.3,
    rising: 0.3,
    declining: -0.3,
    falling: -0.3,
    stable: 0.0,
    neutral: 0.0,
    unknown: 0.0,
  };

  const trend = String(
    p.engagement_trend ?? p.engagementTrend ?? 'neutral',
  ).toLowerCase();
  const gpaTrend = trendMap[trend] ?? 0.0;

  return { weekly_study_hours: weekly, gpa_trend: gpaTrend };
}

/**
 * Build all 15 features for the current student.
 *
 * @param {object} [surveyAnswers] - the 4 survey values from localStorage
 * @returns {Promise<object>} the 15 features keyed by exact model feature name
 */
export async function extractFeaturesFromMongoDB(surveyAnswers) {
  const user = readStoredUser();
  const userId = user?.id;

  // Without a signed-in user there is nothing to query; return defaults
  // merged with whatever the survey provided.
  if (!userId) {
    return { ...DEFAULTS, ...resolveSurvey(surveyAnswers) };
  }

  // Fetch every source in parallel - each one degrades to null on failure.
  const [profile, tasksRes, examsRes, sessionsRes, insights, emotional] =
    await Promise.all([
      safeGet(`/users/${userId}`),
      safeGet(`/users/${userId}/tasks`),
      safeGet(`/users/${userId}/exams`),
      safeGet(`/users/${userId}/sessions`),
      safeGet(`/learning-insights/${userId}`),
      safeGet(`/focus/emotional?user_id=${encodeURIComponent(userId)}`),
    ]);

  const taskFeats = deriveTaskFeatures(tasksRes?.tasks);
  const examFeats = deriveExamFeatures(examsRes?.exams, tasksRes?.tasks);
  const attendance = deriveAttendance(
    sessionsRes?.sessions,
    profile?.created_at,
  );
  const learning = deriveLearningFeatures(insights);

  // ---- Emotional domain, from focus_emotional_stats ----------------------
  // One document per user, overwritten on every save, so this is always the
  // latest reading from the Focus Monitor's webcam ML model.

  // stress_level: direct mapping 0-100
  // from focus_emotional_stats ML model output
  const stress = emotional?.stress_level;

  // distraction_score maps DIRECTLY to anxiety_score
  // Both use 0-25 scale - no conversion needed
  // distraction_score combines physical fatigue,
  // anxiety and boredom from webcam ML model
  const anxiety = emotional?.distraction_score;

  // mood_stability: direct mapping 0-100
  // from focus_emotional_stats ML model output
  const mood = emotional?.mood_stability;

  // Every entry is [measured value or null, default]. A null means the
  // collection had nothing usable, so the default is an estimate.
  const sources = {
    gpa_cumulative: [profile?.gpa, DEFAULTS.gpa_cumulative],
    gpa_trend: [learning.gpa_trend, DEFAULTS.gpa_trend],
    assignment_completion_rate: [
      taskFeats?.assignment_completion_rate,
      DEFAULTS.assignment_completion_rate,
    ],
    late_submission_rate: [
      taskFeats?.late_submission_rate,
      DEFAULTS.late_submission_rate,
    ],
    resit_count: [examFeats.resit_count, DEFAULTS.resit_count],
    project_performance: [
      examFeats.project_performance,
      DEFAULTS.project_performance,
    ],
    attendance_rate: [attendance, DEFAULTS.attendance_rate],
    weekly_study_hours: [
      learning.weekly_study_hours,
      DEFAULTS.weekly_study_hours,
    ],
    stress_level: [stress, DEFAULTS.stress_level],
    anxiety_score: [anxiety, DEFAULTS.anxiety_score],
    mood_stability: [mood, DEFAULTS.mood_stability],
  };

  const mongoFeatures = {};
  const estimated = [];

  for (const [key, [measured, fallback]] of Object.entries(sources)) {
    const usable = typeof measured === 'number' && !Number.isNaN(measured);
    mongoFeatures[key] = usable ? measured : fallback;
    if (!usable) estimated.push(key);
  }

  // career_clarity_score has no source at all yet, so it is estimated in the
  // same sense as a missing MongoDB field - the student never supplied it.
  estimated.push('career_clarity_score');

  // Non-enumerable so the object still spreads cleanly into a /predict body
  // containing exactly the 15 model features.
  const features = { ...mongoFeatures, ...resolveSurvey(surveyAnswers) };
  Object.defineProperty(features, '__estimated', {
    value: estimated,
    enumerable: false,
  });

  return features;
}

/**
 * The 3 survey features plus the career-clarity placeholder.
 *
 * @param {object} [surveyAnswers] - saved survey answers
 * @returns {object} 4 model features
 */
function resolveSurvey(surveyAnswers) {
  return {
    sleep_hours_avg:
      surveyAnswers?.sleep_hours_avg ?? SURVEY_DEFAULTS.sleep_hours_avg,
    sleep_consistency:
      surveyAnswers?.sleep_consistency ?? SURVEY_DEFAULTS.sleep_consistency,
    part_time_work_hours:
      surveyAnswers?.part_time_work_hours ?? SURVEY_DEFAULTS.part_time_work_hours,

    // career_clarity_score: default 50
    // Friend implementation pending
    // Will be read from users collection
    // when available
    career_clarity_score: CAREER_CLARITY_DEFAULT,
  };
}

/**
 * Summarise how much of a feature vector came from real student data.
 *
 * Quality is measured over the 11 MongoDB features plus career_clarity_score,
 * which is a placeholder until a teammate implements it. The 3 survey answers
 * are excluded because they are always real - the student typed them.
 *
 * @param {object} features - the result of extractFeaturesFromMongoDB
 * @returns {{real_features:number, estimated_features:number,
 *            quality_percent:number, estimated_list:string[]}}
 */
export function summariseDataQuality(features) {
  const estimatedList = features?.__estimated ?? [];
  // 11 MongoDB features + career_clarity_score.
  const total = Object.keys(DEFAULTS).length + 1;
  const estimated = estimatedList.length;
  const real = Math.max(0, total - estimated);

  return {
    real_features: real,
    estimated_features: estimated,
    quality_percent: Math.round((real / total) * 100),
    estimated_list: [...estimatedList],
  };
}
