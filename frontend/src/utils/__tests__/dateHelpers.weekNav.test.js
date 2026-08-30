import { describe, it, expect } from "vitest";
import { getWeekStart, addDays, formatWeekRangeLabel, toLocalDateStr } from "../dateHelpers";

describe("getWeekStart (Monday-start week, for Week view navigation)", () => {
  it("returns the same Monday when given a Monday", () => {
    const monday = new Date(2026, 7, 31); // Aug 31, 2026 is a Monday
    expect(toLocalDateStr(getWeekStart(monday))).toBe("2026-08-31");
  });

  it("returns the prior Monday for a mid-week date", () => {
    const wednesday = new Date(2026, 8, 2); // Sep 2, 2026 (Wednesday)
    expect(toLocalDateStr(getWeekStart(wednesday))).toBe("2026-08-31");
  });

  it("returns the prior Monday for a Sunday (wraps back, not forward)", () => {
    const sunday = new Date(2026, 8, 6); // Sep 6, 2026 (Sunday)
    expect(toLocalDateStr(getWeekStart(sunday))).toBe("2026-08-31");
  });
});

describe("addDays", () => {
  it("adds positive days", () => {
    expect(toLocalDateStr(addDays(new Date(2026, 7, 31), 6))).toBe("2026-09-06");
  });
  it("adds negative days (subtracts)", () => {
    expect(toLocalDateStr(addDays(new Date(2026, 7, 31), -7))).toBe("2026-08-24");
  });
  it("rolls over a month boundary", () => {
    expect(toLocalDateStr(addDays(new Date(2026, 7, 31), 1))).toBe("2026-09-01");
  });
});

describe("formatWeekRangeLabel", () => {
  it("formats a week within one month", () => {
    expect(formatWeekRangeLabel(new Date(2026, 8, 1))).toBe("Sep 1 - 7");
  });
  it("formats a week crossing a month boundary", () => {
    expect(formatWeekRangeLabel(new Date(2026, 8, 28))).toBe("Sep 28 - Oct 4");
  });
});
