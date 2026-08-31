// @vitest-environment jsdom
//
// jsdom needed here for the same reason as useAcademicStore.migration.test.js -
// importing useAcademicStore.js triggers zustand's `persist` middleware,
// which reads `localStorage` at store-creation time.
//
// Regression test for the "past days silently reset on regeneration" bug:
// generate_rolling_schedule() (and the single-week /schedule endpoint) have
// no persisted memory of what a past calendar date actually held - every
// call recomputes purely from current tasks/free-time. Left unfixed, a
// student who saw real content for a day could reload later and find that
// day showing something different (or empty), because nothing durable ever
// recorded what was genuinely shown. freezePastDates() (useAcademicStore.js,
// Section 8e) is the fix: once a date slips into the past, its last-known
// content is captured into historicalScheduleByDate and never touched again.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAcademicStore } from "../useAcademicStore";

function resetScheduleState() {
  useAcademicStore.setState({
    scheduleResponse: null,
    scheduleGeneratedDate: null,
    multiWeekSchedule: null,
    historicalScheduleByDate: {},
  });
}

describe("freezePastDates (Section 8e - historical schedule persistence)", () => {
  beforeEach(() => {
    vi.useRealTimers();
    resetScheduleState();
  });

  it("freezes a date's content the moment it becomes past, and a later regeneration with different output cannot alter the frozen record", () => {
    // "Today" is 2026-08-29 (a Saturday) when the schedule is first generated.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-29T09:00:00"));

    const originalSchedule = {
      schedule: {
        Saturday: [{ time_slot: "18:00-19:00", task_id: "t1", module: "AAA", duration_minutes: 60 }],
      },
      overload_warning: [],
      tasks: { t1: { module: "AAA", priority_label: "High", deadline_date: "2026-09-01", estimated_hours_needed: 3 } },
    };
    useAcademicStore.getState().setSchedule(originalSchedule);
    expect(useAcademicStore.getState().scheduleGeneratedDate).toBe("2026-08-29");
    // Not yet past (it's still "today") - nothing frozen yet.
    expect(useAcademicStore.getState().historicalScheduleByDate["2026-08-29"]).toBeUndefined();

    // A real day passes without the schedule being touched in between.
    vi.setSystemTime(new Date("2026-08-30T09:00:00"));

    // The live algorithm has since evolved (e.g. new tasks, different free
    // time) and would now produce something completely different if 2026-08-29
    // were recomputed fresh - this is exactly what must NOT reach the frozen
    // record for that date.
    const laterSchedule = {
      schedule: {
        Sunday: [{ time_slot: "10:00-11:00", task_id: "t2", module: "BBB", duration_minutes: 90 }],
      },
      overload_warning: [],
      tasks: { t2: { module: "BBB", priority_label: "Low", deadline_date: "2026-09-05", estimated_hours_needed: 2 } },
    };
    useAcademicStore.getState().setSchedule(laterSchedule);

    const frozen = useAcademicStore.getState().historicalScheduleByDate["2026-08-29"];
    expect(frozen).toBeDefined();
    expect(frozen.sessions).toEqual(originalSchedule.schedule.Saturday);
    expect(frozen.tasksRegistry).toEqual(originalSchedule.tasks);
    expect(frozen.source).toBe("scheduleResponse");

    // Yet another regeneration (e.g. "Regenerate Plan" clicked again, or a
    // /reschedule call) with still more different content must still leave
    // the already-frozen 2026-08-29 record completely untouched.
    useAcademicStore.getState().setSchedule({
      schedule: { Sunday: [] },
      overload_warning: [],
      tasks: {},
    });
    expect(useAcademicStore.getState().historicalScheduleByDate["2026-08-29"]).toEqual(frozen);

    vi.useRealTimers();
  });

  it("freezes every now-past date already covered by multiWeekSchedule, including genuinely empty days, without disturbing dates scheduleResponse already claimed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-29T09:00:00"));

    useAcademicStore.getState().setSchedule({
      schedule: { Saturday: [{ time_slot: "18:00-19:00", task_id: "t1", module: "AAA", duration_minutes: 60 }] },
      overload_warning: [],
      tasks: { t1: { module: "AAA", priority_label: "High" } },
    });
    useAcademicStore.getState().setMultiWeekSchedule({
      schedule: {
        "2026-08-29": [{ time_slot: "18:00-19:00", task_id: "SHOULD-NOT-WIN", module: "ZZZ", duration_minutes: 60 }],
        "2026-08-30": [], // a genuinely free day - must still be captured as a real record, not left unfrozen
      },
      overload_warning: [],
      tasks: {},
      weeks_generated: 1,
      range_start: "2026-08-29",
      range_end: "2026-09-04",
    });

    // Three real days pass.
    vi.setSystemTime(new Date("2026-09-01T09:00:00"));
    // Any store write that funnels through setSchedule/setMultiWeekSchedule
    // triggers freezePastDates() - simulate the next regeneration.
    useAcademicStore.getState().setMultiWeekSchedule({
      schedule: { "2026-09-01": [] },
      overload_warning: [],
      tasks: {},
      weeks_generated: 1,
      range_start: "2026-09-01",
      range_end: "2026-09-07",
    });

    const historical = useAcademicStore.getState().historicalScheduleByDate;

    // scheduleResponse's version of 2026-08-29 wins over multiWeekSchedule's
    // conflicting entry for the same date (scheduleResponse is the more
    // authoritative, /reschedule-integrated source for "today at generation time").
    expect(historical["2026-08-29"].source).toBe("scheduleResponse");
    expect(historical["2026-08-29"].sessions[0].task_id).toBe("t1");

    // 2026-08-30 was never claimed by scheduleResponse, so multiWeekSchedule's
    // (empty) record is frozen as a genuine "nothing scheduled" day.
    expect(historical["2026-08-30"]).toBeDefined();
    expect(historical["2026-08-30"].sessions).toEqual([]);
    expect(historical["2026-08-30"].source).toBe("multiWeekSchedule");

    vi.useRealTimers();
  });

  it("does not freeze today or future dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-29T09:00:00"));

    useAcademicStore.getState().setSchedule({
      schedule: { Saturday: [{ time_slot: "18:00-19:00", task_id: "t1", module: "AAA", duration_minutes: 60 }] },
      overload_warning: [],
      tasks: {},
    });
    useAcademicStore.getState().setMultiWeekSchedule({
      schedule: { "2026-08-29": [], "2026-08-30": [], "2026-09-01": [] },
      overload_warning: [],
      tasks: {},
      weeks_generated: 1,
      range_start: "2026-08-29",
      range_end: "2026-09-04",
    });

    expect(useAcademicStore.getState().historicalScheduleByDate).toEqual({});

    vi.useRealTimers();
  });
});
