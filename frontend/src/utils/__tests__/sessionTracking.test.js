import { describe, it, expect } from "vitest";
import {
  sessionKey,
  toSessionInput,
  buildOccupiedByDate,
  extraRecordsForDate,
  dropOverlappingItems,
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

describe("dropOverlappingItems", () => {
  const date = "2026-10-19";
  const plan = (task_id, time_slot) => ({ task_id, time_slot, module: "m", duration_minutes: 60 });
  const marked = (task_id, time_slot, extra = {}) => ({ date, task_id, time_slot, status: "done", source: "schedule", ...extra });

  it("keeps one session per overlapping slot, preferring the one the student marked", () => {
    const items = [plan("a", "07:00-10:00"), plan("b", "07:00-08:45"), plan("c", "20:30-23:30"), plan("d", "20:30-23:30")];
    const records = { [sessionKey(date, "b", "07:00-08:45")]: marked("b", "07:00-08:45") };
    expect(dropOverlappingItems(date, items, records).map((i) => i.task_id)).toEqual(["b", "c"]);
  });

  it("leaves back-to-back sessions alone", () => {
    const items = [plan("a", "07:00-08:45"), plan("b", "08:45-09:15"), plan("c", "09:15-10:00")];
    expect(dropOverlappingItems(date, items, {})).toEqual(items);
  });

  it("a manual reschedule beats an unmarked plan session", () => {
    const items = [plan("a", "18:00-19:00"), plan("b", "18:30-19:30")];
    const records = { [sessionKey(date, "b", "18:30-19:30")]: { ...marked("b", "18:30-19:30"), status: "pending", source: "manual_reschedule" } };
    expect(dropOverlappingItems(date, items, records).map((i) => i.task_id)).toEqual(["b"]);
  });
});
