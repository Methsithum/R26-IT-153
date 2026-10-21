// priorityEngine.js

import { daysRemaining } from "./dateHelpers";
import { buildShapSentence, humanizeContributions, lowerFirst } from "./featureNameMap";

export const PRIORITY_LEVELS = { Low: 0, Medium: 1, High: 2 };
export const LEVEL_TO_PRIORITY = ["Low", "Medium", "High"];

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

// Deadline-driven base tier - the dominant factor.
export function computeBaseTier(daysRemaining, taskType = "assignment") {
  if (daysRemaining < 0) return { level: PRIORITY_LEVELS.High, leaning: null };

  if (taskType === "exam") {
    if (daysRemaining <= 7) return { level: PRIORITY_LEVELS.High, leaning: null };
    if (daysRemaining <= 14) return { level: PRIORITY_LEVELS.Medium, leaning: "High" };
    if (daysRemaining <= 30) return { level: PRIORITY_LEVELS.Medium, leaning: null };
    return { level: PRIORITY_LEVELS.Low, leaning: "Medium" };
  }

  // assignment (default)
  if (daysRemaining <= 4) return { level: PRIORITY_LEVELS.High, leaning: null };
  if (daysRemaining <= 7) return { level: PRIORITY_LEVELS.Medium, leaning: "High" };
  if (daysRemaining <= 14) return { level: PRIORITY_LEVELS.Medium, leaning: null };
  return { level: PRIORITY_LEVELS.Low, leaning: "Medium" };
}

// Urgent floor
export const URGENT_FLOOR_DAYS = { assignment: 2, exam: 7 };

// Combines the deadline-driven base tier with the ML model's label.
export function computeFinalPriority(daysRemainingValue, taskType, mlPriorityLabel) {
  // Hard floor, checked FIRST and before any base-tier/modifier math
  if (daysRemainingValue > 30) {
    return {
      priorityLabel: "Low",
      baseTierLevel: PRIORITY_LEVELS.Low,
      mlTierLevel: mlPriorityLabel != null ? PRIORITY_LEVELS[mlPriorityLabel] : null,
      modifier: 0,
      dominantMechanism: "deadline",
    };
  }

  const base = computeBaseTier(daysRemainingValue, taskType);
  const urgent =
    daysRemainingValue < 0 ||
    daysRemainingValue <= (URGENT_FLOOR_DAYS[taskType] ?? URGENT_FLOOR_DAYS.assignment);
  const mlLevel = mlPriorityLabel != null ? PRIORITY_LEVELS[mlPriorityLabel] : null;

  if (urgent || mlLevel == null) {
    const finalLevel = urgent ? PRIORITY_LEVELS.High : base.level;
    return {
      priorityLabel: LEVEL_TO_PRIORITY[finalLevel],
      baseTierLevel: base.level,
      mlTierLevel: mlLevel,
      modifier: 0,
      dominantMechanism: "deadline",
    };
  }

  const modifier = clamp(mlLevel - base.level, -1, 1);
  const finalLevel = clamp(base.level + modifier, 0, 2);

  return {
    priorityLabel: LEVEL_TO_PRIORITY[finalLevel],
    baseTierLevel: base.level,
    mlTierLevel: mlLevel,
    modifier,
    // "deadline" dominant only
    dominantMechanism: finalLevel === base.level ? "deadline" : "ml",
  };
}

/** Convenience wrapper taking an ISO deadline instead of a precomputed days count. */
export function computeFinalPriorityFromDeadline(deadlineIsoDate, taskType, mlPriorityLabel, from = new Date()) {
  return computeFinalPriority(daysRemaining(deadlineIsoDate, from), taskType, mlPriorityLabel);
}

// Plain-English sentence for when the deadline dominated
export function deadlineDominantSentence(result, daysRemainingValue) {
  if (result.dominantMechanism !== "deadline") return null;
  const label = result.priorityLabel;
  if (daysRemainingValue < 0) {
    const overdueDays = Math.abs(daysRemainingValue);
    return `${label} priority mainly because it's ${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue.`;
  }
  if (daysRemainingValue === 0) return `${label} priority mainly because it's due today.`;
  if (daysRemainingValue === 1) return `${label} priority mainly because it's due tomorrow.`;
  return `${label} priority mainly because it's due in ${daysRemainingValue} days.`;
}

// Decides WHICH explanation to show for a task's "Why this priority?" panel
const NO_DATA_CAVEATS = {
  prior_avg_score: "Your performance history isn't available yet, so this estimate may be less certain.",
  weight: "This task's weight isn't set yet — using a neutral default, so this estimate may be less certain.",
};

// Real assessment-weight distribution from the actual training dataset
const TRAINING_WEIGHT_PERCENTILES = { median: 9, p75: 18, p90: 25 };

function weightDetailSentence(weightValue) {
  if (weightValue == null || Number.isNaN(weightValue)) return null;
  const { median, p75, p90 } = TRAINING_WEIGHT_PERCENTILES;
  if (weightValue > p90) {
    return `This assignment's ${weightValue}% weight is among the heaviest in the training data — over 90% of assessments the model learned from are lighter than this, which is why it pushed the priority up.`;
  }
  if (weightValue > p75) {
    return `This assignment's ${weightValue}% weight is well above typical — most assessments in the training data are weighted under ${p75}%, which is why it pushed the priority up.`;
  }
  if (weightValue > median) {
    return `This assignment's ${weightValue}% weight is somewhat above the typical assessment weight (median ${median}% in the training data), which nudged the priority up.`;
  }
  return `This assignment's ${weightValue}% weight is around or below the typical assessment weight (median ${median}% in the training data).`;
}

export function resolveExplanationDisplay(finalResult, daysRemainingValue, explanation, options = {}) {
  if (!finalResult || !explanation) return null;
  const {
    hasPriorScoreData = true,
    hasRealWeight = true,
    hasEngagementData = false,
    hasSemesterData = false,
    weightValue = null,
  } = options;
  const excludeKeys = [
    ...(hasPriorScoreData ? [] : ["prior_avg_score"]),
    ...(hasRealWeight ? [] : ["weight"]),
    // Engagement is only real once the journal has a completed week of study logs for this subject
    ...(hasEngagementData ? [] : ["avg_weekly_clicks", "clicks_trend", "active_weeks_ratio", "has_vle_activity"]),
    // Real only once the student has filled in Semester setup
    ...(hasSemesterData ? [] : ["num_of_prev_attempts", "studied_credits", "date_registration", "module_presentation_length"]),
    // assessment_type_enc and code_module_enc are always excluded, unconditionally
    "assessment_type_enc",
    "code_module_enc",
  ];

  const excludedSet = new Set(excludeKeys);
  const rawLabel = explanation.predicted_priority;
  const finalLabel = finalResult.priorityLabel;

  // Was one of the no-real-data features the single strongest contributor overall
  const allRanked = humanizeContributions(explanation.feature_contributions);
  const topKey = allRanked[0]?.key;
  const caveat = excludeKeys.includes(topKey) ? NO_DATA_CAVEATS[topKey] || null : null;

  // The same exclusion applies to the factor BARS shown alongside the sentence
  const excludedContributions = Object.fromEntries(
    Object.entries(explanation.feature_contributions).filter(([key]) => !excludeKeys.includes(key))
  );

  if (finalLabel === rawLabel) {
    // Check if "weight" is the strongest reason
    const shapStrongestKey = allRanked.filter((c) => !excludedSet.has(c.key))[0]?.key;
    return {
      type: "shap",
      sentence: buildShapSentence(finalLabel, explanation.feature_contributions, 2, excludeKeys),
      detail: hasRealWeight && shapStrongestKey === "weight" ? weightDetailSentence(weightValue) : null,
      contributions: excludedContributions,
      caveat,
    };
  }

  if (finalResult.dominantMechanism === "deadline") {
    return {
      type: "deadline",
      sentence: deadlineDominantSentence(finalResult, daysRemainingValue),
    };
  }

  const baseLabel = LEVEL_TO_PRIORITY[finalResult.baseTierLevel];
  const raised = PRIORITY_LEVELS[finalLabel] > finalResult.baseTierLevel;
  const direction = raised ? "raised" : "lowered";

  // The top factor by raw magnitude isn't necessarily what argued FOR this shift
  const humanized = allRanked.filter((c) => !excludedSet.has(c.key));
  const supporting = humanized.filter((c) => (raised ? c.value > 0 : c.value < 0));
  const topFactor = supporting[0] || humanized[0];
  const reason = topFactor ? lowerFirst(topFactor.label) : "the model's prediction";

  return {
    type: "blended",
    sentence: `Normally this would be ${baseLabel} priority based on its deadline, but it's been ${direction} to ${finalLabel} priority because of ${reason}.`,
    detail: hasRealWeight && topFactor?.key === "weight" ? weightDetailSentence(weightValue) : null,
    contributions: excludedContributions,
    caveat,
  };
}

// Applies the hybrid layer to every task in a /schedule or /reschedule response's `tasks` registry
export function applyPriorityEngineToScheduleResult(scheduleResult, from = new Date()) {
  if (!scheduleResult?.tasks) return scheduleResult;

  // First pass: independent per-task hybrid priority, exactly as before.
  const computed = Object.entries(scheduleResult.tasks).map(([taskId, entry]) => {
    const taskType = entry.task_type || "assignment";
    const result = computeFinalPriorityFromDeadline(entry.deadline_date, taskType, entry.priority_label, from);
    return { taskId, entry, taskType, days: daysRemaining(entry.deadline_date, from), level: PRIORITY_LEVELS[result.priorityLabel] };
  });

  // Second pass
  const byType = {};
  computed.forEach((c) => {
    (byType[c.taskType] = byType[c.taskType] || []).push(c);
  });
  Object.values(byType).forEach((group) => {
    group.sort((a, b) => b.days - a.days); // farthest deadline first
    let minAllowedLevel = 0;
    group.forEach((c) => {
      c.level = Math.max(c.level, minAllowedLevel);
      minAllowedLevel = c.level;
    });
  });

  const tasks = Object.fromEntries(
    computed.map((c) => [c.taskId, { ...c.entry, priority_label: LEVEL_TO_PRIORITY[c.level] }])
  );

  const overload_warning = (scheduleResult.overload_warning || []).map((w) => {
    const taskType = w.task_type || "assignment";
    const result = computeFinalPriorityFromDeadline(w.deadline_date, taskType, w.priority_label, from);
    return { ...w, priority_label: result.priorityLabel };
  });

  return { ...scheduleResult, tasks, overload_warning };
}
