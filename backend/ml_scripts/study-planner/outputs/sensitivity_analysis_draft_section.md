<!--
DRAFT ONLY — not yet inserted into PROJECT CONTEXT.md. Bring back for review
per the task's explicit instruction not to touch production docs/code until
the sensitivity analysis itself is reviewed. If approved, this is intended
to land as a new subsection near Section 5d/8a (suggested: "5f." or "8b.",
whichever the reviewer prefers to slot it under — it covers constants from
both).
-->

### Sensitivity Analysis of Hybrid-Layer & Exam-Prep Constants

The hybrid priority layer (Section 5d) and exam-prep escalation model (Section 8a) both introduce several hand-chosen numeric constants — base-tier day-thresholds, the ±1 ML modifier clamp, the 12h exam budget, the 15/35/50% escalation curve, and the 1.4×/1.0×/0.75× performance multiplier range. None of these had been empirically tested for sensitivity before deployment; a defensible system should show its constants sit in a reasonable, evidence-backed region rather than resting on plausibility alone.

**Method.** `ml_scripts/study-planner/sensitivity_analysis.py` defines four schedule-quality metrics (`evaluateSchedule()`): the fraction of High-priority tasks fully scheduled before their deadline, the average lead-time buffer for those tasks, the variance of daily scheduled load across the week, and total shortfall hours across `overload_warning`. It reuses the real `StudyScheduler` unmodified, with a standalone Python port of the priority/exam-prep math (parameterized so each constant sweeps independently) — the port is for analysis only and does not replace or alter `priorityEngine.js`/`examPrepConfig.js`. Three fixed scenarios (light/typical/heavy load) are reused identically across every sweep so comparisons are apples-to-apples; the two extreme scenarios turned out to be largely uninformative (light has too much spare capacity to bind, heavy is too oversubscribed to be relieved by any tested value) — the realistic `typical` scenario carries almost all the analytical signal.

**Findings, full detail in `ml_scripts/study-planner/outputs/sensitivity_analysis_report.md`:**
- **ML modifier clamp (±1, current):** well-justified. Disabling ML influence entirely (clamp=0) measurably hurt outcomes (avg lead-time for High-priority tasks dropped from 5.5 to 1.0 days in the typical scenario); raising it to ±2 produced zero additional change in any tested scenario. Current value already captures the measurable benefit without allowing more ML swing than the data supports.
- **Base tier day-thresholds:** stable under a small perturbation (±2 days from current gave identical results) but not under a larger one (±5 days did shift outcomes) — a genuine, bounded sensitivity worth documenting honestly rather than claiming full robustness. Not a reason to change the current values.
- **Exam prep budget (12h) and performance multiplier range (1.4/1.0/0.75):** both showed the *expected*, roughly proportional sensitivity of a genuine thoroughness/support-vs-feasibility trade-off dial — not a fragile edge case. Current values sit at reasonable middle points between the tested extremes; no better value is evident from schedule-feasibility metrics alone (optimizing further would need real learning-outcome data, out of scope here).
- **Exam prep curve shape (15/35/50%, back-loaded):** low sensitivity — a front-loaded alternative scored marginally better on total overload hours (5.5h vs. 6.75h in the typical scenario, ≈5% of total exam demand), but the margin is small and the back-loaded curve's pedagogical rationale (light familiarization early, concentrated review just before the exam) isn't something these feasibility-only metrics evaluate either way.

**Conclusion.** All five current production constants are confirmed reasonable and defensible; no revised values are recommended. The one honestly-flagged limitation is the base-tier thresholds' sensitivity to a large (±5 day) shift, which is bounded and doesn't argue for a different current value, but should not be mischaracterized as fully robust. No production code was changed as part of this analysis.
