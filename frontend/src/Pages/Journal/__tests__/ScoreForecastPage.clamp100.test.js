import { describe, it, expect } from "vitest";
import { clamp100 } from "../scoreForecastUtils";

describe("clamp100: the scale-bar clamping helper", () => {
  it("leaves an in-range value untouched", () => {
    expect(clamp100(64)).toBe(64);
    expect(clamp100(0)).toBe(0);
    expect(clamp100(100)).toBe(100);
  });

  it("clamps a value below 0 up to 0", () => {
    expect(clamp100(-15)).toBe(0);
  });

  it("clamps a value above 100 down to 100", () => {
    expect(clamp100(140)).toBe(100);
  });

  it("keeps low <= estimate <= high ordering after clamping a realistic (out-of-range) triple", () => {
    const low = -10;
    const estimate = 64;
    const high = 150;
    const clampedLow = clamp100(low);
    const clampedEstimate = clamp100(estimate);
    const clampedHigh = clamp100(high);
    expect(clampedLow).toBeLessThanOrEqual(clampedEstimate);
    expect(clampedEstimate).toBeLessThanOrEqual(clampedHigh);
    expect(clampedLow).toBe(0);
    expect(clampedHigh).toBe(100);
  });
});
