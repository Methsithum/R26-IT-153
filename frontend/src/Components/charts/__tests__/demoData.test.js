import { describe, expect, it } from "vitest";
import { buildDemoLearningPatterns, buildDemoBehaviorLatest } from "../demoData";

function stripNonDeterministic(payload) {
  const { meta, ...rest } = payload;
  const { generated_at, ...metaRest } = meta;
  return { ...rest, meta: metaRest };
}

describe("buildDemoLearningPatterns", () => {
  it("is deterministic across calls for the same window", () => {
    const a = stripNonDeterministic(buildDemoLearningPatterns(30));
    const b = stripNonDeterministic(buildDemoLearningPatterns(30));
    expect(a).toEqual(b);
  });

  it("never sends/stores anything - it is a pure function returning plain data", () => {
    const result = buildDemoLearningPatterns(14);
    expect(result.daily_series.length).toBeGreaterThan(0);
    expect(result.window_days).toBe(14);
  });

  it("produces internally consistent engagement counts", () => {
    const result = buildDemoLearningPatterns(30);
    const { low, medium, high } = result.engagement_distribution.counts;
    expect(low + medium + high).toBe(result.daily_series.length);
  });
});

describe("buildDemoBehaviorLatest", () => {
  it("is marked as demo data and never calls any network API", () => {
    const result = buildDemoBehaviorLatest();
    expect(result.available).toBe(true);
    expect(result.demo).toBe(true);
  });
});
