// examPrepScheduling.js
//
// Bridges examPrepConfig.js's pure curve/multiplier math to this app's real
// data shapes (the store's `exams`/`modules` arrays) and turns each
// upcoming exam into synthetic "exam-prep" TaskInput(s) the /schedule (or
// /multi-week-schedule) endpoint already understands (task_type: "exam" -
// see PROJECT CONTEXT.md Section 5d's round-trip fix and Section 8's
// exam-prep subsection).
//
// Exams deliberately never go through /predict-priority (MonthGrid.jsx:
// "never get an ML priority" - there's no real per-exam feature row to feed
// it), so their priority_label is computed directly from days-remaining via
// priorityEngine.js's existing exam base-tier thresholds - the SAME
// centralized rule table Section 5d already established, not a second
// parallel priority system.

import { daysRemaining } from "./dateHelpers";
import { computeBaseTier, LEVEL_TO_PRIORITY } from "./priorityEngine";
import {
  DEFAULT_TOTAL_BUDGET_HOURS,
  computeExamPrepHoursForDay,
  computePerformanceMultiplier,
  computeExamTypeBudgetMultiplier,
  computeFinalBudgetHours,
  performanceAdjustmentNote,
} from "./examPrepConfig";

// The single-week /schedule call only ever carries ONE week of real
// free-slot capacity, so this is how far ahead it's meaningful to request
// hours for in that call - asking for an exam's full remaining budget here
// (which can span many weeks for a far-off exam) would just misreport as an
// overload_warning for hours that were never meant to happen yet. The
// multi-week builder below (buildMultiWeekExamPrepTasks) doesn't have this
// limitation - it chunks per real week instead.
const SCHEDULING_WINDOW_DAYS = 6;

/**
 * Real performance signal for Part D - reuses module.currentGrade/
 * hasGradeData EXACTLY as already computed in useAcademicStore.js's
 * buildFromJournal (an average of the real `mark` field across that
 * subject's tasks AND exams, with hasGradeData=false when nothing's
 * recorded yet). No duplicate averaging logic here.
 */
export function resolveModulePerformance(module) {
  return { performance: module?.currentGrade ?? null, hasData: !!module?.hasGradeData };
}

/**
 * The per-exam budget/priority computation shared by both the single-week
 * and multi-week task builders below - factored out so neither duplicates
 * the performance-multiplier / exam-type-multiplier / priority-tier logic.
 */
function resolveExamPrepBudget(exam, modules, examDays) {
  const module = modules.find((m) => m.code === exam.module);
  const { performance, hasData } = resolveModulePerformance(module);
  const multiplier = computePerformanceMultiplier(performance, hasData);
  // exam.type carries the real `exam_type` field ("mid"/"final"/"lab"/
  // "quiz" - see useAcademicStore.js's mappedExams) or the "Exam" display
  // placeholder when genuinely blank - computeExamTypeBudgetMultiplier
  // treats anything it doesn't recognize as neutral (1.0), so that
  // placeholder never accidentally skews the budget.
  const examTypeMultiplier = computeExamTypeBudgetMultiplier(exam.type);
  const baseBudgetForType = DEFAULT_TOTAL_BUDGET_HOURS * examTypeMultiplier;
  const finalBudgetHours = computeFinalBudgetHours(baseBudgetForType, multiplier);
  const priorityLabel = LEVEL_TO_PRIORITY[computeBaseTier(examDays, "exam").level];
  return { performance, hasData, multiplier, examTypeMultiplier, finalBudgetHours, priorityLabel };
}

function hoursForWindow(examDate, today, finalBudgetHours, windowStartDay, windowEndDay) {
  let hours = 0;
  for (let d = windowStartDay; d <= windowEndDay; d++) {
    const forDay = new Date(today);
    forDay.setDate(forDay.getDate() + d);
    hours += computeExamPrepHoursForDay(examDate, today, finalBudgetHours, forDay);
  }
  return Math.round(hours * 4) / 4; // round to nearest 15 minutes
}

/**
 * Builds one exam-prep TaskInput per upcoming exam with real hours due THIS
 * scheduling window (single-week /schedule), or null (filtered out) for
 * exams that have passed or currently need 0 hours this week. `today` is
 * injectable for testing.
 */
export function buildExamPrepTasks(exams, modules, today = new Date()) {
  return (exams || [])
    .map((exam) => {
      const examDays = daysRemaining(exam.date, today);
      if (examDays < 0) return null;

      const budget = resolveExamPrepBudget(exam, modules, examDays);
      const windowEnd = Math.min(examDays, SCHEDULING_WINDOW_DAYS);
      const thisWeekHours = hoursForWindow(exam.date, today, budget.finalBudgetHours, 0, windowEnd);
      if (thisWeekHours <= 0) return null;

      return {
        task_id: `exam-${exam.id}`,
        module: exam.module,
        deadline_date: exam.date,
        weight: 100,
        estimated_hours_needed: thisWeekHours,
        priority_label: budget.priorityLabel,
        task_type: "exam",
        // Debug/UI metadata - NOT part of the TaskInput schema, stripped
        // before the request leaves useWeeklySchedule() (see
        // useAcademicData.js). Kept here so the same computation can also
        // drive the Exams page's performance-adjustment note without
        // re-deriving it.
        _meta: {
          examId: exam.id,
          moduleCode: exam.module,
          moduleName: exam.moduleName,
          examType: exam.type,
          examTypeMultiplier: budget.examTypeMultiplier,
          daysRemaining: examDays,
          totalBudgetHours: DEFAULT_TOTAL_BUDGET_HOURS,
          performance: budget.performance,
          hasData: budget.hasData,
          multiplier: budget.multiplier,
          finalBudgetHours: budget.finalBudgetHours,
          thisWeekHours,
          note: performanceAdjustmentNote(budget.multiplier),
        },
      };
    })
    .filter(Boolean);
}

/**
 * Multi-week counterpart of buildExamPrepTasks(): one TaskInput PER (exam,
 * week) pair covering that specific week's slice of the exam's escalating
 * curve - e.g. "exam-<id>-w0" (light, far out), "exam-<id>-w1" (heavier,
 * closer) - rather than one task capped to a single week's hours. This is
 * deliberately still 100% client-side curve computation (examPrepConfig.js,
 * unchanged) - the backend's generate_rolling_schedule() has NO special
 * knowledge of exam-prep escalation at all; it just applies its ordinary,
 * generic backlog-carryover logic to each week's chunk like any other task
 * (see PROJECT CONTEXT.md Section 8d). If week 0's light chunk doesn't fully
 * fit, the SAME carryover mechanism lets it spill into week 1 alongside
 * week 1's own heavier chunk automatically - no special-casing needed here
 * or in the backend for that case.
 *
 * weeksAhead: how many weeks the multi-week request is covering (the caller
 * already knows this - see useMultiWeekSchedule()). Chunks are only built
 * up to and including the week containing the exam itself; nothing is
 * generated for weeks after the exam has already happened.
 */
export function buildMultiWeekExamPrepTasks(exams, modules, weeksAhead, today = new Date()) {
  const tasks = [];
  for (const exam of exams || []) {
    const examDays = daysRemaining(exam.date, today);
    if (examDays < 0) continue;

    const budget = resolveExamPrepBudget(exam, modules, examDays);
    const lastRelevantWeek = Math.min(Math.floor(examDays / 7), weeksAhead - 1);

    for (let weekIdx = 0; weekIdx <= lastRelevantWeek; weekIdx++) {
      const windowStart = weekIdx * 7;
      const windowEnd = Math.min(examDays, windowStart + 6);
      if (windowEnd < windowStart) continue;
      const weekHours = hoursForWindow(exam.date, today, budget.finalBudgetHours, windowStart, windowEnd);
      if (weekHours <= 0) continue;

      tasks.push({
        task_id: `exam-${exam.id}-w${weekIdx}`,
        module: exam.module,
        deadline_date: exam.date,
        weight: 100,
        estimated_hours_needed: weekHours,
        priority_label: budget.priorityLabel,
        task_type: "exam",
        _meta: {
          examId: exam.id,
          moduleCode: exam.module,
          moduleName: exam.moduleName,
          examType: exam.type,
          weekIdx,
          daysRemaining: examDays,
          totalBudgetHours: DEFAULT_TOTAL_BUDGET_HOURS,
          finalBudgetHours: budget.finalBudgetHours,
          weekHours,
          note: performanceAdjustmentNote(budget.multiplier),
        },
      });
    }
  }
  return tasks;
}

/** Strips the `_meta` debug field a TaskInput the API doesn't know about. */
export function toApiTaskInput(task) {
  const { _meta, ...apiTask } = task;
  return apiTask;
}
