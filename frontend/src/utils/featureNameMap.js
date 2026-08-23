// Shared explainability vocabulary. The trained model (backend XGBoost
// priority_model.joblib) only understands raw feature names/encodings - the
// UI must never surface those directly (PROJECT CONTEXT.md Section 6/10).
// This file is the single place that translates model-speak into copy a
// student would actually read.

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

export function humanizeFeatureName(key) {
  return FEATURE_LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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

/** Softens copy when the model isn't very confident, per Section 10. */
export function confidenceCopy(confidence) {
  const pct = Math.round(confidence * 100);
  if (confidence >= 0.85) {
    return { pct, tone: "confident", label: "The model is quite confident about this." };
  }
  if (confidence >= 0.6) {
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
