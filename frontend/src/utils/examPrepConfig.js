// examPrepConfig.js
//
// PROJECT CONTEXT.md Section 8 (exam-prep subsection). Defines how much
// study time an upcoming exam should receive, and WHEN it should happen -
// escalating as the exam approaches (Part C), scaled by the student's real
// performance in that module (Part D). Pure functions only - no React, no
// store access - so both the frontend scheduling call site and a future
// backend port can reuse the exact same numbers without duplicating them.

import { daysRemaining } from "./dateHelpers";

// --- Part C: escalating total-hours budget -----------------------------

/** Default total study-hours budget for one exam, before the Part D performance multiplier. */
export const DEFAULT_TOTAL_BUDGET_HOURS = 12;

// The escalation curve partitions the total budget into three windows by
// days-remaining-until-the-exam, each getting a fixed SHARE of the total,
// spread evenly across the days that fall in that window. Concentrating the
// back half of the budget into the final week (and over a third of that
// into the final 6 days) mirrors ordinary study advice - light early
// familiarization, heavier review as material firms up, heaviest,
// most-concentrated practice/recall work right before the exam - without
// hand-picking hours per day, which wouldn't generalize across different
// total budgets (Part D scales the total, and this curve must scale with it).
export const EXAM_PREP_CURVE = [
  // { minDays, maxDays, shareOfBudget } - maxDays: null means unbounded.
  { minDays: 15, maxDays: null, shareOfBudget: 0.15 }, // >14 days out: light, thin spread
  { minDays: 7, maxDays: 14, shareOfBudget: 0.35 }, // 7-14 days out: moderate
  { minDays: 0, maxDays: 6, shareOfBudget: 0.5 }, // 0-6 days out ("heavy window"): concentrated
];

// Any exam-prep task whose days-remaining falls at or below this threshold
// competes for slots at (at least) High priority regardless of its nominal
// priority_label - see buildExamPrepTasks() in examPrepScheduling.js. Kept
// as a named constant rather than a repeated literal "6" so Part C's "heavy
// allocation window" has one authoritative definition.
export const EXAM_PREP_HEAVY_WINDOW_DAYS = 6;

function curveWindowFor(days) {
  return EXAM_PREP_CURVE.find((w) => days >= w.minDays && (w.maxDays == null || days <= w.maxDays));
}

/**
 * Hours that SHOULD be studied for this exam on one specific day, given how
 * many days that day is from the exam. Distributes each window's share
 * evenly across the real number of days that fall in that window for THIS
 * exam (e.g. an exam only 10 days out never reaches the >14-day window at
 * all, so the moderate window absorbs whatever of its own days are
 * available - the three shares still sum to `totalBudgetHours` when
 * integrated across an exam's full runway from far out to the exam date).
 *
 * examDate/today: ISO "YYYY-MM-DD" strings (or Date objects - daysRemaining
 * handles either). `forDay` is the day being evaluated (also ISO or Date) -
 * defaults to `today` itself.
 */
export function computeExamPrepHoursForDay(examDate, today, totalBudgetHours, forDay = today) {
  const daysFromForDayToExam = daysRemaining(examDate, forDay instanceof Date ? forDay : new Date(`${forDay}T00:00:00`));
  if (daysFromForDayToExam < 0) return 0; // exam already passed relative to forDay

  const window = curveWindowFor(daysFromForDayToExam);
  if (!window) return 0;

  // How many days of runway does THIS exam actually have inside this
  // window, counted from `today`? (today's own window included even if
  // today is not day 0, since we're asking "how much of this window's
  // budget lands on forDay specifically".)
  const examDays = daysRemaining(examDate, today instanceof Date ? today : new Date(`${today}T00:00:00`));
  if (examDays < 0) return 0;

  const windowLo = window.minDays;
  const windowHi = window.maxDays == null ? examDays : Math.min(window.maxDays, examDays);
  const daysInWindow = Math.max(1, windowHi - windowLo + 1);

  const windowBudget = totalBudgetHours * window.shareOfBudget;
  return windowBudget / daysInWindow;
}

// --- exam_type-based budget multiplier ----------------------------------
//
// The real Exam schema (owned by the Journal/task-tracking component, see
// PROJECT CONTEXT.md Section 17) carries a real `exam_type` field with a
// fixed, canonical value set (backend/app/services/journal/journal_constants.py:
// EXAM_KINDS = {"mid", "final", "lab", "quiz"}) that this module previously
// never read - every exam got the same DEFAULT_TOTAL_BUDGET_HOURS regardless
// of type. That's a real gap: a final plausibly covers a full semester's
// material and warrants more total prep than a narrow-scope lab test or quiz.
// Multiplier applied to the base budget BEFORE the Part D performance
// multiplier (both are independent scaling factors on the same base number -
// order doesn't matter mathematically, multiplication is commutative, but
// exam-type is applied first here since it's the more "structural" of the
// two). An unrecognized/missing exam_type (e.g. the "Exam" placeholder
// MonthGrid.jsx/useAcademicStore.js use when the real field is blank) gets
// the neutral 1.0 multiplier - same "don't penalize/reward absent data"
// principle as the performance multiplier below, not a fixed guess.
export const EXAM_TYPE_BUDGET_MULTIPLIER = {
  final: 1.3, // typically cumulative/full-syllabus scope - more material to cover
  mid: 1.0, // baseline - the number DEFAULT_TOTAL_BUDGET_HOURS was chosen around
  lab: 0.6, // narrower, usually practical/applied scope
  quiz: 0.5, // narrowest scope, lowest stakes
};
export const DEFAULT_EXAM_TYPE_MULTIPLIER = 1.0;

/** examType: the real `exam_type` value ("mid"/"final"/"lab"/"quiz"), case-insensitive; anything else -> neutral 1.0. */
export function computeExamTypeBudgetMultiplier(examType) {
  const key = String(examType || "").trim().toLowerCase();
  return EXAM_TYPE_BUDGET_MULTIPLIER[key] ?? DEFAULT_EXAM_TYPE_MULTIPLIER;
}

// --- Part D: performance-based multiplier -------------------------------

export const PERFORMANCE_MULTIPLIER = {
  WEAK_THRESHOLD: 50, // performance < 50 -> struggling, needs more time
  STRONG_THRESHOLD: 70, // performance > 70 -> comfortable, needs less time
  WEAK_MULTIPLIER: 1.4,
  BASELINE_MULTIPLIER: 1.0,
  STRONG_MULTIPLIER: 0.75,
};

/**
 * performance: 0-100 module average (see resolveModulePerformance() in
 * examPrepScheduling.js for where this number actually comes from - reuses
 * the same `module.currentGrade`/`hasGradeData` the rest of the app already
 * computes, not a new metric).
 * hasData: false means no marks recorded yet for this module - MUST default
 * to the baseline multiplier, never penalize/reward on absent data (a 0%
 * placeholder for "no marks yet" must never be read as "failing").
 */
export function computePerformanceMultiplier(performance, hasData) {
  if (!hasData || performance == null) return PERFORMANCE_MULTIPLIER.BASELINE_MULTIPLIER;
  if (performance < PERFORMANCE_MULTIPLIER.WEAK_THRESHOLD) return PERFORMANCE_MULTIPLIER.WEAK_MULTIPLIER;
  if (performance > PERFORMANCE_MULTIPLIER.STRONG_THRESHOLD) return PERFORMANCE_MULTIPLIER.STRONG_MULTIPLIER;
  return PERFORMANCE_MULTIPLIER.BASELINE_MULTIPLIER;
}

/** finalBudgetHours = baseTotalBudgetHours * performanceMultiplier, fed into the Part C curve exactly as before. */
export function computeFinalBudgetHours(baseTotalBudgetHours, performanceMultiplier) {
  return baseTotalBudgetHours * performanceMultiplier;
}

/**
 * Supportive, non-alarming note (PROJECT CONTEXT.md Section 10) shown only
 * when the adjustment meaningfully changed the allocation - i.e. only the
 * "extra time" case, never a "you need less time" framing (which would risk
 * reading as a judgment) and never shown at all for the baseline multiplier
 * or for the no-data case (nothing meaningfully changed there).
 */
export function performanceAdjustmentNote(multiplier) {
  if (multiplier === PERFORMANCE_MULTIPLIER.WEAK_MULTIPLIER) {
    return "Extra prep time added based on your current performance in this module.";
  }
  return null;
}
