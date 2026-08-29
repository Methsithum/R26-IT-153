// Shared explainability vocabulary. The trained model (backend XGBoost
// priority_model.joblib) only understands raw feature names/encodings - the
// UI must never surface those directly (PROJECT CONTEXT.md Section 6/10).
// This file is the single place that translates model-speak into copy a
// student would actually read.

import { daysRemaining } from "./dateHelpers";

// The model's `date` feature is NOT "days remaining from today" - in the
// real OULAD training data (backend/ml_scripts/study-planner/outputs/
// oulad_task_level_leakage_free.csv) it's "days from module presentation
// start to the assessment's deadline", ranging 12-261 (mean ~131, median
// ~129 - verified directly against the training CSV, not guessed). Feeding
// the model a raw "days until deadline" value (typically single/double
// digits) is badly out-of-distribution: the model has essentially never
// seen a `date` below 12 in training, so small real-world values get
// extrapolated unreliably - this was the root cause of a "due tomorrow"
// task showing lower priority than one due weeks out (see bug report).
//
// The frontend has no real per-module "start date" to compute the same
// figure OULAD used, so this maps the one signal we do have - real days
// remaining until the deadline - linearly onto that same trained range,
// preserving the same direction the training script's own inline comment
// documents ("date... as the forward-looking urgency signal": smaller =
// sooner/closer, larger = further off). CAP_DAYS (~6 months) is a generous
// upper bound for "far in the future" - anything beyond it clamps to the
// trained maximum rather than extrapolating further out of range.
const TRAINED_DATE_MIN = 12;
const TRAINED_DATE_MAX = 261;
const CAP_DAYS = 180;

export function buildDateFeatureFromDeadline(deadlineIsoDate, from = new Date()) {
  const remaining = Math.max(0, Math.min(daysRemaining(deadlineIsoDate, from), CAP_DAYS));
  return TRAINED_DATE_MIN + (remaining / CAP_DAYS) * (TRAINED_DATE_MAX - TRAINED_DATE_MIN);
}

export const FEATURE_LABELS = {
  date: "Time until deadline",
  weight: "Assignment weight",
  num_of_prev_attempts: "Previous attempts at this module",
  studied_credits: "Total credits currently studied",
  module_presentation_length: "Module length",
  date_registration: "Enrollment timing",
  prior_avg_score: "Your average score so far",
  avg_weekly_clicks: "Weekly engagement with course materials",
  clicks_trend: "Recent change in engagement",
  active_weeks_ratio: "Consistency of study activity",
  has_vle_activity: "Course portal activity",
  assessment_type_enc: "Assessment type",
  code_module_enc: "Module",
};

// Bug fix (see PROJECT CONTEXT.md Section 6 follow-up): this used to fall
// back silently to a raw-key-derived guess with no signal that the map was
// incomplete, which is how "assessment_type_enc" ended up on screen even
// though that exact key WAS in FEATURE_LABELS elsewhere - the actual leak
// was a different code path (explain_service.py's server-built sentence)
// bypassing this function entirely, not this fallback. Warning here now so
// a genuinely-missing key (e.g. a new feature added later without updating
// FEATURE_LABELS) is loud in development instead of quietly reaching a
// student as a snake_case string in production.
export function humanizeFeatureName(key) {
  const label = FEATURE_LABELS[key];
  if (label) return label;
  if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.warn(
      `featureNameMap: no FEATURE_LABELS entry for "${key}" - add one so this never reaches a student as a raw model feature name.`
    );
  }
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Turns SHAP feature_contributions into a friendly, sorted list.
 * Positive contribution = pushed toward the predicted priority.
 */
export function humanizeContributions(contributions = {}) {
  return Object.entries(contributions)
    .map(([key, value]) => ({
      key,
      label: humanizeFeatureName(key),
      value,
      direction: value >= 0 ? "increased" : "decreased",
    }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

export function lowerFirst(s) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/**
 * Builds the "Task flagged X priority mainly because of ..." sentence
 * CLIENT-SIDE from humanized contributions, instead of trusting
 * /explain's own `explanation_sentence` field. explain_service.py builds
 * that sentence with the model's raw FEATURE_ORDER keys (e.g.
 * "assessment_type_enc (-0.92 contribution)") - it was never run through
 * this file's humanizer at all, which is how a raw feature name reached the
 * UI despite FEATURE_LABELS already having an entry for it. Rebuilding the
 * sentence here, from the same humanizeContributions() the factor bars
 * already use, is the fix: one code path, guaranteed humanized.
 */
export function buildShapSentence(priorityLabel, contributions, topN = 2) {
  const top = humanizeContributions(contributions).slice(0, topN).filter((c) => c.label);
  if (top.length === 0) return `${priorityLabel} priority.`;
  const phrases = top.map((c) => lowerFirst(c.label));
  const joined =
    phrases.length > 1 ? `${phrases.slice(0, -1).join(", ")} and ${phrases[phrases.length - 1]}` : phrases[0];
  return `${priorityLabel} priority mainly because of ${joined}.`;
}

// Softens copy when the model isn't very confident, per Section 10.
// Bands were originally 0.85 / 0.6, which read oddly in practice - 81%
// landed in "moderate" even though most people read 81% as fairly high
// confidence. Lowered to 0.8 / 0.55: 80%+ reads as genuinely confident,
// 55-80% as a real-but-imperfect signal ("moderate"), and below 55% - closer
// to a 3-class coin flip (baseline ~33%) than a real signal - as a rough
// guess. Tone set (confident/moderate/low) is unchanged; only the cutoffs
// moved.
export function confidenceCopy(confidence) {
  const pct = Math.round(confidence * 100);
  if (confidence >= 0.8) {
    return { pct, tone: "confident", label: "The model is quite confident about this." };
  }
  if (confidence >= 0.55) {
    return { pct, tone: "moderate", label: "The model has moderate confidence here." };
  }
  return { pct, tone: "low", label: "This is more of an educated guess — treat it as a rough steer." };
}

// Real encodings pulled from trained-models/stuyd-planner/label_encoders.joblib
// (sklearn LabelEncoder, alphabetical order). Kept here so mock/manual feature
// rows built by the frontend stay consistent with what the model was trained on.
export const CODE_MODULE_ENCODING = { AAA: 0, BBB: 1, CCC: 2, DDD: 3, EEE: 4, FFF: 5, GGG: 6 };
export const ASSESSMENT_TYPE_ENCODING = { CMA: 0, Exam: 1, TMA: 2 };

export const ASSESSMENT_TYPE_LABELS = {
  CMA: "Computer-Marked Assignment",
  TMA: "Tutor-Marked Assignment",
  Exam: "Exam",
};

// Short display initials from a real module name (e.g. "Database Systems" ->
// "DS"), for badges/chart labels that would otherwise fall back to the
// internal OULAD-style module code (e.g. "AAA") — model bookkeeping the
// student never needs to see.
export function moduleInitials(name = "") {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export const PRIORITY_COLORS = {
  High: {
    text: "text-high-600 dark:text-high-500",
    bg: "bg-high-50 dark:bg-high-500/10",
    solid: "bg-high-500",
    ring: "ring-high-500/30",
    dot: "bg-high-500",
  },
  Medium: {
    text: "text-medium-600 dark:text-medium-500",
    bg: "bg-medium-50 dark:bg-medium-500/10",
    solid: "bg-medium-500",
    ring: "ring-medium-500/30",
    dot: "bg-medium-500",
  },
  Low: {
    text: "text-low-600 dark:text-low-500",
    bg: "bg-low-50 dark:bg-low-500/10",
    solid: "bg-low-500",
    ring: "ring-low-500/30",
    dot: "bg-low-500",
  },
};
