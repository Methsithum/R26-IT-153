// Regression tests for buildWeeklyFreeSlots() - specifically the
// includeWeekends option (Settings' "Study on weekends" toggle), which
// still drives the real weekly_free_slots sent to /schedule even though
// the "Weekly Free Time" visual breakdown that first exposed the need for
// this option was later removed from the Settings page.
import { describe, it, expect } from "vitest";
import { buildWeeklyFreeSlots, FULL_STUDY_DAY_WINDOW } from "../freeSlotGenerator";

describe("buildWeeklyFreeSlots: includeWeekends", () => {
  it("defaults to true (all 7 days) when omitted - existing behavior unchanged", () => {
    const slots = buildWeeklyFreeSlots({ preferredStudyTimes: ["evening"], maxDailyStudyHours: 4 });
    const days = new Set(slots.map((s) => s.day));
    expect(days.size).toBe(7);
    expect(days.has("Saturday")).toBe(true);
    expect(days.has("Sunday")).toBe(true);
  });

  it("excludes Saturday and Sunday entirely when false", () => {
    const slots = buildWeeklyFreeSlots({ preferredStudyTimes: ["evening"], maxDailyStudyHours: 4, includeWeekends: false });
    const days = new Set(slots.map((s) => s.day));
    expect(days.size).toBe(5);
    expect(days.has("Saturday")).toBe(false);
    expect(days.has("Sunday")).toBe(false);
  });

  it("weekday slots are otherwise identical whether weekends are included or not", () => {
    const withWeekends = buildWeeklyFreeSlots({ preferredStudyTimes: ["morning", "night"], maxDailyStudyHours: 5, includeWeekends: true });
    const withoutWeekends = buildWeeklyFreeSlots({ preferredStudyTimes: ["morning", "night"], maxDailyStudyHours: 5, includeWeekends: false });
    const mondaySlots = (arr) => arr.filter((s) => s.day === "Monday");
    expect(mondaySlots(withoutWeekends)).toEqual(mondaySlots(withWeekends));
  });
});

describe("buildWeeklyFreeSlots: fullStudyDays", () => {
  it("gives a marked day the fixed 8h block instead of the normal preferred-time window", () => {
    const slots = buildWeeklyFreeSlots({ preferredStudyTimes: ["evening"], maxDailyStudyHours: 4, fullStudyDays: ["Saturday"] });
    const saturday = slots.filter((s) => s.day === "Saturday");
    expect(saturday).toHaveLength(1);
    expect(saturday[0]).toMatchObject({ start_time: FULL_STUDY_DAY_WINDOW.start, end_time: FULL_STUDY_DAY_WINDOW.end });

    const sunday = slots.filter((s) => s.day === "Sunday");
    expect(sunday[0].start_time).toBe("17:00"); // untouched, still the normal evening window
  });

  it("keeps a full study day even when includeWeekends is off - a specific day pick wins over the blanket toggle", () => {
    const slots = buildWeeklyFreeSlots({
      preferredStudyTimes: ["evening"],
      maxDailyStudyHours: 4,
      includeWeekends: false,
      fullStudyDays: ["Saturday"],
    });
    const days = new Set(slots.map((s) => s.day));
    expect(days.has("Saturday")).toBe(true); // explicitly picked, survives the weekend exclusion
    expect(days.has("Sunday")).toBe(false); // never picked, still excluded
  });

  it("defaults to no full study days when omitted", () => {
    const slots = buildWeeklyFreeSlots({ preferredStudyTimes: ["evening"], maxDailyStudyHours: 4 });
    expect(slots.every((s) => s.start_time === "17:00")).toBe(true);
  });
});
