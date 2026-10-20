// @vitest-environment jsdom
//
// jsdom needed here (not the default node env) because importing
// useAcademicStore.js triggers zustand's `persist` middleware, which reads
// `localStorage` at store-creation time to rehydrate - unavailable under a
// plain Node environment. The other test files in this suite are pure
// functions with no such dependency and stay on the faster default env.
//
// Regression test for the v7 zustand-persist migration (useAcademicStore.js)
// that recomputes a stale featureRow.date for persisted assignments after
// the date-mapping-range fix (buildDateFeatureFromDeadline). Before this
// migration existed, an assignment persisted in localStorage before the fix
// would keep silently feeding the model an out-of-range `date` forever,
// since syncFromJournal only replaces `assignments` when the *set* of task
// ids changes, not when a value inside an unchanged task needed correcting.
import { describe, it, expect } from "vitest";
import { migrateAcademicStore } from "../useAcademicStore";
import {
  buildDateFeatureFromDeadline,
  NEUTRAL_FEATURE_DEFAULTS,
  DEFAULT_ASSIGNMENT_WEIGHT,
  UNKNOWN_MODULE_ENC,
} from "../../utils/featureNameMap";

function preMigrationState() {
  return {
    settings: { studyPreferences: { preferredStudyTimes: ["evening"], maxDailyStudyHours: 4 } },
    assignments: [
      {
        taskId: "task-1",
        deadlineDate: "2026-09-15",
        // Stale pre-fix value: a raw "days remaining" number (e.g. 17),
        // far below the model's trained range (12-261) - exactly the bug
        // buildDateFeatureFromDeadline was introduced to fix.
        featureRow: { date: 17, weight: 20 },
      },
      {
        taskId: "task-2",
        deadlineDate: null, // no real deadline yet - must be left alone, not crash
        featureRow: { date: 999, weight: 10 },
      },
    ],
    predictedPriorities: { "task-1": { priority_label: "Medium", confidence: 0.6 } },
    scheduleResponse: { schedule: {}, overload_warning: [], tasks: {} },
    todoList: [{ task_id: "task-1" }],
    notifications: [{ id: "n1" }],
  };
}

describe("migrateAcademicStore v7: recomputes stale featureRow.date", () => {
  it("recomputes date for every persisted assignment that has a real deadlineDate", () => {
    const migrated = migrateAcademicStore(preMigrationState(), 5);
    const task1 = migrated.assignments.find((a) => a.taskId === "task-1");
    const expected = buildDateFeatureFromDeadline("2026-09-15");
    expect(task1.featureRow.date).toBeCloseTo(expected);
    expect(task1.featureRow.date).not.toBe(17); // the stale, out-of-range value must be gone
    expect(task1.featureRow.date).toBeGreaterThanOrEqual(12);
    expect(task1.featureRow.date).toBeLessThanOrEqual(261);
  });

  it("leaves an assignment with no real deadlineDate untouched rather than crashing", () => {
    const migrated = migrateAcademicStore(preMigrationState(), 5);
    const task2 = migrated.assignments.find((a) => a.taskId === "task-2");
    expect(task2.featureRow.date).toBe(999); // unchanged, since there's no real deadline to recompute from
  });

  it("preserves other featureRow fields (e.g. weight) untouched", () => {
    const migrated = migrateAcademicStore(preMigrationState(), 5);
    const task1 = migrated.assignments.find((a) => a.taskId === "task-1");
    expect(task1.featureRow.weight).toBe(20);
  });

  it("clears every cache downstream of the old (potentially wrong) predicted priorities", () => {
    const migrated = migrateAcademicStore(preMigrationState(), 5);
    expect(migrated.predictedPriorities).toEqual({});
    expect(migrated.scheduleResponse).toBeNull();
    expect(migrated.todoList).toEqual([]);
  });

  it("is a no-op on the date-recompute step for a store already at version 7+", () => {
    const state = preMigrationState();
    const migrated = migrateAcademicStore(state, 7);
    // At version >= 7, the `version < 7` branch doesn't run, so a value that
    // would otherwise get "fixed" stays as the caller left it - confirms the
    // migration is version-gated, not unconditional.
    const task1 = migrated.assignments.find((a) => a.taskId === "task-1");
    expect(task1.featureRow.date).toBe(17);
  });

  it("returns null/undefined persisted state unchanged rather than throwing", () => {
    expect(migrateAcademicStore(null, 5)).toBeNull();
    expect(migrateAcademicStore(undefined, 5)).toBeUndefined();
  });
});

describe("migrateAcademicStore v9: neutral feature defaults + module-agnostic prediction", () => {
  const v8State = () => ({
    assignments: [
      {
        taskId: "journal-no-weight",
        hasRealWeight: false,
        weight: 20,
        featureRow: { date: 30, weight: 20, avg_weekly_clicks: 15, active_weeks_ratio: 0.5, code_module_enc: 3 },
      },
      { taskId: "real-weight", hasRealWeight: true, weight: 40, featureRow: { date: 30, weight: 40, code_module_enc: 1 } },
    ],
    predictedPriorities: { "journal-no-weight": { priority_label: "High" } },
    scheduleResponse: { schedule: {}, tasks: {} },
  });

  it("replaces placeholder features with training medians and the unknown-module sentinel", () => {
    const [noWeight] = migrateAcademicStore(v8State(), 8).assignments;
    expect(noWeight.featureRow).toMatchObject({
      ...NEUTRAL_FEATURE_DEFAULTS,
      weight: DEFAULT_ASSIGNMENT_WEIGHT,
      code_module_enc: UNKNOWN_MODULE_ENC,
      date: 30,
    });
    expect(noWeight.weight).toBe(DEFAULT_ASSIGNMENT_WEIGHT);
  });

  it("keeps a weight the student really entered", () => {
    const realWeight = migrateAcademicStore(v8State(), 8).assignments[1];
    expect(realWeight.weight).toBe(40);
    expect(realWeight.featureRow.weight).toBe(40);
  });

  it("drops cached predictions but only FLAGS the schedule (past days must be frozen first)", () => {
    const migrated = migrateAcademicStore(v8State(), 8);
    expect(migrated.predictedPriorities).toEqual({});
    expect(migrated.scheduleResponse).not.toBeNull();
    expect(migrated.scheduleStale).toBe(true);
  });
});
