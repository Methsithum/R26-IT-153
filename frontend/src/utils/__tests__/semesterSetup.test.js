import { describe, it, expect } from "vitest";
import { semesterFeaturesForSubject, applySemesterSetup, NORMAL_SEMESTER_CREDITS } from "../semesterSetup";
import { resolveExplanationDisplay } from "../priorityEngine";

const setup = {
  semester_start: "2026-08-03",
  semester_end: "2026-12-07", // 126 days = a normal semester
  registered_on: "2026-07-20", // 14 days before the start
  subjects: { OS: { credits: 4, prev_attempts: 1 }, DB: { credits: 16, prev_attempts: 0 } }, // 20 = normal load
};

describe("semesterFeaturesForSubject", () => {
  it("a normal semester maps onto the OULAD medians", () => {
    expect(semesterFeaturesForSubject(setup, "DB")).toEqual({
      module_presentation_length: 261,
      studied_credits: 60,
      date_registration: -14,
      num_of_prev_attempts: 0,
    });
  });

  it("repeat attempts are per subject", () => {
    expect(semesterFeaturesForSubject(setup, "OS").num_of_prev_attempts).toBe(1);
    expect(semesterFeaturesForSubject(setup, "Unknown").num_of_prev_attempts).toBe(0);
  });

  it("a heavier load scales up, and everything stays inside the training range", () => {
    const heavy = { ...setup, subjects: { A: { credits: NORMAL_SEMESTER_CREDITS * 2 } } };
    expect(semesterFeaturesForSubject(heavy, "A").studied_credits).toBe(120);
    const extreme = { ...setup, semester_end: "2027-07-30", subjects: { A: { credits: 400 } } };
    const f = semesterFeaturesForSubject(extreme, "A");
    expect(f.module_presentation_length).toBe(269);
    expect(f.studied_credits).toBe(240);
  });

  it("no setup -> null (keep neutral defaults); no credits entered -> neutral median", () => {
    expect(semesterFeaturesForSubject(null, "A")).toBeNull();
    expect(semesterFeaturesForSubject({ ...setup, subjects: {} }, "A").studied_credits).toBe(60);
  });
});

describe("applySemesterSetup", () => {
  const a = { taskId: "t", moduleName: "OS", featureRow: { date: 30, studied_credits: 60, num_of_prev_attempts: 0 } };

  it("writes the features in, flags the assignment, and is idempotent", () => {
    const first = applySemesterSetup([a], setup);
    expect(first.changed).toBe(true);
    expect(first.assignments[0]).toMatchObject({ hasSemesterData: true, featureRow: { date: 30, num_of_prev_attempts: 1 } });
    expect(applySemesterSetup(first.assignments, setup).changed).toBe(false);
  });
});

describe("explanations cite semester features only once they're real", () => {
  const explanation = { predicted_priority: "High", feature_contributions: { num_of_prev_attempts: 1.5, weight: 0.2 } };
  const final = { priorityLabel: "High", dominantMechanism: "ml" };
  it("hidden without setup, shown with it", () => {
    expect(resolveExplanationDisplay(final, 10, explanation, {}).contributions).not.toHaveProperty("num_of_prev_attempts");
    expect(resolveExplanationDisplay(final, 10, explanation, { hasSemesterData: true }).contributions).toHaveProperty("num_of_prev_attempts");
  });
});
