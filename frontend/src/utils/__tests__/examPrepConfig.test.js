// Regression tests for the exam-prep escalation model (PROJECT CONTEXT.md
// Section 8a) - the performance-multiplier default was an explicit,
// deliberately-tested design decision (Part D verification) and the
// escalating curve is the core claim of Part C; both deserve permanent
// regression coverage.
import { describe, it, expect } from "vitest";
import {
  computeExamPrepHoursForDay,
  computePerformanceMultiplier,
  computeFinalBudgetHours,
  computeExamTypeBudgetMultiplier,
  EXAM_TYPE_BUDGET_MULTIPLIER,
  DEFAULT_EXAM_TYPE_MULTIPLIER,
  PERFORMANCE_MULTIPLIER,
  DEFAULT_TOTAL_BUDGET_HOURS,
} from "../examPrepConfig";

describe("computeExamPrepHoursForDay: escalating allocation as days-remaining decreases", () => {
  const examDate = "2026-09-28"; // 30 days from `today` below
  const today = "2026-08-29";
  const budget = 12;

  it("is non-decreasing as the evaluated day gets closer to the exam", () => {
    // Sample forDay across the whole runway from far out to the exam itself.
    const days = [];
    for (let d = 0; d <= 30; d++) {
      const forDay = new Date(`${today}T00:00:00`);
      forDay.setDate(forDay.getDate() + d);
      days.push(computeExamPrepHoursForDay(examDate, today, budget, forDay));
    }
    for (let i = 1; i < days.length; i++) {
      // Non-decreasing overall trend (allowed to be flat within a window,
      // since each window spreads its share evenly across its own days).
      expect(days[i]).toBeGreaterThanOrEqual(days[i - 1] - 1e-9);
    }
    // And strictly more on the last day (heavy window) than the first (light window).
    expect(days[days.length - 1]).toBeGreaterThan(days[0]);
  });

  it("the heavy window (0-6 days out) allocates more per-day than the light window (>14 days out)", () => {
    const forDayFar = new Date(`${today}T00:00:00`); // 30 days out - light window
    const forDayNear = new Date(`${today}T00:00:00`);
    forDayNear.setDate(forDayNear.getDate() + 25); // 5 days out - heavy window

    const farHours = computeExamPrepHoursForDay(examDate, today, budget, forDayFar);
    const nearHours = computeExamPrepHoursForDay(examDate, today, budget, forDayNear);
    expect(nearHours).toBeGreaterThan(farHours);
  });

  it("returns 0 for a day after the exam has already happened", () => {
    const forDayAfter = new Date(`${examDate}T00:00:00`);
    forDayAfter.setDate(forDayAfter.getDate() + 1);
    expect(computeExamPrepHoursForDay(examDate, today, budget, forDayAfter)).toBe(0);
  });
});

describe("computePerformanceMultiplier: no-data default (Part D explicit design decision)", () => {
  it("defaults to the BASELINE multiplier (1.0) when hasData is false, never WEAK or STRONG", () => {
    // The real-world case this guards: all 4 sample exam modules showed 0%
    // because no marks were recorded yet - that absence of data must never
    // be misread as "struggling" (1.4x) or, less dangerously but still
    // wrongly, "doing great" (0.75x).
    expect(computePerformanceMultiplier(0, false)).toBe(PERFORMANCE_MULTIPLIER.BASELINE_MULTIPLIER);
    expect(computePerformanceMultiplier(null, false)).toBe(PERFORMANCE_MULTIPLIER.BASELINE_MULTIPLIER);
    expect(computePerformanceMultiplier(undefined, false)).toBe(PERFORMANCE_MULTIPLIER.BASELINE_MULTIPLIER);
  });

  it("defaults to BASELINE when hasData is true but performance is null/undefined (defensive)", () => {
    expect(computePerformanceMultiplier(null, true)).toBe(PERFORMANCE_MULTIPLIER.BASELINE_MULTIPLIER);
  });
});

describe("computePerformanceMultiplier: documented threshold bands", () => {
  it("applies WEAK_MULTIPLIER (1.4) below 50", () => {
    expect(computePerformanceMultiplier(0, true)).toBe(1.4);
    expect(computePerformanceMultiplier(49, true)).toBe(1.4);
  });
  it("applies BASELINE_MULTIPLIER (1.0) for 50-70 inclusive", () => {
    expect(computePerformanceMultiplier(50, true)).toBe(1.0);
    expect(computePerformanceMultiplier(60, true)).toBe(1.0);
    expect(computePerformanceMultiplier(70, true)).toBe(1.0);
  });
  it("applies STRONG_MULTIPLIER (0.75) above 70", () => {
    expect(computePerformanceMultiplier(71, true)).toBe(0.75);
    expect(computePerformanceMultiplier(100, true)).toBe(0.75);
  });

  it("computeFinalBudgetHours scales the default budget correctly at each band", () => {
    expect(computeFinalBudgetHours(DEFAULT_TOTAL_BUDGET_HOURS, 1.4)).toBeCloseTo(16.8);
    expect(computeFinalBudgetHours(DEFAULT_TOTAL_BUDGET_HOURS, 1.0)).toBe(12);
    expect(computeFinalBudgetHours(DEFAULT_TOTAL_BUDGET_HOURS, 0.75)).toBe(9);
  });
});

describe("computeExamTypeBudgetMultiplier: real exam_type values (Section 17 re-scope)", () => {
  it("applies the documented multiplier for each real canonical exam_type", () => {
    expect(computeExamTypeBudgetMultiplier("final")).toBe(EXAM_TYPE_BUDGET_MULTIPLIER.final);
    expect(computeExamTypeBudgetMultiplier("mid")).toBe(EXAM_TYPE_BUDGET_MULTIPLIER.mid);
    expect(computeExamTypeBudgetMultiplier("lab")).toBe(EXAM_TYPE_BUDGET_MULTIPLIER.lab);
    expect(computeExamTypeBudgetMultiplier("quiz")).toBe(EXAM_TYPE_BUDGET_MULTIPLIER.quiz);
  });

  it("a final exam gets a strictly larger multiplier than a mid, lab, or quiz", () => {
    expect(computeExamTypeBudgetMultiplier("final")).toBeGreaterThan(computeExamTypeBudgetMultiplier("mid"));
    expect(computeExamTypeBudgetMultiplier("final")).toBeGreaterThan(computeExamTypeBudgetMultiplier("lab"));
    expect(computeExamTypeBudgetMultiplier("final")).toBeGreaterThan(computeExamTypeBudgetMultiplier("quiz"));
  });

  it("is case-insensitive", () => {
    expect(computeExamTypeBudgetMultiplier("FINAL")).toBe(EXAM_TYPE_BUDGET_MULTIPLIER.final);
    expect(computeExamTypeBudgetMultiplier("Mid")).toBe(EXAM_TYPE_BUDGET_MULTIPLIER.mid);
  });

  it("defaults to neutral (1.0) for an unrecognized or missing exam_type - the 'Exam' display placeholder must never skew the budget", () => {
    expect(computeExamTypeBudgetMultiplier("Exam")).toBe(DEFAULT_EXAM_TYPE_MULTIPLIER);
    expect(computeExamTypeBudgetMultiplier(undefined)).toBe(DEFAULT_EXAM_TYPE_MULTIPLIER);
    expect(computeExamTypeBudgetMultiplier(null)).toBe(DEFAULT_EXAM_TYPE_MULTIPLIER);
    expect(computeExamTypeBudgetMultiplier("")).toBe(DEFAULT_EXAM_TYPE_MULTIPLIER);
  });
});
