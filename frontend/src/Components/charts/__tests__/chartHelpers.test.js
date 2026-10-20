import { describe, expect, it } from "vitest";
import {
  binValues,
  correlationCaption,
  formatMinutes,
  formatNumber,
  formatPercent,
  heatmapWeeks,
  isoWeekday,
  mostActiveWeekdayCaption,
  niceTicks,
  pngExportSize,
  subjectCaption,
  trendCaption,
  weekStartIso,
} from "../chartHelpers";

describe("niceTicks", () => {
  it("produces round numbers spanning the range", () => {
    const ticks = niceTicks(0, 97, 4);
    expect(ticks[0]).toBeLessThanOrEqual(0);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(97);
  });

  it("never throws on degenerate input", () => {
    expect(niceTicks(5, 5)).toEqual([0]);
    expect(niceTicks(NaN, 10)).toEqual([0]);
  });
});

describe("formatters", () => {
  it("formatNumber handles normal and missing values", () => {
    expect(formatNumber(1234.5)).toBe("1,234.5");
    expect(formatNumber(null)).toBe("—");
    expect(formatNumber(undefined)).toBe("—");
  });

  it("formatPercent rounds to whole percent", () => {
    expect(formatPercent(0.456)).toBe("46%");
    expect(formatPercent(null)).toBe("—");
  });

  it("formatMinutes switches to hours past 60", () => {
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(90)).toBe("1h 30m");
    expect(formatMinutes(120)).toBe("2h");
  });
});

describe("binValues (histogram binning)", () => {
  it("bins non-zero values into fixed-width buckets", () => {
    const { labels, counts } = binValues([0, 10, 35, 95, 95], { binWidth: 30 });
    expect(labels.length).toBe(counts.length);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(4); // the 0 is excluded
  });

  it("empty/all-zero input never throws and returns empty bins", () => {
    expect(binValues([])).toEqual({ labels: [], counts: [] });
    expect(binValues([0, 0, 0])).toEqual({ labels: [], counts: [] });
  });
});

describe("week/weekday helpers", () => {
  it("isoWeekday treats Monday as 0", () => {
    expect(isoWeekday("2026-01-05")).toBe(0); // a Monday
    expect(isoWeekday("2026-01-11")).toBe(6); // the following Sunday
  });

  it("weekStartIso always returns a Monday for the same week", () => {
    expect(weekStartIso("2026-01-07")).toBe("2026-01-05");
    expect(weekStartIso("2026-01-05")).toBe("2026-01-05");
  });
});

describe("heatmapWeeks", () => {
  it("pads the first and last week to 7 slots", () => {
    const cells = [
      { date: "2026-01-07", status: "on_time" }, // Wednesday
      { date: "2026-01-08", status: "none" },
    ];
    const weeks = heatmapWeeks(cells);
    expect(weeks[0]).toHaveLength(7);
    expect(weeks[0][0]).toBeNull();
    expect(weeks[0][2].date).toBe("2026-01-07");
  });

  it("empty input never throws", () => {
    expect(heatmapWeeks([])).toEqual([]);
  });
});

describe("insight caption generators", () => {
  it("mostActiveWeekdayCaption names the busiest day", () => {
    expect(mostActiveWeekdayCaption([1, 2, 4, 0, 0, 0, 0])).toContain("Wednesday");
  });

  it("mostActiveWeekdayCaption handles all-zero without throwing", () => {
    expect(mostActiveWeekdayCaption([0, 0, 0, 0, 0, 0, 0])).toMatch(/No journals/);
  });

  it("trendCaption reflects the label", () => {
    expect(trendCaption({ label: "insufficient data", slope_per_day: 0 })).toMatch(/Not enough/);
    expect(trendCaption({ label: "increasing", slope_per_day: 2 })).toMatch(/up/);
  });

  it("subjectCaption handles empty rows", () => {
    expect(subjectCaption([])).toMatch(/No subjects/);
  });

  it("correlationCaption explains a null correlation with its reason", () => {
    const text = correlationCaption({ rho: null, reason: "study minutes never varies" });
    expect(text).toContain("study minutes never varies");
  });
});

describe("pngExportSize", () => {
  it("scales width/height by the given factor", () => {
    expect(pngExportSize(300, 150, 2)).toEqual({ width: 600, height: 300 });
  });
});
