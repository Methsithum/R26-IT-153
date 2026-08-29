// examPrepScheduling.js
//
// Bridges examPrepConfig.js's pure curve/multiplier math to this app's real
// data shapes (the store's `exams`/`modules` arrays) and turns each
// upcoming exam into a synthetic "exam-prep" TaskInput the /schedule
// endpoint already understands (task_type: "exam" - see PROJECT CONTEXT.md
// Section 5d's round-trip fix and Section 8's exam-prep subsection).
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
  computeFinalBudgetHours,
  performanceAdjustmentNote,
} from "./examPrepConfig";

// /schedule only ever carries ONE week of real free-slot capacity
// (weeklyFreeSlots), so this is how far ahead it's meaningful to request
// hours for in a single call - asking for an exam's full remaining budget
// here (which can span many weeks for a far-off exam) would just misreport
// as an overload_warning for hours that were never meant to happen yet.
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
 * Builds one exam-prep TaskInput per upcoming exam with real hours due THIS
 * scheduling window, or null (filtered out) for exams that have passed or
 * currently need 0 hours this week. `today` is injectable for testing.
 */
export function buildExamPrepTasks(exams, modules, today = new Date()) {
  return (exams || [])
    .map((exam) => {
      const examDays = daysRemaining(exam.date, today);
      if (examDays < 0) return null;

      const module = modules.find((m) => m.code === exam.module);
      const { performance, hasData } = resolveModulePerformance(module);
      const multiplier = computePerformanceMultiplier(performance, hasData);
      const finalBudgetHours = computeFinalBudgetHours(DEFAULT_TOTAL_BUDGET_HOURS, multiplier);

      const windowEnd = Math.min(examDays, SCHEDULING_WINDOW_DAYS);
      let thisWeekHours = 0;
      for (let d = 0; d <= windowEnd; d++) {
        const forDay = new Date(today);
        forDay.setDate(forDay.getDate() + d);
        thisWeekHours += computeExamPrepHoursForDay(exam.date, today, finalBudgetHours, forDay);
      }
      thisWeekHours = Math.round(thisWeekHours * 4) / 4; // round to nearest 15 minutes

      if (thisWeekHours <= 0) return null;

      const priorityLabel = LEVEL_TO_PRIORITY[computeBaseTier(examDays, "exam").level];

      return {
        task_id: `exam-${exam.id}`,
        module: exam.module,
        deadline_date: exam.date,
        weight: 100,
        estimated_hours_needed: thisWeekHours,
        priority_label: priorityLabel,
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
          daysRemaining: examDays,
          totalBudgetHours: DEFAULT_TOTAL_BUDGET_HOURS,
          performance,
          hasData,
          multiplier,
          finalBudgetHours,
          thisWeekHours,
          note: performanceAdjustmentNote(multiplier),
        },
      };
    })
    .filter(Boolean);
}

/** Strips the `_meta` debug field a TaskInput the API doesn't know about. */
export function toApiTaskInput(task) {
  const { _meta, ...apiTask } = task;
  return apiTask;
}
