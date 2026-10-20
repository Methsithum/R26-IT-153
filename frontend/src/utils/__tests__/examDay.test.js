import { describe, it, expect } from "vitest";
import {
  examDayBlockedSlots,
  highPriorityTasksNearExam,
  scheduleHasExamDayItems,
  withExamDaysOccupied,
  examWeekdays,
  examClusters,
  clusterNeedsDecision,
  revisionSessionForExamDay,
  revisionCredits,
  applyRevisionCredit,
} from "../examDay";
import { buildExamPrepTasks, buildMultiWeekExamPrepTasks } from "../examPrepScheduling";
import { computeExamPrepHoursForDay } from "../examPrepConfig";

const NOW = new Date(2026, 9, 14, 9, 0); // Wednesday 2026-10-14
const exams = [
  { id: "e1", module: "os", moduleName: "Operating Systems", date: "2026-10-16", type: "mid" },
  { id: "e2", module: "db", moduleName: "Databases", date: "2026-10-16", type: "final" },
  { id: "old", module: "db", moduleName: "Databases", date: "2026-10-01", type: "quiz" },
];

describe("exam days are fully blocked", () => {
  it("one full-day block per today/future exam date, past exams ignored", () => {
    expect(examDayBlockedSlots(exams, NOW)).toEqual([{ date: "2026-10-16", start_time: "00:00", end_time: "23:59" }]);
  });

  it("missed-session suggestions see exam days as fully occupied", () => {
    expect(withExamDaysOccupied({ "2026-10-15": ["18:00-19:00"] }, exams)["2026-10-16"]).toEqual(["00:00-23:59"]);
  });

  it("finds the exam weekday inside a week", () => {
    const week = [12, 13, 14, 15, 16, 17, 18].map((d) => new Date(2026, 9, d));
    expect([...examWeekdays(week, exams)]).toEqual(["Friday"]);
  });

  it("flags a cached plan that still has sessions on an exam day", () => {
    const item = [{ time_slot: "18:00-19:00", task_id: "t", module: "os", duration_minutes: 60 }];
    expect(scheduleHasExamDayItems({ schedule: { Friday: item } }, "2026-10-14", exams, NOW)).toBe(true);
    expect(scheduleHasExamDayItems({ schedule: { Friday: [], Thursday: item } }, "2026-10-14", exams, NOW)).toBe(false);
  });
});

describe("highPriorityTasksNearExam", () => {
  const registry = {
    high: { priority_label: "High", task_type: "assignment", deadline_date: "2026-10-17", module: "os" },
    highFar: { priority_label: "High", task_type: "assignment", deadline_date: "2026-10-30", module: "os" },
    medium: { priority_label: "Medium", task_type: "assignment", deadline_date: "2026-10-16", module: "os" },
    prep: { priority_label: "High", task_type: "exam", deadline_date: "2026-10-16", module: "os" },
    done: { priority_label: "High", task_type: "assignment", deadline_date: "2026-10-16", module: "os" },
  };
  const assignments = [
    { taskId: "high", title: "TMA 2", status: "pending" },
    { taskId: "done", title: "TMA 1", status: "completed" },
  ];

  it("mentions only pending High-priority assignments due around the exam", () => {
    expect(highPriorityTasksNearExam("2026-10-16", registry, assignments)).toEqual([
      { taskId: "high", title: "TMA 2", deadlineDate: "2026-10-17" },
    ]);
  });
});

describe("back-to-back exams: after-exam revision", () => {
  // Exams on Sat 17, Sun 18, Mon 19 (+ a lone one on the 22nd).
  const cluster = (overrides = {}) => [
    { id: "a", module: "os", moduleName: "OS", date: "2026-10-17", examSession: "morning", afterExamRevision: true, ...overrides.a },
    { id: "b", module: "db", moduleName: "DB", date: "2026-10-18", examSession: "afternoon", afterExamRevision: true, ...overrides.b },
    { id: "c", module: "se", moduleName: "SE", date: "2026-10-19", examSession: "morning", afterExamRevision: true, ...overrides.c },
    { id: "d", module: "ai", moduleName: "AI", date: "2026-10-22", examSession: null, afterExamRevision: null },
  ];
  const slots = ["Saturday", "Sunday", "Monday"].flatMap((day) => [
    { day, start_time: "12:00", end_time: "16:00", duration_minutes: 240 },
    { day, start_time: "17:00", end_time: "20:00", duration_minutes: 180 },
  ]);

  it("finds only consecutive-day runs", () => {
    const clusters = examClusters(cluster(), NOW);
    expect(clusters.map((c) => c.dates)).toEqual([["2026-10-17", "2026-10-18", "2026-10-19"]]);
  });

  it("needs a decision until every exam has a time and a revision answer", () => {
    expect(clusterNeedsDecision(examClusters(cluster(), NOW)[0])).toBe(false);
    expect(clusterNeedsDecision(examClusters(cluster({ b: { examSession: null } }), NOW)[0])).toBe(true);
    expect(clusterNeedsDecision(examClusters(cluster({ c: { afterExamRevision: null } }), NOW)[0])).toBe(true);
  });

  it("morning exam (ends 12:00) -> revision from 13:00 for tomorrow's exam, capped at 2h", () => {
    const rev = revisionSessionForExamDay("2026-10-17", cluster(), slots);
    expect(rev.item).toEqual({ time_slot: "13:00-15:00", task_id: "exam-b", module: "db", duration_minutes: 120 });
    expect(rev.registryEntry.deadline_date).toBe("2026-10-18");
  });

  it("afternoon exam (ends 16:30) -> revision from 17:30", () => {
    expect(revisionSessionForExamDay("2026-10-18", cluster(), slots).item.time_slot).toBe("17:30-19:30");
  });

  it("no revision on the last exam day, when declined, or when the time is unknown", () => {
    expect(revisionSessionForExamDay("2026-10-19", cluster(), slots)).toBeNull();
    expect(revisionSessionForExamDay("2026-10-17", cluster({ a: { afterExamRevision: false } }), slots)).toBeNull();
    expect(revisionSessionForExamDay("2026-10-17", cluster({ a: { examSession: null } }), slots)).toBeNull();
  });

  it("no revision when the student has no free time left after the exam", () => {
    const morningOnly = [{ day: "Saturday", start_time: "07:00", end_time: "11:00", duration_minutes: 240 }];
    expect(revisionSessionForExamDay("2026-10-17", cluster(), morningOnly)).toBeNull();
  });

  it("revision hours are taken off the next exam's prep in the window that holds them", () => {
    const credits = revisionCredits(cluster(), slots, NOW);
    expect(credits).toEqual([
      { examId: "b", date: "2026-10-17", hours: 2 },
      { examId: "c", date: "2026-10-18", hours: 2 },
    ]);
    const tasks = [
      { task_id: "exam-b", estimated_hours_needed: 5, _meta: { examId: "b" } },
      { task_id: "exam-c-w0", estimated_hours_needed: 1.5, _meta: { examId: "c", weekIdx: 0 } },
      { task_id: "exam-c-w1", estimated_hours_needed: 3, _meta: { examId: "c", weekIdx: 1 } },
    ];
    expect(applyRevisionCredit(tasks, credits, NOW).map((t) => [t.task_id, t.estimated_hours_needed])).toEqual([
      ["exam-b", 3],
      ["exam-c-w1", 3], // w0 (1.5h - 2h) dropped; the 18th is in week 0, so w1 untouched
    ]);
  });
});

describe("exam prep never lands on the exam day", () => {
  const modules = [{ code: "os", currentGrade: 0, hasGradeData: false }];
  const oneExam = [{ id: "e1", module: "os", date: "2026-10-16", type: "mid" }];

  it("an exam today needs no prep task at all", () => {
    expect(buildExamPrepTasks([{ ...oneExam[0], date: "2026-10-14" }], modules, NOW)).toEqual([]);
  });

  it("keeps the exam day's share of hours, moved before the exam", () => {
    const [task] = buildExamPrepTasks(oneExam, modules, NOW);
    const budget = task._meta.finalBudgetHours;
    const curveTotal = [0, 1, 2].reduce(
      (sum, d) => sum + computeExamPrepHoursForDay("2026-10-16", NOW, budget, new Date(2026, 9, 14 + d)),
      0
    );
    expect(task.estimated_hours_needed).toBeCloseTo(Math.round(curveTotal * 4) / 4, 5);
  });

  it("back-to-back exams starting today: no prep task (no study day left), so no unfixable overload", () => {
    // Real case: exams Oct 16 (today), 17, 18, 19 - every day before each exam is an exam day.
    const today = new Date(2026, 9, 16, 10, 0);
    const cluster = ["2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19"].map((date, i) => ({
      id: `x${i}`, module: `m${i}`, date, type: "mid",
    }));
    const mods = cluster.map((e) => ({ code: e.module, currentGrade: 0, hasGradeData: false }));
    expect(buildExamPrepTasks(cluster, mods, today)).toEqual([]);
    expect(buildMultiWeekExamPrepTasks(cluster, mods, 12, today)).toEqual([]);
  });

  it("cluster later on: prep is still planned on the free days before it", () => {
    // Exams Oct 18, 19; today Oct 14 - the 14th-17th are free study days.
    const exams2 = [
      { id: "p", module: "m1", date: "2026-10-18", type: "mid" },
      { id: "q", module: "m2", date: "2026-10-19", type: "mid" },
    ];
    const mods = exams2.map((e) => ({ code: e.module, currentGrade: 0, hasGradeData: false }));
    const ids = buildExamPrepTasks(exams2, mods, NOW).map((t) => t.task_id);
    expect(ids).toEqual(["exam-p", "exam-q"]);
  });

  it("multi-week: a chunk holding only the exam day is dropped, its hours go to the week before", () => {
    // Exam exactly 7 days out: week 1 would only contain the exam day itself.
    const tasks = buildMultiWeekExamPrepTasks([{ ...oneExam[0], date: "2026-10-21" }], modules, 12, NOW);
    expect(tasks.map((t) => t.task_id)).toEqual(["exam-e1-w0"]);
  });
});
