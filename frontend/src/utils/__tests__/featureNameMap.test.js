// Regression tests for featureNameMap.js - covers the raw-feature-name leak
// bug (ExplanationPanel showing "assessment_type_enc" verbatim) and the
// original date-mapping inversion bug (a "due tomorrow" task predicting
// lower priority than one due weeks out, traced to date values outside the
// model's trained range).
import { describe, it, expect, vi, afterEach } from "vitest";
import { humanizeFeatureName, buildDateFeatureFromDeadline, FEATURE_LABELS } from "../featureNameMap";

const ALL_13_FEATURES = [
  "date", "weight", "num_of_prev_attempts", "studied_credits",
  "module_presentation_length", "date_registration", "prior_avg_score",
  "avg_weekly_clicks", "clicks_trend", "active_weeks_ratio", "has_vle_activity",
  "assessment_type_enc", "code_module_enc",
];

describe("humanizeFeatureName: no raw model feature name ever reaches the UI", () => {
  it("has a FEATURE_LABELS entry for all 13 known model features", () => {
    for (const key of ALL_13_FEATURES) {
      expect(FEATURE_LABELS[key]).toBeDefined();
    }
  });

  it("never returns the raw key unchanged for any of the 13 known features", () => {
    for (const key of ALL_13_FEATURES) {
      const label = humanizeFeatureName(key);
      expect(label).not.toBe(key);
      // The specific string that leaked into the UI in the original bug report.
      expect(label).not.toContain("_enc");
      expect(label).not.toContain("_");
    }
  });

  it('specifically: "assessment_type_enc" (the exact string from the bug report) humanizes to "Assessment type"', () => {
    expect(humanizeFeatureName("assessment_type_enc")).toBe("Assessment type");
  });
});

describe("humanizeFeatureName: fail-loudly-in-dev fallback for an unmapped feature", () => {
  afterEach(() => vi.restoreAllMocks());

  it("warns to the console when a feature key has no FEATURE_LABELS entry", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = humanizeFeatureName("some_future_feature_not_yet_mapped");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain("some_future_feature_not_yet_mapped");
    // Even when unmapped, the fallback must still not display the raw snake_case key -
    // it title-cases it as a last resort, never showing "some_future_feature_not_yet_mapped" verbatim.
    expect(result).not.toBe("some_future_feature_not_yet_mapped");
    expect(result).not.toContain("_");
  });

  it("does not warn for a known, mapped feature", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    humanizeFeatureName("weight");
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe("buildDateFeatureFromDeadline: output always within the trained range [12, 261]", () => {
  const TRAINED_MIN = 12;
  const TRAINED_MAX = 261;
  const from = new Date("2026-08-29T00:00:00");

  it.each([
    ["overdue (-5 days)", "2026-08-24"],
    ["due today (0 days)", "2026-08-29"],
    ["due tomorrow (1 day) - the exact case from the original bug report", "2026-08-30"],
    ["due in 30 days", "2026-09-28"],
    ["due in 180 days (the cap boundary)", "2027-02-25"],
    ["due in 400 days (far beyond the cap)", "2027-10-03"],
  ])("%s -> value within [12, 261]", (_label, deadline) => {
    const value = buildDateFeatureFromDeadline(deadline, from);
    expect(value).toBeGreaterThanOrEqual(TRAINED_MIN);
    expect(value).toBeLessThanOrEqual(TRAINED_MAX);
  });

  it("regression guard: a task due tomorrow no longer maps near the middle of the range the way a raw days-remaining value would have", () => {
    // Original bug: feeding raw "days remaining" (e.g. literally 1) directly
    // to the model was badly out-of-distribution (trained min is 12). This
    // asserts the near-term value is close to TRAINED_MIN, not left as a
    // tiny raw number nor drifted toward the far end.
    const value = buildDateFeatureFromDeadline("2026-08-30", from);
    expect(value).toBeGreaterThanOrEqual(TRAINED_MIN);
    expect(value).toBeLessThan(20); // well within the "urgent" end of the range
  });

  it("monotonic in real days-remaining: further out always maps to a larger (or equal) value", () => {
    const nearer = buildDateFeatureFromDeadline("2026-09-01", from);
    const further = buildDateFeatureFromDeadline("2026-09-15", from);
    expect(further).toBeGreaterThan(nearer);
  });
});
