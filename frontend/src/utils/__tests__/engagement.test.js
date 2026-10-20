import { describe, it, expect } from "vitest";
import { applyEngagement, plannedWeeklyMinutesBySubject } from "../engagement";
import { resolveExplanationDisplay } from "../priorityEngine";

describe("plannedWeeklyMinutesBySubject", () => {
  it("averages the next 4 weeks of the planner's own allocation, by subject name", () => {
    const modules = [{ code: "os", name: "Operating Systems" }, { code: "ai", name: "AI" }];
    const allocation = [{ os: 4 }, { os: 2 }, { os: 3 }, { os: 3 }, { os: 100 }];
    expect(plannedWeeklyMinutesBySubject(modules, allocation)).toEqual({ "Operating Systems": 180, AI: 0 });
  });
});

describe("applyEngagement", () => {
  const assignment = {
    taskId: "t1",
    moduleName: "Operating Systems",
    featureRow: { date: 30, avg_weekly_clicks: 46, clicks_trend: -31.6, active_weeks_ratio: 1, has_vle_activity: 1 },
  };
  const engagement = {
    "Operating Systems": { avg_weekly_clicks: 23, clicks_trend: -50, active_weeks_ratio: 0.5, has_vle_activity: 1 },
  };

  it("writes real engagement into the feature row and flags it", () => {
    const { assignments, changed } = applyEngagement([assignment], engagement);
    expect(changed).toBe(true);
    expect(assignments[0].hasEngagementData).toBe(true);
    expect(assignments[0].featureRow).toMatchObject({ date: 30, avg_weekly_clicks: 23, clicks_trend: -50, active_weeks_ratio: 0.5 });
  });

  it("is a no-op (changed=false) when nothing differs or no data exists for the subject", () => {
    const once = applyEngagement([assignment], engagement).assignments;
    expect(applyEngagement(once, engagement).changed).toBe(false);
    expect(applyEngagement([assignment], {}).changed).toBe(false);
  });
});

describe("explanations never cite engagement until it's real", () => {
  const explanation = {
    predicted_priority: "High",
    feature_contributions: { avg_weekly_clicks: 1.2, weight: 0.4, studied_credits: 0.9, date: 0.1 },
  };
  const final = { priorityLabel: "High", dominantMechanism: "ml" };

  it("hides engagement + unmeasured features without real data", () => {
    const d = resolveExplanationDisplay(final, 10, explanation, { hasEngagementData: false });
    expect(Object.keys(d.contributions)).not.toContain("avg_weekly_clicks");
    expect(Object.keys(d.contributions)).not.toContain("studied_credits");
  });

  it("shows engagement once it comes from the journal", () => {
    const d = resolveExplanationDisplay(final, 10, explanation, { hasEngagementData: true });
    expect(Object.keys(d.contributions)).toContain("avg_weekly_clicks");
  });
});
