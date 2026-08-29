// priorityEngine.js
//
// Rule-based layer on top of the ML priority model's output. Not a fix for
// the model — the model itself is already correct (PROJECT CONTEXT.md
// Section 5c: the OrdinalMonotonicPriorityModel guarantees priority never
// falls as a deadline gets nearer, HOLDING OTHER FEATURES FIXED). What that
// guarantee does NOT cover is consistency ACROSS different tasks: weight and
// prior performance can genuinely dominate the model's decision more than
// deadline proximity (confirmed via SHAP), so a task due in 32 days can
// still outrank a differently-weighted task due in 12 days. That's a real
// product requirement (deadline should be what students see as the
// dominant signal across their whole list), not a bug in the monotonic fix
// - see PROJECT CONTEXT.md Section 5d for the full writeup.
//
// This layer takes real days-until-deadline as the DOMINANT factor (a
// deadline-driven "base tier"), then lets the ML label shift the result by
// at most one tier as a secondary modifier. The Section 5c monotonic
// guarantee is what makes it safe to trust the ML label for that modifier
// at all - an unconstrained model's label could point the wrong direction
// entirely; the monotonic model's only points the "wrong" amount.

import { daysRemaining } from "./dateHelpers";
import { buildShapSentence, humanizeContributions, lowerFirst } from "./featureNameMap";

export const PRIORITY_LEVELS = { Low: 0, Medium: 1, High: 2 };
export const LEVEL_TO_PRIORITY = ["Low", "Medium", "High"];

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Deadline-driven base tier - the dominant factor. Two threshold tables
 * because exams have a naturally longer real-world lead time than
 * assignments (revision starts weeks out, not days) - using the assignment
 * thresholds for exams would flag every exam "Low" until the last minute.
 * Overdue (daysRemaining < 0) is always High for either type, and the
 * caller must never let a modifier downgrade it - see computeFinalPriority.
 */
export function computeBaseTier(daysRemaining, taskType = "assignment") {
  if (daysRemaining < 0) return { level: PRIORITY_LEVELS.High, leaning: null };

  if (taskType === "exam") {
    if (daysRemaining <= 7) return { level: PRIORITY_LEVELS.High, leaning: null };
    if (daysRemaining <= 14) return { level: PRIORITY_LEVELS.Medium, leaning: "High" };
    if (daysRemaining <= 30) return { level: PRIORITY_LEVELS.Medium, leaning: null };
    return { level: PRIORITY_LEVELS.Low, leaning: "Medium" };
  }

  // assignment (default)
  if (daysRemaining <= 2) return { level: PRIORITY_LEVELS.High, leaning: null };
  if (daysRemaining <= 7) return { level: PRIORITY_LEVELS.Medium, leaning: "High" };
  if (daysRemaining <= 14) return { level: PRIORITY_LEVELS.Medium, leaning: null };
  return { level: PRIORITY_LEVELS.Low, leaning: "Medium" };
}

/**
 * Combines the deadline-driven base tier with the ML model's label.
 *
 * mlPriorityLabel may be null/undefined (prediction not fetched yet) - in
 * that case the base tier stands alone and dominates by definition.
 *
 * The ±1 clamp is the cross-task dominance requirement (Section 5d): the
 * now-reliable ML signal (trustworthy at all only because of the Section 5c
 * monotonic fix - an unconstrained model's label could disagree with the
 * deadline in either direction for the wrong reasons) can nudge a task's
 * displayed priority by at most one tier from where its deadline alone would
 * put it. A high-weight task due in 10 days can be pushed from its base
 * Medium up to High; a low-weight task due tomorrow cannot be pushed down
 * below its base High. Overdue tasks skip the clamp entirely and stay High
 * no matter what the model says.
 */
export function computeFinalPriority(daysRemainingValue, taskType, mlPriorityLabel) {
  // Hard floor, checked FIRST and before any base-tier/modifier math: a task
  // or exam more than a month out (> 30 days) is always Low, full stop - the
  // ML modifier is not applied at all here, no matter how strongly the
  // model's weight-driven signal argues otherwise. Without this, a
  // high-weight/low-performance task 32+ days out could still climb to
  // Medium via the ±1 modifier (base Low + modifier +1 = Medium) - legal
  // under the bound, but still reads as "this needs attention soon" to a
  // student for something over a month away, undermining the whole point of
  // making the deadline the dominant signal. Applies to both taskType values
  // equally. Does not affect the overdue rule at the other end of the range
  // (daysRemaining < 0 is handled below and always wins there regardless).
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
  const overdue = daysRemainingValue < 0;
  const mlLevel = mlPriorityLabel != null ? PRIORITY_LEVELS[mlPriorityLabel] : null;

  if (overdue || mlLevel == null) {
    const finalLevel = overdue ? PRIORITY_LEVELS.High : base.level;
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
    // "deadline" dominant only when the modifier had no net effect on the
    // displayed tier (including when it was clamped away at a boundary,
    // e.g. base already High and the model wanted to push higher still) -
    // "ml" dominant only when it genuinely moved the result off the base.
    dominantMechanism: finalLevel === base.level ? "deadline" : "ml",
  };
}

/** Convenience wrapper taking an ISO deadline instead of a precomputed days count. */
export function computeFinalPriorityFromDeadline(deadlineIsoDate, taskType, mlPriorityLabel, from = new Date()) {
  return computeFinalPriority(daysRemaining(deadlineIsoDate, from), taskType, mlPriorityLabel);
}

/**
 * Plain-English sentence for when the DEADLINE mechanism dominated - the
 * counterpart to explain_service.py's SHAP-based explanation_sentence for
 * when the ML modifier dominated. Callers (ExplanationPanel) must show
 * exactly one of these, never blend them into one sentence - they can
 * legitimately describe different things (the base tier vs. what the ML
 * model itself found salient) and blending would misrepresent which one
 * actually produced the number on screen.
 */
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

/**
 * Decides WHICH explanation to show for a task's "Why this priority?" panel,
 * and builds it - the single place this decision is made, so no screen has
 * to reimplement it (mirrors the "apply consistently" rule from Section 5d).
 *
 * The bug this fixes: the badge shows `finalResult.priorityLabel` (post
 * priorityEngine), but a naive "always show /explain's own sentence" would
 * describe `explanation.predicted_priority` - the RAW ML label - which can
 * differ from what's on screen whenever the base tier or hard floor
 * overrode or partially clamped the model. Showing an explanation for a
 * priority the student isn't looking at is worse than showing none.
 *
 * Three cases, decided by comparing final vs. raw vs. base (all already on
 * `finalResult` from computeFinalPriority):
 *  - final === raw ML label: the hybrid layer's modifier either agreed with
 *    the ML label outright, or moved the base exactly onto it - either way,
 *    what's on screen IS the model's own prediction, so its SHAP reasoning
 *    is accurate. -> "shap" (rebuilt with buildShapSentence, so no raw
 *    feature-name leak makes it through - see featureNameMap.js).
 *  - final !== raw AND dominantMechanism === "deadline": the base tier or
 *    the >30-day hard floor overrode the model's raw label entirely
 *    (modifier had zero net effect on the displayed tier). -> "deadline".
 *  - final !== raw AND dominantMechanism === "ml": the ±1 clamp let the
 *    model move the base tier, but the model wanted to move it further (a
 *    2-tier jump, clamped to 1) - both the deadline baseline and the model's
 *    push are genuinely part of the story. -> "blended".
 *
 * `options.hasPriorScoreData` / `options.hasRealWeight` (Section 17,
 * cold-start investigation): when false, that feature's value in the
 * feature row is a neutral fallback (DEFAULT_PRIOR_AVG_SCORE for
 * prior_avg_score in featureNameMap.js; the 20 placeholder in
 * useAcademicStore.js for weight, used when a real synced task - per the
 * external Journal schema, which has NO weight field at all - hasn't had a
 * weight set yet), not a real value for this student/task. Neither may be
 * named as a headline "why" reason ("...mainly because of assignment
 * weight" would be actively misleading when the weight isn't actually
 * known yet - and weight is the model's single strongest feature overall,
 * per Section 6's SHAP analysis, so this matters more than most). Both are
 * excluded from the top-factor search in both the "shap" and "blended"
 * cases below; if either would otherwise have been the single strongest
 * contributor, an honest, feature-specific caveat sentence is appended
 * instead of silently substituting the next-best factor with no explanation.
 */
const NO_DATA_CAVEATS = {
  prior_avg_score: "Your performance history isn't available yet, so this estimate may be less certain.",
  weight: "This task's weight isn't set yet — using a neutral default, so this estimate may be less certain.",
};

export function resolveExplanationDisplay(finalResult, daysRemainingValue, explanation, options = {}) {
  if (!finalResult || !explanation) return null;
  const { hasPriorScoreData = true, hasRealWeight = true } = options;
  const excludeKeys = [
    ...(hasPriorScoreData ? [] : ["prior_avg_score"]),
    ...(hasRealWeight ? [] : ["weight"]),
  ];

  const rawLabel = explanation.predicted_priority;
  const finalLabel = finalResult.priorityLabel;

  // Was one of the no-real-data features the single strongest contributor
  // overall (before any exclusion)? If so, the caveat for THAT feature is
  // worth surfacing - if some other, genuinely-real feature would have been
  // named anyway, silently excluding a minor no-data contributor needs no
  // extra caveat.
  const allRanked = humanizeContributions(explanation.feature_contributions);
  const topKey = allRanked[0]?.key;
  const caveat = excludeKeys.includes(topKey) ? NO_DATA_CAVEATS[topKey] || null : null;

  if (finalLabel === rawLabel) {
    return {
      type: "shap",
      sentence: buildShapSentence(finalLabel, explanation.feature_contributions, 2, excludeKeys),
      contributions: explanation.feature_contributions,
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

  // The top factor by raw magnitude isn't necessarily what argued FOR this
  // shift - SHAP's contributions are signed relative to the model's own raw
  // prediction (explanation.predicted_priority), and the single strongest
  // factor can easily be one that argued AGAINST it (e.g. the largest-
  // magnitude factor pushing toward Low while a smaller one pushed toward
  // High - picking the former for a "raised because of X" sentence would
  // describe X as the reason for a change it was actually arguing against).
  // Only consider contributors whose sign actually supports the direction
  // of the shift: positive (pushed toward the raw label) when raised,
  // negative (pushed away from it) when lowered. Also excludes any
  // no-real-data feature here for the same cold-start reason as above.
  const excludedSet = new Set(excludeKeys);
  const humanized = allRanked.filter((c) => !excludedSet.has(c.key));
  const supporting = humanized.filter((c) => (raised ? c.value > 0 : c.value < 0));
  const topFactor = supporting[0] || humanized[0];
  const reason = topFactor ? lowerFirst(topFactor.label) : "the model's prediction";

  return {
    type: "blended",
    sentence: `Normally this would be ${baseLabel} priority based on its deadline, but it's been ${direction} to ${finalLabel} priority because of ${reason}.`,
    contributions: explanation.feature_contributions,
    caveat,
  };
}

/**
 * Applies the hybrid layer to every task in a /schedule or /reschedule
 * response's `tasks` registry (and, for internal consistency, its
 * `overload_warning` entries) IN PLACE OF the raw ML `priority_label`
 * before the response is stored/displayed. This is the single choke point
 * that makes every screen reading `schedule.tasks[taskId].priority_label`
 * (Dashboard, TodayTimeline, DayView, WeekGrid, MonthGrid, Tasks) see the
 * hybrid result automatically, without reimplementing this logic in each
 * of them - see useWeeklySchedule()/useReschedule() in useAcademicData.js.
 *
 * Reads each entry's real `task_type` (now round-tripped by the backend -
 * see PROJECT CONTEXT.md Section 5d's plumbing fix and Section 8's exam-prep
 * subsection) rather than assuming "assignment" for everything. This matters
 * now that exam-prep pseudo-tasks flow through /schedule too: they arrive
 * with a priority_label already computed from the SAME base-tier table this
 * function would otherwise recompute (computeBaseTier(days, "exam")), so
 * re-running it with the wrong ("assignment") thresholds would silently
 * mis-tier them. Passing the real task_type through makes this a safe no-op
 * for exam entries (same table in, same table out) while staying exactly as
 * before for real assignments.
 */
export function applyPriorityEngineToScheduleResult(scheduleResult, from = new Date()) {
  if (!scheduleResult?.tasks) return scheduleResult;

  const tasks = Object.fromEntries(
    Object.entries(scheduleResult.tasks).map(([taskId, entry]) => {
      const taskType = entry.task_type || "assignment";
      const result = computeFinalPriorityFromDeadline(entry.deadline_date, taskType, entry.priority_label, from);
      return [taskId, { ...entry, priority_label: result.priorityLabel }];
    })
  );

  const overload_warning = (scheduleResult.overload_warning || []).map((w) => {
    const taskType = w.task_type || "assignment";
    const result = computeFinalPriorityFromDeadline(w.deadline_date, taskType, w.priority_label, from);
    return { ...w, priority_label: result.priorityLabel };
  });

  return { ...scheduleResult, tasks, overload_warning };
}
