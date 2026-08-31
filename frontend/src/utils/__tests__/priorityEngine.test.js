// Regression tests for the hybrid priority layer (PROJECT CONTEXT.md
// Section 5d) - every case here maps to a specific, previously-verified
// design guarantee or a specific bug that was found and fixed during
// development, not generic coverage.
import { describe, it, expect } from "vitest";
import {
  computeBaseTier,
  computeFinalPriority,
  resolveExplanationDisplay,
  applyPriorityEngineToScheduleResult,
  PRIORITY_LEVELS,
} from "../priorityEngine";

describe("computeBaseTier (assignment thresholds)", () => {
  it("assigns High at <=4 days", () => {
    expect(computeBaseTier(0, "assignment").level).toBe(PRIORITY_LEVELS.High);
    expect(computeBaseTier(4, "assignment").level).toBe(PRIORITY_LEVELS.High);
  });
  it("assigns Medium at 5-14 days", () => {
    expect(computeBaseTier(5, "assignment").level).toBe(PRIORITY_LEVELS.Medium);
    expect(computeBaseTier(14, "assignment").level).toBe(PRIORITY_LEVELS.Medium);
  });
  it("assigns Low at >=15 days", () => {
    expect(computeBaseTier(15, "assignment").level).toBe(PRIORITY_LEVELS.Low);
    expect(computeBaseTier(30, "assignment").level).toBe(PRIORITY_LEVELS.Low);
  });
});

describe("computeBaseTier (exam thresholds - longer real-world lead time)", () => {
  it("assigns High at <=7 days", () => {
    expect(computeBaseTier(7, "exam").level).toBe(PRIORITY_LEVELS.High);
  });
  it("assigns Medium at 8-30 days", () => {
    expect(computeBaseTier(8, "exam").level).toBe(PRIORITY_LEVELS.Medium);
    expect(computeBaseTier(30, "exam").level).toBe(PRIORITY_LEVELS.Medium);
  });
  it("assigns Low at >=31 days", () => {
    expect(computeBaseTier(31, "exam").level).toBe(PRIORITY_LEVELS.Low);
  });
});

describe("computeFinalPriority: overdue always wins (regression guard)", () => {
  it("returns High when overdue, regardless of what the ML label says", () => {
    for (const raw of ["Low", "Medium", "High", null]) {
      const result = computeFinalPriority(-1, "assignment", raw);
      expect(result.priorityLabel).toBe("High");
      expect(result.dominantMechanism).toBe("deadline");
    }
    // Also true for exams and for a task overdue by many days.
    expect(computeFinalPriority(-30, "exam", "Low").priorityLabel).toBe("High");
  });
});

describe("computeFinalPriority: >30-day hard floor (regression guard, later refinement)", () => {
  it("always returns Low past 30 days, even when ML strongly suggests High", () => {
    expect(computeFinalPriority(31, "assignment", "High").priorityLabel).toBe("Low");
    expect(computeFinalPriority(56, "assignment", "High").priorityLabel).toBe("Low");
    expect(computeFinalPriority(45, "exam", "High").priorityLabel).toBe("Low");
  });
  it("does not floor at exactly 30 days (boundary check)", () => {
    // 30 days is still within the normal base-tier + modifier path.
    const result = computeFinalPriority(30, "assignment", "High");
    expect(result.priorityLabel).not.toBe(undefined);
    // base tier at 30 days is Low, but the ±1 modifier is still allowed to apply here.
    expect(result.dominantMechanism).toBe("ml");
    expect(result.priorityLabel).toBe("Medium");
  });
  it("this is the exact real-world case originally investigated: a 32-day task no longer inflates to Medium/High", () => {
    // "dddddd" from the live investigation - due in 32 days, ML said High.
    const result = computeFinalPriority(32, "assignment", "High");
    expect(result.priorityLabel).toBe("Low");
  });
});

describe("computeFinalPriority: ±1 tier clamp (Section 5d cross-task dominance)", () => {
  it("never lets the ML label move the result more than 1 tier from the base, when base and ML are 2 tiers apart", () => {
    // base=Low(0), ML=High(2) -> diff of 2, must clamp to +1 -> Medium(1), NOT High.
    const lowBaseHighMl = computeFinalPriority(20, "assignment", "High"); // 20d -> base Low
    expect(lowBaseHighMl.baseTierLevel).toBe(PRIORITY_LEVELS.Low);
    expect(lowBaseHighMl.mlTierLevel).toBe(PRIORITY_LEVELS.High);
    expect(lowBaseHighMl.modifier).toBe(1); // clamped from a "wanted" +2
    expect(lowBaseHighMl.priorityLabel).toBe("Medium");

    // base=High(2), ML=Low(0) -> diff of -2, must clamp to -1 -> Medium(1), NOT Low.
    const highBaseLowMl = computeFinalPriority(1, "assignment", "Low"); // 1d -> base High
    expect(highBaseLowMl.baseTierLevel).toBe(PRIORITY_LEVELS.High);
    expect(highBaseLowMl.mlTierLevel).toBe(PRIORITY_LEVELS.Low);
    expect(highBaseLowMl.modifier).toBe(-1);
    expect(highBaseLowMl.priorityLabel).toBe("Medium");
  });

  it("never moves the result more than 1 tier for ANY combination of base/ML levels", () => {
    const days = { Low: 20, Medium: 10, High: 1 };
    for (const baseLabel of ["Low", "Medium", "High"]) {
      for (const mlLabel of ["Low", "Medium", "High"]) {
        const result = computeFinalPriority(days[baseLabel], "assignment", mlLabel);
        const finalLevel = PRIORITY_LEVELS[result.priorityLabel];
        expect(Math.abs(finalLevel - result.baseTierLevel)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("a low-weight task due tomorrow cannot be pushed below its base High (documented guarantee)", () => {
    const result = computeFinalPriority(1, "assignment", "Low");
    expect(result.priorityLabel).toBe("Medium"); // High(2) - 1 = Medium(1), the floor of the clamp
    expect(PRIORITY_LEVELS[result.priorityLabel]).toBeGreaterThanOrEqual(PRIORITY_LEVELS.Medium);
  });

  it("stands alone (dominantMechanism=deadline) when no ML label is available yet", () => {
    const result = computeFinalPriority(5, "assignment", null);
    expect(result.dominantMechanism).toBe("deadline");
    expect(result.priorityLabel).toBe("Medium");
  });
});

describe("resolveExplanationDisplay: cold-start honesty (Section 17)", () => {
  // 20 days -> base Low(0), ML=Medium(1) -> clamps to Medium(1), which equals
  // the raw ML label itself -> finalLabel===rawLabel -> the "shap" branch.
  const finalResult = computeFinalPriority(20, "assignment", "Medium");
  const explanationPriorAvgScoreDominant = {
    predicted_priority: finalResult.priorityLabel,
    feature_contributions: {
      prior_avg_score: 0.9, // largest magnitude
      weight: 0.3,
      date: 0.1,
    },
  };

  it("with real prior-score data: cites prior_avg_score normally, no caveat", () => {
    const display = resolveExplanationDisplay(finalResult, 20, explanationPriorAvgScoreDominant, { hasPriorScoreData: true });
    expect(display.sentence).toContain("average score");
    expect(display.caveat).toBeNull();
  });

  it("cold-start (no prior-score data): excludes prior_avg_score from the sentence and adds a caveat", () => {
    const display = resolveExplanationDisplay(finalResult, 20, explanationPriorAvgScoreDominant, { hasPriorScoreData: false });
    expect(display.sentence).not.toContain("average score");
    expect(display.sentence).toContain("weight"); // falls through to the next real contributor
    expect(display.caveat).toBe("Your performance history isn't available yet, so this estimate may be less certain.");
  });

  it("cold-start but prior_avg_score wasn't the top factor anyway: no caveat needed", () => {
    const explanationWeightDominant = {
      predicted_priority: finalResult.priorityLabel,
      feature_contributions: { weight: 0.9, prior_avg_score: 0.2, date: 0.1 },
    };
    const display = resolveExplanationDisplay(finalResult, 20, explanationWeightDominant, { hasPriorScoreData: false });
    expect(display.caveat).toBeNull();
  });

  it("defaults hasPriorScoreData to true when options are omitted (backward compatible)", () => {
    const display = resolveExplanationDisplay(finalResult, 20, explanationPriorAvgScoreDominant);
    expect(display.sentence).toContain("average score");
    expect(display.caveat).toBeNull();
  });

  // weight is the model's single strongest feature (Section 6 SHAP) - a
  // real synced task (external Journal schema has no `weight` field at all)
  // must never have a fabricated weight cited as the reason for its priority.
  const explanationWeightDominant = {
    predicted_priority: finalResult.priorityLabel,
    feature_contributions: { weight: 0.9, prior_avg_score: 0.2, date: 0.1 },
  };

  it("with a real weight: cites weight normally, no caveat", () => {
    const display = resolveExplanationDisplay(finalResult, 20, explanationWeightDominant, { hasRealWeight: true });
    expect(display.sentence).toContain("weight");
    expect(display.caveat).toBeNull();
  });

  it("no real weight (real synced task, weight field absent): excludes weight, adds the weight-specific caveat", () => {
    const display = resolveExplanationDisplay(finalResult, 20, explanationWeightDominant, { hasRealWeight: false });
    expect(display.sentence).not.toContain("assignment weight");
    expect(display.sentence).toContain("average score"); // falls through to the next real contributor
    expect(display.caveat).toBe("This task's weight isn't set yet — using a neutral default, so this estimate may be less certain.");
  });

  it("both prior score and weight missing: excludes both, caveat matches whichever was actually top-ranked", () => {
    const explanationBothMissingWeightTop = {
      predicted_priority: finalResult.priorityLabel,
      feature_contributions: { weight: 0.9, prior_avg_score: 0.8, date: 0.1 },
    };
    const display = resolveExplanationDisplay(finalResult, 20, explanationBothMissingWeightTop, {
      hasPriorScoreData: false,
      hasRealWeight: false,
    });
    expect(display.sentence).not.toContain("assignment weight");
    expect(display.sentence).not.toContain("average score");
    expect(display.sentence).toContain("time until deadline"); // falls through past both fabricated features
    expect(display.caveat).toContain("weight"); // weight was ranked #1 (0.9 > 0.8), so its caveat wins
  });

  it("defaults hasRealWeight to true when options are omitted (backward compatible)", () => {
    const display = resolveExplanationDisplay(finalResult, 20, explanationWeightDominant);
    expect(display.sentence).toContain("weight");
    expect(display.caveat).toBeNull();
  });

  it("always excludes assessment_type_enc from both the sentence and the factor bars - it's a fixed constant now, never a real per-task signal (Assessment Type was removed as a student-set field)", () => {
    const explanationAssessmentTypeTop = {
      predicted_priority: finalResult.priorityLabel,
      feature_contributions: { assessment_type_enc: 0.95, weight: 0.4, date: 0.1 },
    };
    const display = resolveExplanationDisplay(finalResult, 20, explanationAssessmentTypeTop);
    expect(display.sentence).not.toContain("Assessment Type");
    expect(display.sentence).not.toContain("assessment type");
    expect(display.contributions).not.toHaveProperty("assessment_type_enc");
    expect(display.contributions).toHaveProperty("weight");
  });

  it("always excludes module_presentation_length too - also always the same hardcoded constant (240) for every task, never a real per-module value collected anywhere in the app", () => {
    const explanationModuleLengthTop = {
      predicted_priority: finalResult.priorityLabel,
      feature_contributions: { module_presentation_length: 0.95, weight: 0.4, date: 0.1 },
    };
    const display = resolveExplanationDisplay(finalResult, 20, explanationModuleLengthTop);
    expect(display.sentence).not.toContain("Module length");
    expect(display.sentence).not.toContain("module length");
    expect(display.contributions).not.toHaveProperty("module_presentation_length");
    expect(display.contributions).toHaveProperty("weight");
  });

  it("always excludes code_module_enc too - a real subject is mapped onto the model's 7 fixed training categories by arbitrary list position, never a meaningful reflection of that subject", () => {
    const explanationModuleTop = {
      predicted_priority: finalResult.priorityLabel,
      feature_contributions: { code_module_enc: 0.95, weight: 0.4, date: 0.1 },
    };
    const display = resolveExplanationDisplay(finalResult, 20, explanationModuleTop);
    expect(display.sentence).not.toContain("Module");
    expect(display.contributions).not.toHaveProperty("code_module_enc");
    expect(display.contributions).toHaveProperty("weight");
  });
});

describe("applyPriorityEngineToScheduleResult: cross-task deadline consistency", () => {
  // Both fall in the assignment ">14 days" base-tier band (Low, leaning
  // Medium) - real bug report: a task due in 20 days independently computed
  // as Low while a DIFFERENT task due in 30 days, same band, got bumped to
  // Medium by its own ML weight signal. Individually valid, but backwards
  // side by side - the nearer deadline must never rank below the farther one.
  const baseScheduleResult = (from) => ({
    tasks: {
      "task-near-20d": {
        deadline_date: new Date(from.getTime() + 20 * 86400000).toISOString().slice(0, 10),
        task_type: "assignment",
        priority_label: "Low", // raw ML label - would independently stay Low
      },
      "task-far-30d": {
        deadline_date: new Date(from.getTime() + 30 * 86400000).toISOString().slice(0, 10),
        task_type: "assignment",
        priority_label: "High", // raw ML label - strong enough to clamp up to Medium
      },
    },
    overload_warning: [],
  });

  it("raises the nearer deadline's priority to match a farther deadline in the same band, never lowering the farther one", () => {
    const from = new Date("2026-09-01T00:00:00");
    const result = applyPriorityEngineToScheduleResult(baseScheduleResult(from), from);
    const nearLevel = PRIORITY_LEVELS[result.tasks["task-near-20d"].priority_label];
    const farLevel = PRIORITY_LEVELS[result.tasks["task-far-30d"].priority_label];
    expect(farLevel).toBe(PRIORITY_LEVELS.Medium); // farther task's own real ML-driven result, unchanged
    expect(nearLevel).toBeGreaterThanOrEqual(farLevel); // nearer task raised to at least match it
  });

  it("never compares across different task_types (assignment vs exam follow different urgency curves)", () => {
    const from = new Date("2026-09-01T00:00:00");
    const scheduleResult = {
      tasks: {
        "assign-near-20d": {
          deadline_date: new Date(from.getTime() + 20 * 86400000).toISOString().slice(0, 10),
          task_type: "assignment",
          priority_label: "Low",
        },
        "exam-far-30d": {
          deadline_date: new Date(from.getTime() + 30 * 86400000).toISOString().slice(0, 10),
          task_type: "exam",
          priority_label: "High", // exam base tier at 30 days is already Medium regardless
        },
      },
      overload_warning: [],
    };
    const result = applyPriorityEngineToScheduleResult(scheduleResult, from);
    // The assignment's own independent result stands - not pulled up just
    // because an unrelated EXAM further out happens to rank higher.
    expect(result.tasks["assign-near-20d"].priority_label).toBe("Low");
  });
});

describe("resolveExplanationDisplay: weight detail sentence (real training-data context)", () => {
  const finalResult = computeFinalPriority(20, "assignment", "Medium"); // base Low, ML Medium -> raised
  const explanationWeightTop = {
    predicted_priority: finalResult.priorityLabel,
    feature_contributions: { weight: 0.9, date: 0.1 },
  };

  it("cites the real weight value and its position relative to the training data when weight is the named reason", () => {
    const display = resolveExplanationDisplay(finalResult, 20, explanationWeightTop, { hasRealWeight: true, weightValue: 35 });
    expect(display.detail).toContain("35%");
    expect(display.detail).toMatch(/heaviest|above|typical/);
  });

  it("says nothing extra for a weight at or below the training data's median (9%) - not a real distinguishing detail", () => {
    const display = resolveExplanationDisplay(finalResult, 20, explanationWeightTop, { hasRealWeight: true, weightValue: 5 });
    expect(display.detail).toContain("5%");
    expect(display.detail).toContain("typical");
  });

  it("omits the detail entirely when weight isn't real yet (cold-start placeholder)", () => {
    const display = resolveExplanationDisplay(finalResult, 20, explanationWeightTop, { hasRealWeight: false, weightValue: 35 });
    expect(display.detail).toBeNull();
  });

  it("omits the detail when weight wasn't actually the named reason", () => {
    const explanationDateTop = {
      predicted_priority: finalResult.priorityLabel,
      feature_contributions: { date: 0.9, weight: 0.1 },
    };
    const display = resolveExplanationDisplay(finalResult, 20, explanationDateTop, { hasRealWeight: true, weightValue: 35 });
    expect(display.detail).toBeNull();
  });
});
