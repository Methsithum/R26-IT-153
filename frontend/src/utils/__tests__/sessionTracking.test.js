import { describe, it, expect } from "vitest";
import {
  sessionKey,
  toSessionInput,
  buildOccupiedByDate,
  extraRecordsForDate,
} from "../sessionTracking";

const item = { time_slot: "18:00-19:30", task_id: "t1", module: "os", duration_minutes: 90 };

describe("toSessionInput", () => {
  it("carries task_type and deadline from the schedule's task registry", () => {
    expect(toSessionInput("2026-10-14", item, { t1: { task_type: "exam", deadline_date: "2026-10-20" } })).toEqual({
      date: "2026-10-14",
      time_slot: "18:00-19:30",
      task_id: "t1",
      module: "os",
      duration_minutes: 90,
      task_type: "exam",
      deadline_date: "2026-10-20",
    });
  });

  it("falls back to an assignment with no deadline when the registry doesn't know the task", () => {
    const input = toSessionInput("2026-10-14", item, {});
    expect(input.task_type).toBe("assignment");
    expect(input.deadline_date).toBeNull();
  });
});

describe("buildOccupiedByDate", () => {
  // Wednesday 14 Oct 2026, local time.
  const now = new Date(2026, 9, 14, 12, 0);

  it("this week: today..Sunday from the live weekday-keyed schedule", () => {
    const scheduleResponse = { schedule: { Wednesday: [item], Sunday: [{ ...item, time_slot: "09:00-10:00" }], Monday: [item] } };
    expect(buildOccupiedByDate("this", { scheduleResponse }, now)).toEqual({
      "2026-10-14": ["18:00-19:30"],
      "2026-10-18": ["09:00-10:00"],
    });
  });

  it("next week: next Monday..Sunday from the ISO-date-keyed multi-week schedule", () => {
    const multiWeekSchedule = { schedule: { "2026-10-19": [item], "2026-10-26": [item], "2026-10-15": [item] } };
    expect(buildOccupiedByDate("next", { multiWeekSchedule }, now)).toEqual({ "2026-10-19": ["18:00-19:30"] });
  });
});

describe("extraRecordsForDate", () => {
  const record = (overrides) => ({
    date: "2026-10-14",
    task_id: "t1",
    time_slot: "18:00-19:30",
    status: "pending",
    source: "schedule",
    ...overrides,
  });
  const byKey = (records) => Object.fromEntries(records.map((r) => [sessionKey(r.date, r.task_id, r.time_slot), r]));

  it("does not duplicate a session the plan already shows", () => {
    expect(extraRecordsForDate("2026-10-14", [item], byKey([record({ status: "done" })]))).toEqual([]);
  });

  it("adds manual reschedules and marked sessions a regeneration moved, but not stale pending ones", () => {
    const manual = record({ time_slot: "20:00-21:30", source: "manual_reschedule" });
    const markedMoved = record({ time_slot: "07:00-08:00", status: "missed" });
    const stalePending = record({ time_slot: "12:00-13:00" });
    const otherDay = record({ date: "2026-10-15", source: "manual_reschedule" });
    const extras = extraRecordsForDate("2026-10-14", [item], byKey([manual, markedMoved, stalePending, otherDay]));
    expect(extras.map((r) => r.time_slot).sort()).toEqual(["07:00-08:00", "20:00-21:30"]);
  });
});
