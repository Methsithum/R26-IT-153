import { describe, it, expect } from "vitest";
import { getTimeOfDayBand, TIME_OF_DAY_BAND_ORDER } from "../studySessionBuilder";

describe("getTimeOfDayBand", () => {
  it("classifies Morning (06:00-11:59)", () => {
    expect(getTimeOfDayBand("06:00")).toBe("Morning");
    expect(getTimeOfDayBand("09:30")).toBe("Morning");
    expect(getTimeOfDayBand("11:59")).toBe("Morning");
  });

  it("classifies Afternoon (12:00-16:59)", () => {
    expect(getTimeOfDayBand("12:00")).toBe("Afternoon");
    expect(getTimeOfDayBand("14:30")).toBe("Afternoon");
    expect(getTimeOfDayBand("16:59")).toBe("Afternoon");
  });

  it("classifies Evening (17:00-19:59)", () => {
    expect(getTimeOfDayBand("17:00")).toBe("Evening");
    expect(getTimeOfDayBand("18:15")).toBe("Evening");
    expect(getTimeOfDayBand("19:59")).toBe("Evening");
  });

  it("classifies Night (20:00-01:00), wrapping past midnight", () => {
    expect(getTimeOfDayBand("20:00")).toBe("Night");
    expect(getTimeOfDayBand("23:30")).toBe("Night");
    expect(getTimeOfDayBand("00:00")).toBe("Night");
    expect(getTimeOfDayBand("00:45")).toBe("Night");
  });

  it("classifies pre-dawn hours (01:00-05:59) as Night too, as a safe catch-all", () => {
    expect(getTimeOfDayBand("03:00")).toBe("Night");
    expect(getTimeOfDayBand("05:59")).toBe("Night");
  });

  it("accepts a full 'HH:MM-HH:MM' range and only uses the start", () => {
    expect(getTimeOfDayBand("09:00-11:00")).toBe("Morning");
    expect(getTimeOfDayBand("20:30-22:00")).toBe("Night");
  });

  it("handles a boundary transition exactly at the minute", () => {
    expect(getTimeOfDayBand("11:59")).toBe("Morning");
    expect(getTimeOfDayBand("12:00")).toBe("Afternoon");
    expect(getTimeOfDayBand("16:59")).toBe("Afternoon");
    expect(getTimeOfDayBand("17:00")).toBe("Evening");
    expect(getTimeOfDayBand("19:59")).toBe("Evening");
    expect(getTimeOfDayBand("20:00")).toBe("Night");
  });

  it("TIME_OF_DAY_BAND_ORDER lists all 4 bands in display order", () => {
    expect(TIME_OF_DAY_BAND_ORDER).toEqual(["Morning", "Afternoon", "Evening", "Night"]);
  });
});
