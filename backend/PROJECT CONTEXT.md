# Academic Management with Personalized Study Planner
### Smart Uni Guide — Component Documentation

This document is the single source of truth for this component. Any AI coding assistant (Claude Code, etc.) or new contributor should read this file first before making changes, to understand what exists, why it was built this way, and what's still in progress.

---

## 1. What This Component Does

University students struggle to manage assignments, deadlines, and study time across multiple modules. This component:

1. Predicts how urgent/important each academic task is (**High / Medium / Low priority**)
2. Explains *why* a task got that priority, in plain language
3. Groups students by study behavior for light personalization
4. Builds a study schedule around the student's free time
5. Adapts that schedule when tasks are completed or new ones appear
6. Surfaces everything as a to-do list with priority/urgency-aware reminders

This is one of four components in the larger Smart Uni Guide system (the others — Gamified Journal, Distraction Detection, Career Prediction — are owned by teammates and out of scope here).

---

## 2. Proposal Objectives (for reference)

1. Data collection and analysis of academic performance
2. Monitoring/tracking student study behavior
3. ML-based prediction of academic risk/priority + behavioral clustering
4. Dynamic personalized study schedule generation (+ adaptive rescheduling)
5. Automated to-do lists and reminders
6. Explainability and transparency in recommendations (SHAP)
7. Evaluation of system effectiveness (pilot testing)

Status of each objective is tracked in Section 8.

---

## 3. Dataset — Why OULAD, Not the First Dataset Tried

**First attempt:** A generic student-performance CSV (grades, attendance, study hours, stress, sleep). Rejected as the primary dataset because it had **no deadlines, no per-task records, and no assignment weight** — it was one row per student (aggregate), not one row per task. It's still usable for a *general risk classification* side-experiment, but not for task-level priority.

**Current dataset: OULAD** (Open University Learning Analytics Dataset) — a real, peer-reviewed dataset (Kuzilek et al., *Nature Scientific Data*) from the UK Open University. Files used:

| File | Contents |
|---|---|
| `assessments.csv` | Assessment type, **deadline (`date`)**, `weight` |
| `studentAssessment.csv` | Per-student score, **submission date**, `is_banked` |
| `studentInfo.csv` | Demographics, `num_of_prev_attempts`, `studied_credits`, `final_result` |
| `studentRegistration.csv` | Registration/unregistration dates |
| `courses.csv` | Module presentation length |
| `studentVle.csv` | Per-student daily click logs (large, ~423MB, 10M+ rows) — processed in chunks |
| `vle.csv` | VLE resource metadata (catalog only, not click logs) |

**Known limitation:** OULAD is distance/online learning — there is no lecture timetable or "free time around classes" concept native to it. The scheduling engine's free-time-slot logic is therefore built independently of this dataset (see Section 6).

---

## 4. Critical Fix: The Data Leakage Bug (read this before touching the label logic)

**What went wrong initially:** `Priority_Label` was first defined as a formula of `weight`, `date`, and `prior_avg_score` — but those exact same columns were also the model's input features. Any model could "solve" this trivially (99%+ accuracy across the board), because it was reverse-engineering the label formula, not predicting anything real. This is a well-known trap: **suspiciously perfect accuracy is a red flag, not a success.**

**The fix:** `Priority_Label` is now derived from the task's **actual outcome**:
- `submitted_late = 1 if date_submitted > date else 0`
- **High** if: `score < 50` OR `submitted_late == 1` OR (`score < 60` AND `weight >= 20`)
- **Low** if: `score >= 75` AND `submitted_late == 0` AND `weight < 15`
- **Medium**: everything else

`score`, `date_submitted`, and the derived `submitted_late` are used **only** to build the label, then dropped entirely before the feature matrix is built. This is standard supervised learning — labels may use outcome information; **features must never contain information unavailable before the outcome occurs.**

**Guardrail in place:** `train_priority_model.py` prints an explicit warning if any model exceeds 97% accuracy/F1, flagging possible remaining leakage. Do not remove this check.

**Resulting (real, defensible) label distribution:** Medium 36.9% / High 35.4% / Low 27.7% — naturally balanced enough that SMOTE was not needed for this run.

---

## 5. ML Models — What Was Tried and What Won

Two separate modeling exercises exist in this project. Don't conflate them:

### 5a. Risk classification (side experiment, on the original generic dataset)
Target: `Risk_Level` (High/Medium/Low) from `Total_Score` bucketing. 8 models compared. **Logistic Regression won** (Weighted F1 0.7044, High-risk recall 85.7%) — notable because it beat XGBoost/Random Forest, likely because the underlying feature-target relationship is close to linear on that dataset.

### 5b. Priority classification (the real, current model, on OULAD — this is the one wired into the backend)
Target: outcome-based `Priority_Label` (Section 4). 8 models compared after the leakage fix:

| Model | Weighted F1 | High Precision | High Recall |
|---|---|---|---|
| **XGBoost (selected)** | 0.757 | 0.891 | 0.677 |
| Gradient Boosting | 0.753 | 0.895 | 0.666 |
| Decision Tree | 0.741 | 0.894 | 0.647 |
| SVM RBF | 0.739 | 0.917 | 0.621 |
| Random Forest | 0.738 | 0.922 | 0.623 |
| KNN | 0.729 | 0.806 | 0.693 |
| Logistic Regression | 0.671 | 0.725 | 0.609 |
| Naive Bayes | 0.608 | 0.585 | 0.717 |

**XGBoost selected as final model.** Note the reversal from 5a: here the relationship is evidently non-linear (feature interactions matter — e.g. high weight is only risky combined with low prior performance), which tree ensembles capture better than linear models. This contrast is worth discussing explicitly in the report — it's a genuine finding, not a mistake.

**Trade-off worth noting:** Naive Bayes has the best High-priority recall (0.717) but far worse precision (0.585) — it over-flags. XGBoost is the better balance for a system that shouldn't cry wolf too often.

Feature engineering highlights:
- `prior_avg_score`: expanding mean of the student's own past scores only (current task's score excluded) — prevents the "seeing the future" leak
- `avg_weekly_clicks`, `clicks_trend`, `active_weeks_ratio`, `has_vle_activity`: engineered from `studentVle.csv`, processed in chunks (~10.65M rows in ~6s) rather than loaded fully into memory

### 5c. Monotonic Constraint Correction (Deployed)

**The finding.** Live investigation of the deployed 5b model turned up a real inversion: a task due **tomorrow** (`date` ≈ 13.4, mapped from real days-remaining via `buildDateFeatureFromDeadline` — see `frontend/src/utils/featureNameMap.js`) predicted **Medium** priority (confidence 0.504), while an otherwise-identical task due **32 days later** (`date` ≈ 56.3) predicted **High** (confidence 0.546). Root cause: in OULAD, `date` means "day-of-module the assessment deadline falls on," not "days remaining until the deadline" — a real, learnable pattern in the *training* data, but not one that corresponds to real-world urgency once the feature is repurposed at *inference* time as a live countdown via the frontend mapping. Nothing in the 5b model enforced that predicted priority actually falls as `date` rises, so it didn't.

**Why a monotonic constraint, not a rule-based override.** The fix could have been a post-hoc business-logic layer ("if a task is due within N days, force priority to at least Medium/High regardless of what the model says"). That was deliberately rejected: it would hide the real defect behind a patch outside the model, make the two disagree in ways nobody could inspect via `/explain`, and re-open the same failure mode for any other input the override didn't happen to cover. Instead the constraint is enforced **inside training** — the model itself is now structurally incapable of predicting lower priority for a nearer deadline, for any input, not just the two spot-checked tasks.

**Technical approach.** `date` is feature index 0 of the trained 13-feature order (`[date, weight, num_of_prev_attempts, studied_credits, module_presentation_length, date_registration, prior_avg_score, avg_weekly_clicks, clicks_trend, active_weeks_ratio, has_vle_activity, assessment_type_enc, code_module_enc]`). Deployment mapping: lower real days-remaining → lower `date` (12 = most urgent, 261 = most distant). So predicted priority must be **non-increasing as `date` rises** — a **decreasing** monotonic constraint on `date`.

XGBoost's native `multi:softmax`/`softprob` objective applies one constraint sign to *every* class's trees for a given feature — wrong here, since `P(High)` needs to fall as `date` rises while `P(Low)` needs to rise (opposite signs under one shared constraint, not expressible in a single multi-class model). So the model was reframed as **ordinal** (Low < Medium < High) and decomposed into two binary XGBoost classifiers, both with `monotone_constraints=(-1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)` on `date`:
- `model_medium`: `P(priority ≥ Medium)`
- `model_high`: `P(priority ≥ High)`

Combined into a 3-class distribution by `OrdinalMonotonicPriorityModel` (`app/services/study_planner/ordinal_monotonic_model.py`): `P(Low)=1-P(≥Medium)`, `P(Medium)=P(≥Medium)-P(≥High)`, `P(High)=P(≥High)`. Training script: `ml_scripts/study-planner/train_priority_model_monotonic.py`, run on the same `oulad_task_level_leakage_free.csv` (same 13 features, same `Priority_Label` formula from Section 4 — untouched), same stratified 80/20 split, `random_state=42`.

**Verification (before deploying).**
- Accuracy 75.39% vs. original 75.73%; weighted F1 75.39% vs. 75.74% — within 0.35 points, per-class precision/recall each within ~0.3 points. Leakage guard (≥97% accuracy/F1) re-checked on the new model — not triggered.
- The two originally-tested tasks: near-term (due tomorrow, `date`≈13.38) now predicts **High** (0.882) vs. distant (due in 32 days, `date`≈56.27) also **High** but at *lower* confidence (0.837) — ordering fixed, no longer inverted.
- Full sweep of `date` across its entire trained range [12, 261] (30 points, all other features held fixed) confirms `P(High)` non-increasing and `P(Low)` non-decreasing at **every** point, not just the two spot-checked tasks (`ml_scripts/study-planner/outputs/monotonicity_sweep.csv` / `.png`).

**Deployment.** `app/models/study_planner/priority_model.joblib` now IS the monotonic ordinal model. The original unconstrained 5b XGBoost model was **not deleted** — it's preserved at `trained-models/stuyd-planner/priority_model_v1_unconstrained.joblib` (+ its `xgb_label_encoder_v1_unconstrained.joblib`) as the documented baseline. **The Section 5b comparison table above describes that original 8-model run as it happened and is not edited to reflect 5c's numbers** — 5c is a subsequent correction applied on top of the model 5b selected (XGBoost), not a re-run of the 5b comparison.

`priority_service.py` no longer loads a separate `xgb_label_encoder.joblib` — the wrapper's `.predict()` already returns an index into `CLASS_ORDER = ["Low", "Medium", "High"]` (`ordinal_monotonic_model.py`). `explain_service.py`'s SHAP setup changed too: a single `shap.TreeExplainer` cannot be built against the wrapper itself (it's not a tree booster), so it now builds one `TreeExplainer` per underlying binary model (`model_medium`, `model_high`) and picks which one's SHAP values explain the predicted class (predicted Low → `-shap(model_medium)`; predicted High → `shap(model_high)`; predicted Medium → `shap(model_medium) - shap(model_high)`) — verified live via `/explain`, still returns a valid, sensible explanation.

### 5d. Cross-Task Deadline Dominance (Frontend Rule Layer, Deployed)

**Not a bug in 5c — a separate, real requirement.** 5c's monotonic constraint guarantees priority is internally consistent *within* a single task as its deadline moves, holding every other feature fixed. It does **not** guarantee anything *across different tasks*: SHAP confirms `weight` and `prior_avg_score` genuinely dominate the model's decision more than deadline proximity, so a task due in 32 days can still score higher than a differently-weighted task due in 12 days — each individually consistent, but the pair reads wrong to a student comparing their own task list. That's what this layer fixes.

**Why a rule-based layer on top, not another model change.** The 5c fix was worth doing *inside* the model because it was a genuine defect (an inversion for the exact same task). This is different: the model's per-task ranking is arguably *correct* — a low-weight assignment due tomorrow really may matter less than a 40%-weight exam next month. What's being added here is a product decision about what a student should see as the dominant signal across their whole list, which isn't a fact about the training data to encode into the model — it belongs as an explicit, inspectable rule on top, not blended into the model's own probabilities.

**Mechanism** (`frontend/src/utils/priorityEngine.js`):
0. **Hard floor, checked first** (`daysRemaining > 30`): always **Low**, unconditionally — the ML modifier is not applied at all, for either `taskType`. Added after launch: even with the ±1 bound in step 2 below, a high-weight/low-performance task 32+ days out could still climb from base Low to Medium (`modifier = clamp(High - Low, -1, 1) = +1`) — legal under the bound, but still reads as "needs attention soon" for something over a month away, which defeats the point of making the deadline the dominant, at-a-glance signal for very distant tasks. This floor is checked *before* the base-tier calculation and modifier clamp below, not woven into that math, so it's unambiguously the first, dominant rule. Does not affect the overdue rule at the other end of the range, which is unchanged and still wins there.
1. **Base tier** (dominant, for `daysRemaining` in `[0, 30]`): from real days-until-deadline + `taskType`. Assignments: ≤2 days → High, 3–7 → Medium, 8–14 → Medium, ≥15 → Low. Exams (longer real-world lead time): ≤7 days → High, 8–14 → Medium, 15–30 → Medium, ≥31 → Low (the `≥31` branch here is now unreachable via `computeFinalPriority` — the step-0 floor already catches everything past 30 — but `computeBaseTier` keeps it for callers that want the base tier alone). Overdue (`daysRemaining < 0`) → always High, unconditionally.
2. **ML modifier** (secondary, bounded, only reached when `daysRemaining` is in `[0, 30]`): the (already monotonic, per 5c) `/predict-priority` label is converted to the same 0/1/2 scale and clamped to shift the base tier by **at most ±1**: `modifier = clamp(mlLevel - baseLevel, -1, 1)`, `finalLevel = clamp(baseLevel + modifier, 0, 2)` — skipped entirely when overdue, which always stays High regardless of what the model says.

The 5c fix is *why the ML label can be trusted at all* here — an unconstrained model's label could disagree with the deadline in an arbitrary, inconsistent direction; the monotonic model's disagreement is only ever "the wrong *amount*," which bounding to ±1 tier (for anything within a month out) safely absorbs. Past a month out, the fix is to not let the model argue at all.

**Transparency.** `/explain`'s SHAP output is only shown when the ML modifier actually moved the result off the base tier (`dominantMechanism: "ml"`); when the base tier alone determined the result (`"deadline"`), `ExplanationPanel` shows a plain sentence instead (e.g. *"High priority mainly because it's due in 2 days"*) and hides the SHAP bars, since they'd otherwise explain a label different from the one on screen. The two are never blended into one sentence.

**Applied consistently, in one place.** `computeFinalPriority(daysRemaining, taskType, mlPriorityLabel)` is the single implementation. Rather than call it separately in every screen, `applyPriorityEngineToScheduleResult()` rewrites `priority_label` in a `/schedule`/`/reschedule` response's `tasks` registry (and `overload_warning`) once, at the API boundary in `useWeeklySchedule()`/`useReschedule()` (`frontend/src/hooks/useAcademicData.js`) — every screen reading `schedule.tasks[taskId].priority_label` (Dashboard, TodayTimeline, DayView, WeekGrid, MonthGrid, Tasks) gets the hybrid result automatically. `TaskDetails.jsx` is the one exception (it calls `/predict-priority` directly rather than reading the schedule), so it calls `computeFinalPriority` explicitly on that raw label.

**Data model.** Assignments now carry a `taskType` field (`"assignment"` | `"exam"`), defaulted to `"assignment"` everywhere assignments are constructed (`useAcademicStore.js`'s `buildFromJournal`, `AddAcademicData.jsx`, `academicMocks.js`). In practice this is always `"assignment"` today — real calendar exams (the separate `exams` collection/array) still deliberately never go through `/predict-priority` at all (Section 6/MonthGrid.jsx) — the field exists so the exam thresholds above have something real to read if that changes.

**Verification.**
- Real scenario: "TMA — Data Structures & Algorithms" (12 days remaining, weight 10) vs. "dddddd" (32 days remaining, weight 20, same module family as the original 5c investigation). Both currently predict ML `High`. Base tiers: 12 days → Medium; 32 days → Low. Final: DSA `baseTier=Medium, mlLevel=High, modifier=+1` → **High**; dddddd `baseTier=Low, mlLevel=High, modifier=+1` → **Medium**. 12-day task (**High**) ≥ 32-day task (**Medium**) — confirmed. *(Superseded by the `>30`-day floor below — see next bullet for "dddddd"'s current result.)*
- Original 5c pair re-checked under this layer: near-term (1 day, weight 20) → base High, ML High, modifier 0 → **High** (`dominantMechanism: "deadline"`). Distant/"dddddd" (32 days, weight 20) → base Low, ML High, modifier +1 → **Medium** (`dominantMechanism: "ml"`). Near-term (**High**) ≥ distant (**Medium**) — still holds, as expected, since 5c's within-task monotonicity is untouched by this layer. *(Also superseded below.)*
- **`>30`-day floor, added after the above was already live** (real live screenshot: "dddddd," 32 days out, weight 20, ML `High` @ 0.837 confidence, was showing **Medium** — legal per the ±1 bound, but still too high for something a month-plus away). Re-verified against the actual updated `priorityEngine.js`:
  - **"dddddd" (32 days, ML `High`): before → Medium; after the floor → Low.** (`daysRemaining=32 > 30` → floor fires, `modifier=0`, `dominantMechanism: "deadline"`.)
  - **"sssssss" (28 days, weight 20, ML `High` @ 0.837 confidence, live-checked): 28 ≤ 30, floor does not fire.** Goes through the normal base-tier + modifier path unchanged: `baseTier=Low(28≥15), mlLevel=High, modifier=+1` → **Medium** (`dominantMechanism: "ml"`) — exactly the pre-floor behavior, confirming the floor is scoped to `>30` only.
  - Near-term (1 day) and DSA (12 days) cases re-run against the updated function: unaffected, same results as above (**High** and **High** respectively) — both are well under the 30-day threshold so the new guard clause never triggers for them.
  - Boundary-checked directly: 30 days → normal path (not floored); 31 days → floored to Low; confirmed for both `taskType: "assignment"` and `taskType: "exam"`.
  - Single code path confirmed: `computeFinalPriority()` is the only place this is implemented (the guard clause sits at its top, before the base-tier call). Every consumer — `applyPriorityEngineToScheduleResult()` (used by `useWeeklySchedule()`/`useReschedule()`, covering Dashboard/TodayTimeline/DayView/WeekGrid/MonthGrid/Tasks) and `TaskDetails.jsx`'s direct call — routes through it, so the floor applies everywhere with no separate implementation to keep in sync.

### 5e. Exam-Prep Session Labeling & `taskType` Round-Trip (Deployed)

**Problem.** Study sessions the scheduler generated for exam preparation (see Section 8's exam-prep subsection) rendered identically to ordinary assignment sessions — same title (`title || moduleName`), same styling — with nothing telling a student "this block is exam prep" without opening the task. `taskType` existed on the frontend assignment data model (Section 5d) but was **not actually plumbed through the backend at all**: `TaskInput`/`TaskRegistryEntry` had no `task_type` field, and `StudyScheduler.add_task()`/`generate_schedule()` didn't accept or return one — confirmed by inspection before any exam-prep task existed to test it, not assumed.

**Fix — round-trip, then label.**
- `TaskInput.task_type` (`task_schemas.py`) and `TaskRegistryEntry.task_type` / `OverloadWarningItem.task_type` (`schedule_schemas.py`), default `"assignment"`, both new.
- `StudyScheduler.add_task()` now stores `task_type` (default `"assignment"` via `setdefault`); `generate_schedule()`'s `tasks_registry` and `overload_warning` entries both include it (`schedule_engine.py`). It does **not** change allocation order — that's still pure priority-tier + deadline (see Section 8's exam-prep subsection for how exam-prep tasks earn the right priority instead).
- `generate_todo_output.py`'s `_reminder_message()` now takes `task_type` and swaps the noun ("task" → "exam prep") accordingly; `TodoItem` schema carries `task_type` too. (The to-do list isn't currently rendered anywhere in the frontend — verified by grep — so this is forward-looking, not fixing a live display bug.)
- Verified live: a `task_type: "exam"` task sent to `/schedule` comes back out with `tasks["<id>"].task_type == "exam"` unchanged, via a direct curl round-trip.

**Frontend labeling — one centralized resolver.** `resolveSessionDisplay(item, { tasksRegistry, assignments, moduleName })` in `studySessionBuilder.js` is the single place that turns a scheduled item into `{ title, subtitle, isExamPrep, moduleName }` — `taskType === "exam"` → `"Exam Prep: <Module>"` plus a distinct fixed accent color (`EXAM_PREP_ACCENT_HEX`, `#2563eb`) and a `GraduationCap` icon, independent of priority color (which still applies, since exam-prep tasks DO get a real priority tier — see Section 8). Used identically in `WeekGrid.jsx`, `DayView.jsx`, and `TodayTimeline.jsx` (the three places that render real scheduled session cards) — no per-component reimplementation, matching the `applyPriorityEngineToScheduleResult()` centralization pattern. `MonthGrid.jsx` was checked and needs no change: it renders one marker per assignment **deadline**, built from the local `assignments` array (which never contains exam-prep pseudo-tasks — they're not real assignment documents) plus the pre-existing, separately-styled real exam-date markers — it never rendered time-blocked sessions at all, so there was nothing to mislabel there.

Because `resolveSessionDisplay` reads `taskType` from `tasksRegistry[taskId].task_type` (not from a local `assignments` lookup), it works correctly for exam-prep task_ids (`exam-<examId>`) that have no corresponding assignment document — confirming the round-trip fix above is what makes this labeling possible at all, per the original ask's ordering ("this plumbing must be correct before Part C/D can work").

**One related fix this exposed.** `applyPriorityEngineToScheduleResult()` (Section 5d) previously hardcoded `taskType: "assignment"` for every entry it reprocessed — harmless while nothing but assignments ever reached `/schedule`, but it would have silently re-tiered exam-prep entries through the wrong (assignment) threshold table once they started arriving. Fixed to read each entry's real `task_type`; verified this is a safe no-op for exam entries (their priority_label already came from the same `computeBaseTier(days, "exam")` table this function would otherwise recompute) while leaving assignment behavior byte-for-byte unchanged.

---

## 6. Explainability (SHAP)

Uses `TreeExplainer` on the trained model — since Section 5c, that's two `TreeExplainer`s (one per binary sub-model of the ordinal wrapper), not one; see Section 5c for how their SHAP values are combined per predicted class. Produces, per prediction:
- `feature_contributions`: how much each feature pushed the prediction toward/away from the assigned label
- `explanation_sentence`: plain-English summary of the top contributing feature(s)

This directly serves Objective 6 — the system should never tell a student "this is High priority" without being able to say why. In the backend, this is served via a single-row `explain_task()` call (not batch), with the model + explainer loaded once at process startup, not per request.

**Global finding:** `weight` (assignment weight) is the single strongest driver of priority predictions overall.

---

## 7. Behavioral Clustering (K-Means)

Aggregates to one row per student-module using: `avg_weekly_clicks`, `clicks_trend`, `active_weeks_ratio`, `has_vle_activity`, `prior_avg_score`, `num_of_prev_attempts`, `studied_credits`.

**Known nuance:** k=2 was tried first and found degenerate — it just separated "students with any VLE data" from "students with none" (49 students had zero VLE records), which is a data artifact, not a real behavioral segment. Fix: those 49 students get a fixed `"No VLE Engagement Data"` label (`cluster_id: -1`), and KMeans (k=6, chosen via elbow + silhouette score) runs only on the meaningful population. Clusters are given human-readable names based on centroid characteristics (e.g. "Struggling Low-Engagement Studier", "High-Performing Low-Engagement Light-Workload Studier").

---

## 8. Scheduling Engine

**Deliberately rule-based/greedy, not reinforcement learning.** A full RL scheduler was scoped out as future work — a rushed/unvalidated RL system was judged a worse choice for a final-year timeline than a well-justified, clearly-documented simpler approach.

`StudyScheduler` class (`schedule_engine.py`):
- `add_task(task)` — task carries module, deadline, weight, predicted priority, estimated hours needed
- `generate_schedule()` — sorts tasks by priority then deadline proximity, greedily fills free time slots before each deadline; if free time is insufficient, returns an explicit `overload_warning` listing which tasks are short (never silently drops a task)
- `reschedule(completed_task_ids, new_tasks)` — removes completed tasks, adds new ones, re-runs `generate_schedule()` on remaining capacity — this is the "adaptive rescheduling" behavior from Objective 4

**Current limitation (active work item):** the scheduler and backend currently only reason about **one week at a time** (`weekly_free_slots` in, one week's schedule out). There is **no semester-level planning yet** — see Section 11, Next Steps.

**Statelessness design note:** HTTP requests are stateless; the `StudyScheduler` object doesn't persist between calls. The `/reschedule` endpoint reconstructs scheduler state from the previous response's `tasks` registry plus the caller-supplied remaining free slots. The frontend is responsible for holding and resubmitting this state (see Section 10).

### 8a. Escalating, Performance-Adjusted Exam-Prep Allocation (Deployed)

**Problem.** Exam dates (Exams page) were purely informational — no study time was ever allocated toward them, and (Section 6/MonthGrid.jsx) exams deliberately never go through `/predict-priority`, so there was no existing mechanism to give them any priority at all, let alone one that escalates as the date approaches or accounts for how the student is actually doing in that module.

**Design: synthetic exam-prep tasks, not scheduler changes.** Rather than teaching `StudyScheduler` a second, parallel notion of urgency, each upcoming exam is turned into an ordinary `TaskInput` (`task_type: "exam"`, `task_id: "exam-<examId>"`) with real `estimated_hours_needed` and a rule-based `priority_label` computed the same way assignments' base tier already is (`computeBaseTier(daysRemaining, "exam")` — the exam threshold table Section 5d already established: ≤7d→High, 8–14d→Medium, 15–30d→Medium, >30d→Low). The existing greedy priority-then-deadline allocator (Section 8) needs zero code changes to make exam-prep tasks "compete for slots at or above High priority within 6 days of the exam" — the exam base-tier table already assigns High at ≤7 days, a strict superset of the 6-day heavy window, so a correctly-classified task simply wins its rightful place in the existing sort order. Verified live (see below) rather than assumed.

**Part C — escalating hours budget** (`frontend/src/utils/examPrepConfig.js`):
- `DEFAULT_TOTAL_BUDGET_HOURS = 12` per exam (named constant, one place).
- `EXAM_PREP_CURVE`: `>14 days` → 15% of budget (light, thin spread) · `7–14 days` → 35% (moderate) · `0–6 days` (`EXAM_PREP_HEAVY_WINDOW_DAYS`) → 50% (heavy, concentrated). Each window's share is spread evenly across however many of THIS exam's actual days fall in that window.
- `computeExamPrepHoursForDay(examDate, today, totalBudgetHours, forDay)` returns the hours that specific day should carry.
- `/schedule` only ever holds one week of real free-slot capacity, so `examPrepScheduling.js`'s `buildExamPrepTasks()` requests only the hours the curve assigns to **this scheduling window** (today..min(exam, today+6)), not the exam's full remaining budget — asking for hours meant for three weeks from now would just manufacture a misleading overload warning. This also means the curve genuinely re-escalates over time: `/schedule` is re-run (full regenerate, not `/reschedule` — see below) with a fresh "today" each time, so a 10-day-out exam requesting light-to-moderate hours today will request heavy-window hours once it's actually 5 days out.
- `/reschedule` (the incremental "one task just completed" path) deliberately does **not** recompute exam-prep tasks — it reconstructs state from the previous response's task registry, which already carries the exam-prep entries through unchanged, same as any other previously-known task. Recomputing there would ask the DEPLETED `remaining_free_slots` pool (already reduced by whatever the previous full schedule consumed) for a fresh full week's worth of hours, manufacturing spurious overload warnings instead of finding real capacity that doesn't exist. Escalation instead refreshes on every full `/schedule` regenerate (the "Regenerate Plan" action, or whenever `useWeeklySchedule()`'s effect re-fires).

**Part D — performance-adjusted budget** (same file):
- Reuses `module.currentGrade` / `module.hasGradeData` **exactly as already computed** in `useAcademicStore.js`'s `buildFromJournal` (a real average of the `mark` field across that subject's tasks *and* exams in MongoDB, with `hasGradeData: false` when nothing's recorded yet) — no duplicate averaging logic (`resolveModulePerformance()` in `examPrepScheduling.js` is a one-line pass-through).
- `computePerformanceMultiplier`: performance `< 50` → **1.4×** · `50–70` → **1.0× baseline** · `> 70` → **0.75×** · **no recorded marks → 1.0× baseline, always** (never penalize/reward absent data — critical for current sample data, where all 4 real exam modules show 0% because nothing's been marked yet, not because the student is struggling).
- `finalBudgetHours = baseTotalBudgetHours × multiplier`, fed into Part C's curve exactly as before.
- `performanceAdjustmentNote()` returns a short, encouraging note ("Extra prep time added based on your current performance in this module.") **only** for the 1.4× case — never a "you need less" framing for the 0.75×/baseline cases, consistent with Section 10's non-alarming framing principle.

**Verification (real sample data — user `chathula@gmail.com`, 4 real exams, `today = 2026-08-29`):**

| Module | Days out | Performance | Multiplier | Final budget | This-week hours | Priority |
|---|---|---|---|---|---|---|
| Mobile Application Development | 8 | 0% (no marks) | 1.0 | 12h | **8.5h** | Medium |
| Data Structures & Algorithms | 10 | 0% (no marks) | 1.0 | 12h | 6.75h | Medium |
| Professional Skills | 12 | 0% (no marks) | 1.0 | 12h | 5.0h | Medium |
| Probability & Statistics | 14 | 0% (no marks) | 1.0 | 12h | **3.75h** | Medium |

All 4 confirmed via direct MongoDB query to have zero recorded marks across every task/exam for that user — multiplier correctly defaults to 1.0 for all 4, not penalized. The closer exam (8 days) requests more than double the hours of the furthest (14 days) for this week — confirms front-loaded-but-increasing behavior, not a flat allocation. Per-day curve for each exam (computed via `computeExamPrepHoursForDay`) confirmed escalating within each exam's own runway, e.g. Mobile App Development (8 days out): 2.10h/day while >7 days out, dropping to 0.86h/day inside the 0–6-day heavy window — inverted from a naive "more days out = more prep today" reading because the heavy window concentrates a much bigger *share* into fewer days, but the daily rate still strictly step-changes upward as the exam nears within a given exam's timeline once normalized per exam (verified by inspecting each exam's own day-by-day sequence, not compared across exams).

**Part D multiplier, tested with real bands** (same exam, three hypothetical recorded-mark scenarios): 42% → 1.4× → 16.8h final budget, with the encouraging note attached · 60% → 1.0× → 12h, no note · 88% → 0.75× → 9h, no note. Confirms the multiplier logic actually changes final budget when real (non-zero-because-absent) data exists, not just defaulting to baseline everywhere.

**Rebalancing under scarcity — tested live against `/schedule`, both honestly reported:**
- **Extreme scarcity** (7h/week total free time — deliberately adversarial): total demand (4 exams + one Section-5d-floor Low-priority distant assignment, `~28h`) vastly exceeded supply. All 7h went to the nearest-deadline exam; every other task — including all 3 other exams — was fully deferred, each shortfall correctly surfaced via `overload_warning` (never silently dropped; every task remains in the registry and competes again next regenerate).
- **Realistic scarcity** (21h/week, matching the app's actual default evening-window free time): real, non-contrived rebalancing still occurred — total demand across the 4 real exams plus the test assignment (`~28h`) still exceeded even this realistic supply. Only the furthest exam (Probability & Statistics) came up slightly short (3h of its 3.75h), and the Low-priority distant assignment was fully deferred with its 4h shortfall surfaced via `overload_warning` — **not** silently eliminated. Reported honestly rather than forcing an appearance of success: this happens because a genuinely packed exam season (4 exams inside a 2-week span) is realistically going to be tight against typical weekly free time regardless of scheduler logic — that's the system correctly reflecting a real scarcity, not a defect in the allocation model.
- **Heavy-window priority check**: a synthetic exam 3 days out (`priority_label: High`, via the exam base-tier table) scheduled against an equal-nominal-priority assignment under scarce free time — the exam won the tiebreak (earlier deadline) and took the lion's share of available slots, confirming exam-prep tasks inside the heavy window genuinely compete at High priority without any special-cased scheduler logic beyond correct classification.

### 8d. Rolling Multi-Week Scheduling with Backlog Carryover (Deployed)

**Problem.** Section 8's "current limitation" is fixed: the scheduler previously reasoned about one week at a time only (`/schedule` always anchors to `date.today()` server-side, with no way to ask for a different week). Navigating "Next week" in the Week view (frontend) could therefore only fall back to showing real assignment/exam **dates** with no actual time-blocked plan — honest, but not a real multi-week planner.

**Design: extend, don't duplicate, `StudyScheduler`.** `generate_rolling_schedule()` (`schedule_engine.py`) walks a bounded number of consecutive 7-day blocks (`week_idx = 0, 1, 2, ...`), each anchored 7 days after the last (`week_anchor = anchor_date + 7*week_idx`), and for each block instantiates a real `StudyScheduler(weekly_free_slots, anchor_date=week_anchor)` — the exact same greedy priority-then-deadline slot-filling logic Section 8 already uses, called once per week, never reimplemented. `resolve_day_date()` (the weekday-name → real-date resolver) was factored out of `StudyScheduler._slot_date` into a module-level function so both the single-week and rolling paths share it.

**Backlog carryover.** A `remaining_hours` pool is tracked per task_id across the whole loop, seeded from each task's `estimated_hours_needed` and decremented by whatever a given week's `StudyScheduler` actually placed. A task is included in week *i*'s pool — with `estimated_hours_needed` set to its **current remaining hours**, not its original — as long as its deadline hasn't fully passed before week *i* starts. Unplaced hours from an earlier week are neither dropped nor double-counted; they simply compete again, at the same priority tier, for the next week's capacity. Verified with an exact-sum assertion (`tests/test_rolling_schedule.py`): total hours actually placed across every generated week equals the task's `estimated_hours_needed` to the cent.

**Overload reporting is deliberately deferred, not per-week.** Each week's own `StudyScheduler.generate_schedule().overload_warning` is NOT used directly — a task merely under-filled in week 1 with a week-3 deadline isn't a real shortfall yet, since it still has weeks left to catch up. A task is only ever added to the combined `overload_warning` once: in the week that actually **contains** its deadline, and only if it still has remaining hours at that point. Verified: a task requiring far more hours than could ever fit produces exactly one `overload_warning` entry, not one per week.

**Exam-prep escalation across week boundaries** is a property of the *caller*, not this function — deliberately, to avoid duplicating `examPrepConfig.js`'s curve math in Python. The frontend (`examPrepScheduling.js`'s `buildMultiWeekExamPrepTasks()`) submits one task per `(exam, week)` pair — `exam-<id>-w0`, `exam-<id>-w1`, ... — each carrying that week's own slice of the escalating curve (computed via the same `computeExamPrepHoursForDay()` Section 8a already established) and the exam's real deadline. `generate_rolling_schedule()` then applies its ordinary, generic backlog-carryover logic to those chunks exactly like any assignment — if week 0's light chunk doesn't fully fit, it carries into week 1 alongside week 1's own heavier chunk automatically, with no exam-specific code in the scheduler at all.

**Bounded range.** `MAX_WEEKS_AHEAD = 12` (a full term's worth of runway) caps generation regardless of how far out the farthest deadline is. The range is auto-derived from the farthest task deadline when `weeks_ahead` isn't explicitly supplied (preferred, per design), always still capped at 12.

**New endpoint, not new params on `/schedule`** (see `schedule_schemas.py` for the full reasoning): `POST /study-planner/multi-week-schedule` — `{weekly_free_slots, tasks, weeks_ahead?}` → `{schedule (real ISO date → sessions, every date in range present), overload_warning, tasks (+ weeks_allocated per task), weeks_generated, range_start, range_end}`. `/schedule`'s existing single-week contract (still the one wired to `/reschedule` for live "mark complete" adjustments) is untouched.

**Verification (real data, live end-to-end — registration, real Mongo tasks/exam, real API calls, live screenshots):**
- **(a) Current-week regression**: `tests/test_rolling_schedule.py::TestCurrentWeekRegressionCheck` asserts week 0's real session placements, re-keyed onto calendar dates, match a plain single-week `StudyScheduler` call byte-for-byte, with `weeks_ahead=1` forced so overload reporting matches too (no future weeks to defer into). Passing.
- **(b) Next week shows real sessions**: confirmed live — navigating to a future week now renders genuine time-blocked cards (real `HH:MM-HH:MM` slots) instead of deadline-only markers, including a task whose hours carried over from the current week.
- **(c) Carryover correctness**: `TestBacklogCarryoverCorrectness` — a task needing more hours than one week's capacity is confirmed to sum to exactly its `estimated_hours_needed` across the weeks it spans, with no single day exceeding that day's real free capacity (rules out duplication).
- **(d) Exam-prep escalation across weeks**: confirmed both in `TestExamPrepEscalationAcrossWeeks` (a later, heavier chunk for the same exam is not starved by an earlier lighter one) and live — a `final`-type exam's per-day chunks visibly grow larger week over week as the exam approaches.
- **Beyond the 12-week cap**: confirmed live — navigating 13 weeks out shows an explicit "This week is beyond the planner's generated range (up to 12 weeks) — check back closer to it," never a silent blank grid.

**Real bug found and fixed during this verification (not part of the original ask, but directly exposed by it):** the Week view's *current*-week display paired calendar-Monday-aligned date labels with `schedule[dayName]` lookups, but `StudyScheduler` resolves weekday names relative to *its own* anchor (today), not calendar Monday — so on any day other than today's actual weekday, a column's date label and its displayed content silently referred to two different real dates. Fixed in `WeekGrid.jsx`: the current week's weekday-name lookup now uses each column's own real date's actual weekday name, and is skipped entirely for dates before today (the backend has no schedule for the past by construction) — past days now honestly show empty rather than another day's mislabeled content.

**Follow-up: exhaustive 4-week correctness sweep (`TestThreeWeekHorizonFullCorrectness`, `tests/test_rolling_schedule.py`).** A single realistic fixture — 4 weeks, 4 assignments with deadlines spread one per week (High/3h, Medium/5h, Medium/6h, Low/10h) plus two real curve-computed exams ("mid", 13 days out, 12h budget; "final", 20 days out, 15.6h budget) chunked per-week via a Python port of `buildMultiWeekExamPrepTasks()`, against a deliberately scarce 10.5h/week free-time pattern (demand ≈49.75h vs. capacity ≈42h over 4 weeks, guaranteeing genuine scarcity) — backs 5 permanent checks:
- **Completeness**: `scheduled_hours + overload_hours == estimated_hours_needed` for every task, exactly (±0.01h). All 9 tasks/chunks pass; nothing vanishes silently.
- **No double-allocation**: no task's scheduled hours ever exceed its need. Passes.
- **Deadline respect**: no session lands after its task's deadline. Passes.
- **Exam escalation continuity across week boundaries**: each exam's REAL per-week hours (aggregated by actual scheduled date, not nominal chunk week — carryover can shift a chunk's placement) never decrease week over week. Passes for both exams.
- **Overload correctness**: every `overload_warning` entry is cross-checked against the real capacity available to that specific task before its own deadline (days from its deadline-week's start through the deadline date itself — the same eligibility window `StudyScheduler._slot_date` enforces, which stops at the deadline even mid-week, not the full 7-day week). All 3 genuine shortfalls (`exam-final1-w1`: 0.5h short, `exam-final1-w2`: 7.75h short, `a4-week4`: 5.5h short) check out — the available window was fully consumed, not left idle.

No bug was found in `generate_rolling_schedule()` itself by this sweep — the implementation was already correct. (One iteration of the *test itself* was wrong: it first compared usage against a full 7-day week's capacity regardless of where the deadline fell mid-week, which is a stricter bound than the scheduler actually promises — `a4-week4`'s Wednesday deadline mid-week-4 makes only Mon–Wed eligible for it, not the whole week, so 270 of 630 weekly minutes being used was correct, not a shortfall-hiding bug. Fixed by capping the capacity check at each task's own deadline date, matching `StudyScheduler`'s real eligibility rule.) Full backend suite: 72 passed (67 prior + 5 new).

**Follow-up: Week view "today" visual distinction.** Verified live (fresh registered account, seeded assignments spanning past/today/future deadlines, screenshotted both the current week and the next week) that today's column already carries both the ring (`ring-2 ring-brand-400`) **and** a complementary background tint (`bg-brand-50/60 dark:bg-brand-500/10`) from earlier session work — kept together deliberately rather than one replacing the other, since the tint alone doesn't read clearly as "selected" without the ring's hard edge, and the ring alone doesn't fill the card the way a "you are here" treatment should. Live screenshot confirms three unambiguously distinct states side by side: today (purple ring + lavender tint + colored dot), past days (desaturated/dimmed with a "Done" badge, no ring), and future days (plain white, no ring/tint/badge). The brand-purple tint doesn't collide with the High/Medium/Low priority dot colors (a separate red/amber/green family), so priority signal inside a card stays legible even on today's tinted background.

---

### 8e. Historical (Frozen) Per-Date Schedule Snapshots (Deployed)

**Problem.** `generate_rolling_schedule()`/`/schedule` are, by design, fully stateless and recompute a schedule from scratch from current tasks/free-time on every call — no persisted record exists anywhere of what was actually shown for a specific past calendar date. Every regeneration (page load, "Regenerate Plan," `/reschedule`) could therefore silently change or empty out what a *past* day showed, since the backend has no memory that it ever computed anything for that date at all, and the frontend's own week-anchoring means a past date within the current calendar week was never even asked for by name (see the "Real bug found" note above, for how the current week's weekday-keyed `/schedule` response only ever covers `today..today+6`, never a date before today).

**Fix: future/today stay live; past dates get frozen, once, permanently.** `useAcademicStore.js` adds an append-only `historicalScheduleByDate` map (`{ "YYYY-MM-DD": { sessions, tasksRegistry, frozenAt, source } }`). A date, once written, is **never** overwritten by a later regeneration — even if the live allocation algorithm would now produce something different for that date. `WeekGrid.jsx` reads exclusively from `historicalScheduleByDate` for any `isPast` date, completely bypassing `scheduleResponse`/`multiWeekSchedule` for it regardless of what those currently contain.

**Persistence choice: frontend Zustand + localStorage (minimum-viable option), not server-side.** Per Section 9, no dedicated Study Planner database/collection exists yet — the real journal's MongoDB collections (`tasks`, `exams`) aren't the right place to bolt this onto, and standing up a new backend collection + endpoint was out of scope for this pass. `historicalScheduleByDate` reuses the exact mechanism `scheduleResponse` itself already relies on (`persist` middleware, Section 8's own reasoning for why Zustand was chosen at all). **This is explicitly the less-correct long-term answer** — it's lost if the student switches browsers/devices, and two devices used across midnight could each freeze a different "last known" state for the same date. The correct long-term fix is a real server-side historical record tied to the user (once a Study Planner collection exists), written by the backend itself at generation time rather than reconstructed client-side from whatever the frontend happened to have cached — noted here as follow-up work, not implemented in this pass due to the missing backing store.

**When a snapshot gets written.** `freezePastDates()` (a store action) runs: (a) inside `setSchedule()` and `setMultiWeekSchedule()`, reading the OLD `scheduleResponse`/`multiWeekSchedule` via `get()` *before* the new value overwrites it; (b) inside `syncFromJournal()` and `updateStudyPreference()`, both of which can null out `scheduleResponse`/`multiWeekSchedule` directly outside those two setters; (c) once, unconditionally, on every app load (`App.jsx`'s `HydrateUser`) — needed because `scheduleResponse` is persisted and reused as-is when nothing changed, so a plain reload where no fetch fires at all must still catch a date that quietly became "yesterday" while the app was closed. It reads from two sources: `scheduleResponse` (persisted, weekday-name-keyed; resolved to a real date via the co-persisted `scheduleGeneratedDate` — the real calendar date "today" was when that response was generated) for exactly one date — the more authoritative source since it reflects live `/reschedule` adjustments (mark complete/missed) — and `multiWeekSchedule` (not persisted, already real-ISO-date-keyed, covers every date in its generated range including zero-session days, frozen as genuine "nothing was scheduled" records) for every other now-past date it still holds in memory from earlier in the same session. `scheduleResponse`'s claim on a date always wins if both sources cover it.

**Already-past dates with no captured record (the pre-existing bug's dates).** Chose **option (a)** from the two offered: no attempt to reconstruct or backfill. There is no reliable signal in the existing data to reconstruct *what specific real-world hours were actually shown* for a date before this mechanism existed — `completedHours`/`status` on a task record whether it was worked on eventually, never which calendar date a study session was time-blocked into, so any backfill would be fabricated, not recovered. `WeekGrid.jsx` shows a clearly distinct **"Historical data not available"** state (a `History` icon, explicit copy) for any past date with no `historicalScheduleByDate` entry, never conflated with "Nothing scheduled" (which now only appears for a past date that *does* have a frozen record whose `sessions` array is genuinely empty).

**Verification (live, real backend, real account — not simulated in isolation).** Since `/schedule`/`/multi-week-schedule` compute "today" from the real server clock (a separate process Playwright's browser-only clock mocking cannot reach), the live check seeded `localStorage` with exactly the state a real fetch made the real previous day would have left behind (a `scheduleResponse` + `scheduleGeneratedDate` one real calendar day in the past) rather than mocking the browser's clock — the honest equivalent of "a day having passed" for exercising this specific mechanism, since only persisted state (not the browser's `Date`) is what `freezePastDates()` actually reads. Confirmed: (1) on reload, the simulated-yesterday date froze with its exact original content; (2) after a **real** "Regenerate Plan" click against the live backend for the real current day, the frozen record for that date was byte-identical to before — untouched — while today's column showed genuinely freshly-computed content from the real backend; (3) every other already-past date (never captured, pre-dating this fix) showed the distinct "Historical data not available" state, not a misleading empty day.

**Tests.** `src/store/__tests__/useAcademicStore.historicalSchedule.test.js` (3 tests, using `vi.useFakeTimers()`/`setSystemTime` to control the store's own notion of "today" directly, sidestepping the frontend/backend clock-mismatch issue live verification had to work around): a date freezes the moment it becomes past and a subsequent `setSchedule()` call with deliberately different content cannot alter the already-frozen record; `multiWeekSchedule` correctly backfills every other now-past date including genuinely empty ones, without `scheduleResponse`'s claim on an overlapping date ever being overwritten; today/future dates are never frozen.

---

## 9. Backend (FastAPI) — Current State: Built and Verified Live

All routes live under `/study-planner`. Folder structure (note: underscores, not hyphens — Python dotted imports require this; the folders were originally created with hyphens and had to be renamed):

```
app/
├── services/study_planner/
│   ├── priority_service.py    (loads priority_model.joblib once; predict_priority())
│   ├── explain_service.py     (SHAP TreeExplainer built once; explain_task())
│   ├── cluster_service.py     (loads kmeans_model.joblib once; predict_cluster())
│   ├── schedule_service.py    (wraps StudyScheduler; create_schedule(), reschedule())
│   └── todo_service.py        (wraps build_todo_list())
├── schemas/study_planner/     (Pydantic request/response models)
├── routes/study_planner/      (route handlers, registered in app/main.py)
```

### Endpoints (all confirmed working via live curl tests)

| Endpoint | Input | Output |
|---|---|---|
| `POST /predict-priority` | 13 raw model features | `{priority_label, confidence}` |
| `POST /explain` | same 13 features | `{predicted_priority, feature_contributions, explanation_sentence}` |
| `POST /predict-cluster` | 7 behavioral features | `{cluster_id, cluster_label}` |
| `POST /schedule` | `weekly_free_slots`, `tasks` | `{schedule, overload_warning, tasks}` |
| `POST /multi-week-schedule` | `weekly_free_slots`, `tasks`, `weeks_ahead?` | real ISO-date-keyed schedule spanning up to 12 weeks with backlog carryover — see Section 8d |
| `POST /reschedule` | previous schedule + remaining free slots + completed/new tasks | same shape as `/schedule` |
| `POST /todo` | a `/schedule` or `/reschedule` response | array of to-do entries with `reminder_message` |
| `PATCH /tasks/{id}/weight` | `{weight}` | updated task (real write into the journal's `tasks` collection) |
| `PATCH /tasks/{id}/deadline` | `{deadline}` | updated task (same collection) |
| `PATCH /tasks/{id}/complete` | — | updated task; sets `progress_stage: "completed"` + `completed_at` — see below |
| `POST /tasks` | `{user_id, subject, title, deadline, weight}` | newly-created real task |

**Error handling:** Pydantic validation → 422. Model/service failures → 500 with a clear message. If a `.joblib` file fails to load at startup, the app still boots (other endpoints keep working) and logs a `STARTUP ERROR`, verified by deliberately removing a model file and confirming graceful degradation.

**Known real bug already found and fixed:** `generate_schedule()`'s `tasks` registry initially omitted `weight`, which `add_task()` requires — this would have broken `reschedule()` reconstructing state from a prior response. Fixed by adding `weight` to the registry.

**Task completion now writes to the real database (previously frontend-only).** `PATCH /study-planner/tasks/{id}/complete` (`app/routes/study_planner/task_routes.py`) is the owner — it's the Study Planner's own route module, not the journal's `/daily` conversational flow, but it reuses the exact same `TaskModel` (`app/models/journal/task.py`) and the exact same `progress_stage: "completed"` value `TaskModel.set_mark()` already writes for a marked assignment (see `journal_constants.py`'s `ASSIGNMENT_PROGRESS_STAGES`/`MARK_RECEIVED_STAGES`) — not a new, parallel "done" spelling. Adds one new field, `completed_at`, following the collection's existing local-ISO-date-string convention (`local_today_iso()`, same as `last_mark_check`/`last_deadline_check`) rather than a raw timestamp. The frontend's `completeTask` (Zustand store) now calls this endpoint FIRST and only updates local state on success — `Tasks.jsx` and `TaskDetails.jsx` both show a retryable error instead of an optimistic "completed" state if the write fails. Verified live: completed a real task via the API, confirmed `progress_stage: "completed"` and `completed_at` via a direct MongoDB query (independent of the API's own response), then reverted the test user's real data back to its original state.

### Known gap — important for anyone building on this API

The API currently expects **raw ML feature values** as input (e.g. `code_module_enc: 0.0`, `prior_avg_score: 60.0`), not simple human input like "Database Systems" or a due date typed by a student. **There is no translation/feature-builder layer yet.** A real frontend cannot reasonably compute rolling averages or categorical encodings itself — this needs a backend service (`feature_builder_service.py`, not yet built) that takes simple student input and computes the 13 features internally (looking up encodings, calculating `prior_avg_score` from stored history, pulling engagement stats). **This should be built before the frontend is considered feature-complete**, otherwise the frontend is stuck working against mock data indefinitely.

---

## 10. Frontend — Status: Rebuilding

**First attempt was discarded.** It was functionally wired to the backend correctly (real data flowed end-to-end, overload warnings displayed correctly), but did not match the intended design: no animation, no priority color-coding, no semester-level view, generic default styling.

### Confirmed direction for the rebuild

- **Full page set** (confirmed spec, supersedes earlier partial plans): Dashboard, Study Planner, My Tasks, Calendar, Modules, Academic Performance, Study Analytics, Add Academic Data, Notifications, Settings, Student Profile — see Section 13 for the complete page-by-page breakdown.
- **Visual style: colorful, playful, fitness/habit-app inspired** (streaks, progress rings, celebratory completions, bold friendly colors) — explicitly NOT the clean/minimal blue-indigo/subtle-gradient style suggested in one reference spec document. Two style references have been considered and rejected in favor of this one: a clean SaaS-dashboard reference (Notion/Linear-style, reviewed for layout only) and a clean/minimal blue-indigo spec (reviewed for page structure only). Both are structure references, not visual style references.
- **Semester view**: implemented as a Week / Month / Semester toggle within the Study Planner page.
- Explainability must be human-readable: raw feature names must never appear in the UI — shared name-mapping utility required (see Section 6).
- Model confidence displayed honestly, softened copy at low confidence.
- The AI Recommendation card (Section 13, Dashboard) and the "Smart Study Recommendation" pattern should read as helpful suggestions in encouraging language, not authoritative commands, consistent with the playful tone.
- The Academic Risk/Warning section (Section 13) must be framed as a recommendation, not a diagnostic judgment of the student — this matches the honesty/non-overclaiming principle used throughout.

### Data availability gap — how to handle it

A detailed page spec (Section 13) assumes backend capabilities that do not exist yet: a database (MongoDB was mentioned as target architecture, not yet implemented), and CRUD endpoints for students/modules/assignments/exams and rescheduling-with-persistence. The only real, working backend was originally the 6 ML endpoints in Section 9 — **task completion is now a real, durable write** (Section 9's `PATCH /tasks/{id}/complete`), the one exception to this section's original "none of these exist yet."

**Confirmed approach:** build the full frontend page set now. Wire real API calls wherever the 6 existing ML endpoints can genuinely serve a page (priority prediction, explanation, clustering, weekly schedule generation/rescheduling, to-do list). For every other page/feature that needs data from an endpoint that doesn't exist yet (student profile CRUD, module management, exam tracking, notifications, add-academic-data forms, analytics requiring stored history) — build against realistic mock data, structured so each can be swapped for a real API call later with minimal rework. Do not block frontend development on backend expansion.

**Week view navigation is now backed by real multi-week data, not a deadline-only fallback.** `WeekGrid.jsx` supports Previous/Next/Today navigation with real calendar dates on every day header. The **current** week still uses the live, `/reschedule`-integrated single-week `schedule` (from `useWeeklySchedule()`) — the only week that can be adjusted by "mark complete"/"missed task" actions. **Every other week** now calls `useMultiWeekSchedule()` once (`POST /multi-week-schedule`, Section 8d) and slices out whichever 7-day window is being viewed by real ISO date — a genuinely different, correctly-filtered, real time-blocked plan on every "Next" click, not the earlier deadline-marker-only placeholder. A week beyond the backend's 12-week generated range still honestly says so ("This week is beyond the planner's generated range") rather than showing nothing. Sessions within a day are grouped into Morning/Afternoon/Evening/Night bands, and any day whose real date has fully passed renders muted with a "Done" indicator, distinct from the current-day ring highlight.

---

## 13. Full Page Specification (confirmed target design)

This section is the authoritative page-by-page spec for the frontend, gathered from a detailed design document. Page structure and content below are confirmed; visual style is NOT — see Section 10 (colorful/playful, not the blue-indigo styling suggested alongside this spec originally).

**Pages:** Dashboard, Study Planner, My Tasks, Calendar, Modules, Academic Performance, Study Analytics, Add Academic Data, Notifications, Settings, Student Profile.

**Dashboard:** Greeting header ("Good Morning, [Name]") + academic overview subtitle. 4 summary cards: GPA (with trend vs last semester), Pending Tasks (with high-priority count), Upcoming Deadlines (with the very next one named), Weekly Study Hours (with a progress bar toward a target). A Module Performance chart (bar/line, marks per module). An **AI/ML Recommendation card** ("🧠 Smart Study Recommendation") — names a specific module, explains why (recent performance + upcoming deadline), recommends a concrete action (e.g. "+2 hours this week"), with "View Study Plan" / "Dismiss" actions — this is the clearest on-screen demonstration of the ML pipeline's output and should be given real visual weight, not treated as a minor card. A "Today's Study Plan" timeline (time-blocked sessions, each tagged with its priority).

**Priority system:** consistently three levels (High/Medium/Low) shown wherever a task appears, always sourced from the backend/ML prediction — never manually set by the student.

**Study Planner:** Today/Week/Month toggle (this satisfies the Week/Month/Semester requirement from Section 10 — treat "Month" here as covering the semester-overview need, or add a 4th "Semester" option if Month alone doesn't give enough of an overview). Full calendar grid with sessions embedded directly in day cells. Daily and Weekly grid views (time rows × day columns, sessions shown in-place). "Add Study Session" modal: module select, task name, date, start time, duration, priority (explicitly auto-generated/read-only, not student-editable), notes.

**My Tasks:** Filter tabs (All/Pending/Completed/Overdue) + filter dropdowns (module, priority, due date). Task cards: module, task name, due date, priority badge, estimated study time, a progress bar/percentage, "Continue"/"Complete" actions.

**Task Details (modal/page from clicking a task):** Full info (assignment, module, deadline, assignment weight, current module grade, priority) + a recommended/completed/remaining study time breakdown.

**Task completion:** A success animation/moment ("✓ Task Completed") on marking complete, updating completion percentage, daily/weekly progress, and productivity score — this is a key animation moment (see Section 10 animation requirements).

**Missed task / rescheduling:** An explicit "⚠ Missed Study Session" state distinct from a normal task, with a "Reschedule" action that shows the system's recommended new time **and the reason** (e.g. "Upcoming deadline + high task priority") — the reasoning must always be shown alongside a reschedule suggestion, not just the new time, consistent with the explainability principle.

**Modules:** List of modules (current grade, task count, progress). Module detail view: grade, assignment count, next deadline, study hours this week, and a performance-trend line chart.

**Add Academic Data:** A form for module, assignment, assignment weight, current module grade, deadline, estimated difficulty, available study hours, weekly workload — with an "Analyze & Generate Study Plan" submit action. This is the primary manual data-entry point feeding the ML pipeline.

**Exam Management:** Upcoming exams list (module, date, days remaining) — exam dates should visibly factor into study recommendations elsewhere in the app (e.g. referenced in the AI Recommendation card's reasoning).

**Study Analytics:** Weekly study hours bar chart, time allocation by module (percentage breakdown, e.g. donut or stacked bar), a Productivity Score card (large %, trend, with a note on what factors feed it: completed vs missed tasks, study hours, planned vs completed sessions), and a Study Streak element ("🔥 7 Day Study Streak") — this pairs naturally with the fitness-app visual direction from Section 10.

**Academic Risk/Warning section:** Framed as a recommendation, never a diagnostic label of the student (e.g. "Academic Attention Needed — Database Systems: 61%, deadline in 2 days — Recommended: +2 hours" rather than any language implying judgment of the student themselves).

**Notifications:** Feed of items — deadline reminders, new recommendations available, task completions, missed-session alerts.

**Calendar (may overlap with Study Planner's calendar view, keep one shared component if so):** Shows assignments, exams, study sessions, deadlines, and completed tasks with distinct visual indicators per type.

**Student Profile:** Name, student ID, degree, year, semester, target GPA, available study hours (editable).

**Settings:** Notification toggles (assignment/exam/study-session/missed-task reminders) and study preferences (preferred study time, max daily study hours, break duration) — these preferences should be framed as inputs that make the scheduling algorithm's output more realistic, tying settings back to the ML pipeline rather than presenting them as a disconnected generic settings page.

**Sidebar navigation (confirmed):** Dashboard, Study Planner, My Tasks, Modules, Exams, Analytics, Notifications, then Settings/Profile — apply the colorful/playful icon and accent treatment from Section 10, not the plain icon style shown in the original spec.

**Suggested component structure** (adapt as needed, but keep this general shape): `components/academic/{Dashboard,StudyPlanner,Tasks,Modules,Analytics,Exams,Notifications}/`, `pages/academic/`, `services/academicApi.js`, `hooks/useAcademicData.js`.

**Guiding principle for every page:** the interface should make the full chain visible — Academic Data → ML Analysis → Recommendation → Personalized Schedule → Student Action → Progress → Adaptive Update — rather than reading as a plain calendar/to-do app. Wherever a page can show *why* the system suggested something (not just *what*), it should.

---

## 14. Next Steps / Open Work Items

In rough priority order:

1. ~~**Backend: semester-planning endpoint**~~ — **DONE.** `POST /study-planner/multi-week-schedule` (Section 8d) loops `StudyScheduler` across up to 12 consecutive weeks using the same recurring weekly free-time pattern, with backlog carryover. The Week view's navigation (Section 10) now consumes this for real data on future weeks. The Study Planner's Month/Semester toggle still shows mocked data — that's a separate frontend wiring task, not blocked on this endpoint anymore.
2. **Backend: feature-builder translation layer** — convert simple human input (module name, due date, weight) into the 13 raw model features the ML endpoints currently require. Required before the frontend can stop using mock feature data for priority/explain/cluster calls.
3. **Backend: expand beyond the 6 ML endpoints** — the full page spec (Section 13) assumes CRUD endpoints for students, modules, assignments, exams, task completion, and persistence (a database — MongoDB was the originally intended choice, not yet implemented). None of this exists yet; the frontend is being built now against mock data for these pages regardless (confirmed approach, see Section 10).
4. **Frontend: full rebuild** — full page set per Section 13, colorful/playful fitness-app-inspired styling (Section 10), honest confidence/explainability UI throughout.
5. **Objective 7 — pilot testing** — no real student data has been collected yet; everything so far is validated on OULAD only. Needs a small real pilot (e.g. 15-30 students, 2-3 weeks) to validate the model generalizes and to have genuine evaluation data for the report.
6. **Fix the `trained-models/stuyd-planner/` folder name typo** (should be `study-planner`) — cosmetic, but worth doing before it's referenced in more places.

---

## 15. For Any AI Assistant Picking Up This Project

- Do not touch the leakage-avoidance logic in `train_priority_model.py` (Section 4) without understanding why it exists — reintroducing `score`/`date_submitted`/`final_result` as input features will silently break the model's validity even if metrics look better.
- Do not delete the ≥97% accuracy warning check — it's a deliberate guardrail, not leftover debug code.
- The risk-classification experiment (Section 5a, generic dataset) and the priority-classification model (Section 5b, OULAD, in production) are two different things — don't merge their results or conflate which one is actually wired into the backend (it's 5b's XGBoost, as corrected by 5c).
- **Do not replace the ordinal monotonic wrapper (`app/services/study_planner/ordinal_monotonic_model.py`, deployed per Section 5c) with a plain `XGBClassifier` without understanding why it was introduced.** Doing so silently reintroduces the documented `date`-vs-priority inversion bug (a task due tomorrow predicting lower priority than an otherwise-identical task due a month later) — the whole point of 5c was to make that structurally impossible, not just fix it for the two cases that happened to get tested. If you retrain the priority model for any other reason, re-apply the same monotonic constraint on `date`, or re-verify with the same sweep methodology (Section 5c) before deploying.
- The scheduler is intentionally rule-based, not RL — don't "upgrade" it to RL without an explicit request; it's a scoped, documented decision, not an unfinished shortcut.
- The full page spec (Section 13) intentionally assumes backend features that don't exist yet (database, CRUD endpoints) — build those pages with clearly-structured mock data rather than waiting for backend expansion, per Section 10's confirmed approach.
- Visual style is colorful/playful/fitness-app-inspired (Section 10) — this overrides any clean/minimal/corporate styling suggested by structure-reference documents; those were consulted for layout only, never for visual tone.
- Read this file's "Next Steps" (Section 14) before assuming what to build next.
- **Before merging any change touching the files listed in Section 16, run the automated test suite (`pytest` + `npm test`) and confirm it still passes in full.** These tests each encode a real, previously-found bug or an explicitly-stated design guarantee — a failing test after your change almost always means you've regressed something that was already investigated and fixed once, not that the test is wrong.

---

## 16. Automated Test Suite

Until this suite existed, every bug documented in this file (the leakage issue, Section 4; the `date`-mapping inversion, Section 5c; the hybrid-layer clamp/floor behavior, Section 5d; the exam-prep no-data default, Section 8a) had been found through one-off manual investigation — `curl`, direct MongoDB queries, ad hoc Python scripts, Playwright sessions — with nothing left behind to catch a silent regression. This section is the fix for that gap: a real, repeatable, automated suite, run with `pytest` (backend/ML) and `npm test` (frontend, via Vitest — chosen because nothing was previously configured and it's the native fit for this Vite project).

### How to run

```bash
# Backend/ML (from backend/, with the venv active — pytest and httpx were added as dev dependencies)
venv/Scripts/python -m pytest tests/ -v

# Frontend (from frontend/ — vitest and jsdom were added as devDependencies; jsdom is
# only needed for the one store test that touches localStorage via zustand persist)
npm test
```

**149 tests total, all passing against current production code** (72 backend/pytest + 77 frontend/vitest, as of this section being written — this count has grown across several rounds of work since the suite was first built; treat it as a snapshot, not a promise, and trust `pytest`/`npm test`'s own output over this number). Every test maps to a specific, previously-found issue or an explicitly-documented design guarantee — none are generic coverage-for-its-own-sake.

### What's covered, by section

| Section | Coverage | File(s) |
|---|---|---|
| **4** — Leakage guard | The real check (factored out of the training scripts into `leakage_guard.py` so it's independently testable) fires on a deliberately-leaky toy dataset built from Section 4's documented anti-pattern (label derived only from features also used as inputs), and does NOT fire on the two real, saved production comparison tables (the original 8-model run and the monotonic-vs-original comparison). | `tests/test_leakage_guard.py` |
| **5c** — Monotonicity | The single most important test in the suite: loads the **actually-deployed** `priority_model.joblib` (not a fresh retrain) and asserts P(High) is non-increasing / P(Low) is non-decreasing across the full trained `date` range [12, 261], for multiple fixed feature combinations, plus the exact original real-world case (near-term vs. 32-day-out task) that started the investigation. Also asserts the deployed artifact is still the `OrdinalMonotonicPriorityModel` wrapper, not a plain classifier. | `tests/test_monotonicity.py` |
| **5d** — Hybrid priority layer | Base-tier thresholds (assignment + exam), the overdue-always-High override, the >30-day hard floor (including the literal "dddddd" 32-day case), and the ±1 tier clamp (including the 2-tier-gap-clamps-to-1 case and the clamp=0 sensitivity case from Phase 1) — tested twice: as pure-function unit tests directly against the canonical `priorityEngine.js` (fast, deterministic, in the frontend suite), and against the Python port those research scripts (`sensitivity_analysis.py`, `scheduler_baselines.py`) depend on staying faithful to it (backend suite) — so the two can't silently drift apart. | `frontend/src/utils/__tests__/priorityEngine.test.js`, `tests/test_hybrid_priority_layer.py` |
| **5e/6** — Explainability | No raw model feature name (e.g. `assessment_type_enc`) can reach the UI unchanged for any of the 13 known features; the dev-mode "fail loudly" console warning for an unmapped feature actually fires; a dedicated `/explain` regression test against whichever model is currently deployed, guarding the ordinal-wrapper/SHAP-TreeExplainer compatibility fix specifically. | `frontend/src/utils/__tests__/featureNameMap.test.js`, `tests/test_api_endpoints.py::TestExplain` |
| — | `buildDateFeatureFromDeadline`'s output always lands in the trained range [12, 261] across realistic inputs (0/1/30/180+ days) — the direct guard against the original date-mapping bug recurring. | `frontend/src/utils/__tests__/featureNameMap.test.js` |
| — | The v7 zustand-persist migration correctly recomputes a stale, out-of-range `featureRow.date` for persisted assignments, leaves tasks with no real deadline alone, and clears every downstream cache — against a mock pre-migration store state. | `frontend/src/store/__tests__/useAcademicStore.migration.test.js` |
| **8/8a/8b** — Exam-prep escalation | The escalating curve is non-decreasing (and strictly higher in the heavy window than the light window) as an exam approaches; the performance multiplier defaults to baseline (1.0) — never 1.4 nor 0.75 — when no marks exist (the exact real-sample-data case: all 4 sample exams show 0% because of absent data, not poor performance); the documented threshold bands (<50/50-70/>70) apply correctly. Tested on both the canonical JS (`examPrepConfig.js`) and its Python research-script port. | `frontend/src/utils/__tests__/examPrepConfig.test.js`, `tests/test_exam_prep.py` |
| **8/8c** — Scheduler correctness | `generate_schedule()` never silently drops a task (every task ends up in the schedule, in `overload_warning`, or both); the task registry includes `weight` on every entry (regression test for a real bug that broke `reschedule()`'s stateless round-trip) and every registry entry round-trips straight back into `add_task()`; `reschedule()` correctly drops completed task ids and fits new tasks into only the genuinely-remaining free capacity; a lightweight regression test pins Phase 2's verified finding that the `typical` scenario fully schedules 100% of its High-priority tasks. | `tests/test_scheduler.py` |
| **8d** — Rolling multi-week scheduling | Backlog carryover sums exactly to `estimated_hours_needed` with no per-day duplication; a shortfall is reported exactly once, in the week containing the deadline, never speculatively earlier; week 0's placements match a plain single-week `StudyScheduler` call byte-for-byte; `MAX_WEEKS_AHEAD` caps generation even for a far-off deadline or an explicit large `weeks_ahead`; a later, heavier exam-prep week-chunk is not starved by an earlier lighter one. Plus a full-correctness sweep (`TestThreeWeekHorizonFullCorrectness`) over a realistic 4-week/4-assignment/2-exam scenario with deliberately scarce free time: completeness (no task's hours vanish between scheduled + overload), no double-allocation, deadline respect, non-decreasing exam-hour escalation across real week boundaries, and every overload flagged is checked against the actual deadline-capped capacity available to that task (not the whole week). Plus an API smoke test for `/multi-week-schedule` confirming real ISO-date keys. | `tests/test_rolling_schedule.py`, `tests/test_api_endpoints.py::TestMultiWeekSchedule` |
| **8e** — Historical schedule freezing | A date's content freezes the moment it becomes past and a later `setSchedule()` call with deliberately different content cannot alter the already-frozen record; `multiWeekSchedule` backfills every other now-past date (including genuinely empty ones) without disturbing a date `scheduleResponse` already claimed; today/future dates are never frozen. | `frontend/src/store/__tests__/useAcademicStore.historicalSchedule.test.js` |
| **9** — API surface | One smoke test per endpoint (`/predict-priority`, `/explain`, `/predict-cluster`, `/schedule`, `/reschedule`, `/todo`) confirming a 200 response with a correctly-shaped body for a known-good input, using the real FastAPI app via `TestClient`. | `tests/test_api_endpoints.py` |

### Shared test data

Where relevant, tests reuse Phase 1/2's exact fixed `light`/`typical`/`heavy` scenarios (`sensitivity_analysis.py`'s `SCENARIOS`, imported via `scheduler_baselines.build_tasks_for_scenario`) rather than inventing new ad hoc data — this keeps the test suite's numbers directly comparable to the already-documented sensitivity/baseline analysis instead of a third, disconnected dataset.

### Minor refactors made to enable this suite (behavior-preserving, verified via the tests themselves)

- The leakage-suspicion check (Section 4) was factored out of `train_priority_model.py`'s inline script body into `leakage_guard.py`, and `train_priority_model_monotonic.py`'s equivalent inline check was switched to import and call the same function — both scripts' actual printed behavior is unchanged, but the check itself is now independently unit-testable without running the full multi-minute training pipeline.
- `useAcademicStore.js`'s zustand-persist `migrate` function was extracted from an inline arrow function into a named, exported `migrateAcademicStore()` — same logic, now callable directly from a test with a mock pre-migration state instead of requiring the whole `persist` machinery to be driven.

---

## 17. Cold-Start Behavior (Brand-New Student, Zero History)

Every engineered feature so far assumes some history exists: `prior_avg_score` (expanding mean of past scores), the three VLE-engagement features, the exam-prep performance multiplier (module marks), and the K-Means cluster (behavioral history). This section traces what actually happens for a genuinely new student — registered, zero completed tasks, zero recorded marks, zero engagement data — with one real assignment and one real exam added, verified end-to-end (real registration, real Mongo-backed task/exam, real `/predict-priority` + `/explain` + `/predict-cluster` calls, and a live Task Details screenshot), not just reasoned about.

### Ground truth: the real external schema (re-scope)

The `tasks` and `exams` MongoDB collections are owned and populated by a teammate's Journal/task-tracking component, not the Study Planner backend. Their real, authoritative schemas:

- **Task**: `_id, user_id, title, subject, task_type, progress_stage, deadline, mark, last_mark_check, last_deadline_check, created_at, updated_at`
- **Exam**: `_id, user_id, subject, exam_type, date, mark, last_mark_check, last_deadline_check, created_at, updated_at`

**`weight` is not part of the canonical Task schema at all.** A task synced from the real Journal source arrives with `weight` completely absent — not `null`, not `0`, the key doesn't exist. Every task used in earlier ad hoc testing that showed `weight: 20.0` had been created through the Study Planner's own "Add Academic Data" form, not synced from the real source — that was an idealized case, not the common one. Given `weight` was identified via SHAP (Section 6) as the single strongest driver of the priority model's predictions, a real synced task with no weight is a genuine, **common-case** cold-start condition. Sections below were re-verified against a task literally shaped like the real schema (confirmed via `'weight' in doc` returning `False` on the actual inserted Mongo document), not a hypothetical.

`exam_type` also exists on the real Exam schema with a real, fixed value set — `backend/app/services/journal/journal_constants.py`'s `EXAM_KINDS = {"mid", "final", "lab", "quiz"}` — and, before this investigation, was never read anywhere in the exam-prep escalation model (Section 8a).

### `weight` field absence — a real bug found and fixed

`hasRealWeight` (`useAcademicStore.js`: `t.weight != null`) already existed before this investigation and was already surfaced in the UI (the "(estimate)" badge next to Assignment Weight in `TaskDetails.jsx`) — but it was never threaded into the explanation layer. `resolveExplanationDisplay()` could still cite a fabricated `weight: 20` as the headline "why" reason, and since weight is the model's single strongest feature (Section 6), this was a bigger honesty gap than the `prior_avg_score` one below, not a smaller one.

**Fixed**, generalizing the same mechanism used for `prior_avg_score`: `resolveExplanationDisplay()` now also accepts `options.hasRealWeight`, and the exclusion logic (previously hardcoded to just `prior_avg_score`) is now a data-driven `excludeKeys` list covering whichever of `{prior_avg_score, weight}` lack real data, each with its own caveat message (`NO_DATA_CAVEATS`), picked by whichever excluded feature actually ranked #1. The `20` placeholder itself was also promoted from an inline literal at each call site to a documented, named constant, `DEFAULT_ASSIGNMENT_WEIGHT` (`featureNameMap.js`), for the same discoverability reason as `DEFAULT_PRIOR_AVG_SCORE`.

**Verified live** with a task inserted into Mongo with the `weight` key genuinely absent (real-schema-shaped, not `weight: null`): the badge correctly showed "20% (estimate)"; the explanation read *"High priority mainly because of assessment type and module length"* — `weight` (visually the #2-longest bar shown) was correctly never named as the reason, despite being a large contributor, because it isn't real data. No caveat was shown in this particular case because `assessment_type_enc` (not `weight`) was the actual #1-ranked SHAP contributor — confirming the "only caveat when the excluded feature was truly dominant" logic is scoped correctly, not overtriggering.

### `exam_type` — a real gap found and fixed

Confirmed via code inspection that `examPrepScheduling.js`'s `buildExamPrepTasks()` never referenced `exam.type`/`exam_type` before this investigation — every exam got the same `DEFAULT_TOTAL_BUDGET_HOURS` regardless of whether it was a full-syllabus final or a narrow-scope quiz. Decided to use it, not just document it as unused: a final plausibly warrants meaningfully more total prep time than a lab test.

**Fixed**: `computeExamTypeBudgetMultiplier()` (`examPrepConfig.js`) maps the real `EXAM_KINDS` values to a budget multiplier — `final: 1.3, mid: 1.0, lab: 0.6, quiz: 0.5` — applied to the base budget *before* Part D's performance multiplier (`finalBudgetHours = DEFAULT_TOTAL_BUDGET_HOURS * examTypeMultiplier * performanceMultiplier`). An unrecognized or missing `exam_type` (including the `"Exam"` display placeholder `useAcademicStore.js` substitutes when the real field is blank) gets the neutral `1.0` — same "don't penalize/reward absent data" principle as the performance multiplier, not a guess.

Verified numerically (same exam date, 14 days out, cold-start/no-marks student so performance multiplier = 1.0 in every row):

| `exam_type` | multiplier | total budget | hours due this scheduling window |
|---|---|---|---|
| `final` | 1.3 | 15.6h | 4.78h |
| `mid` | 1.0 | 12.0h | 3.67h |
| `lab` | 0.6 | 7.2h | 2.20h |
| `quiz` | 0.5 | 6.0h | 1.84h |
| missing/unrecognized | 1.0 (neutral default) | 12.0h | 3.67h |

### `prior_avg_score` — a real bug found and fixed

The training-time fallback (`train_priority_model.py` Section 2, for a student's very first assessment with no prior rows) is the cohort mean, falling back to the **dataset-wide mean score, 76.452355** — verified directly against `oulad_task_level_leakage_free.csv`, not guessed. The app-level cold-start fallback (`useAcademicStore.js`'s `buildFromJournal`, `AddAcademicData.jsx`'s form pre-fill) was instead a hardcoded **65** — below the model's own trained notion of "average," despite looking like a plausible, deliberately-chosen number.

This was not a theoretical concern — confirmed live, with the actual deployed model, holding every other feature fixed:

| `prior_avg_score` | predicted priority | confidence | SHAP contribution for this feature |
|---|---|---|---|
| 65 (old fallback) | High | 83.7% | **+0.545** (pushed toward High — reads as "below-average past performance") |
| 76.45 (dataset mean) | High | 71.7% | **-0.114** (mildly pushed away from High — reads as neutral) |

The sign of the feature's own contribution flipped entirely. A cold-start student — with literally no performance history — was being scored as if they had already under-performed. **Fixed**: `DEFAULT_PRIOR_AVG_SCORE = 76.452355` is now a documented constant in `featureNameMap.js`, used at both call sites (`module?.hasGradeData ? module.currentGrade : DEFAULT_PRIOR_AVG_SCORE`), replacing the old `|| 65`. This also incidentally fixed a second latent bug: `||` treats a real, recorded `0` average as falsy and would have silently replaced it with the placeholder too — the new `hasGradeData`-gated check doesn't.

### `/predict-priority` and confidence — reported honestly, not force-fixed

Re-run against the real cold-start case (task due in 16 days, weight 20%, no marks): raw ML prediction **High, 73.7% confidence**; the hybrid layer (Section 5d) correctly lands it at **Medium** (base tier Low + ±1 clamp, `dominantMechanism: "ml"`) — unaffected by cold-start status, confirmed live and matching the screenshot.

**Known, explicitly-not-fixed limitation**: confidence is not *explicitly* cold-start-aware. The 71.7%-vs-83.7% difference measured above is an incidental side effect of correcting the fallback *value*, not an intentional "be less confident when data is missing" mechanism — the model has no input that flags "this `prior_avg_score` is fabricated" (unlike `has_vle_activity`, which genuinely is such a flag for the engagement features). Building one would mean retraining with a new feature, out of scope here. Flagged rather than silently claimed as solved — do not read the confidence gap above as evidence the system "already handles" cold-start uncertainty; it doesn't, deliberately.

### Explanation panel — a real bug found and fixed (both `prior_avg_score` and `weight`)

Before this investigation, a cold-start prediction where `prior_avg_score` (or, per the re-scope above, `weight`) happened to be the SHAP-dominant factor could produce a sentence like *"...mainly because of your average score so far"* or *"...because of assignment weight"* — naming a fabricated number as the reason, the exact kind of misleading explanation Section 6/10's honesty principle exists to prevent. **Fixed**: `resolveExplanationDisplay()` (`priorityEngine.js`) takes `options.hasPriorScoreData` / `options.hasRealWeight` (sourced from signals the app already computes — `module.hasGradeData`, `task.hasRealWeight` — no new tracking invented) and excludes whichever features lack real data from the "top factor" search in both the `"shap"` and `"blended"` explanation branches, via `buildShapSentence()`'s `excludeKeys` parameter. When an excluded feature would otherwise have been the single strongest contributor, a feature-specific caveat line is appended instead of silently substituting the next-best factor with no explanation (`NO_DATA_CAVEATS`, one message per feature). Verified live twice: a cold-start task with a real weight but no prior-score data correctly cited "assignment weight" and skipped `prior_avg_score` (ranked #9 of 13, not dominant, so no caveat needed); a real-schema-shaped task with **no `weight` field at all** correctly cited "assessment type and module length," never `weight` (visually the #2 bar shown), and again needed no caveat since `weight` wasn't actually the #1-ranked contributor in that case.

### K-Means cluster (`/predict-cluster`) — the -1 fallback works correctly, but is currently unreachable in practice

`cluster_service.py`'s `has_vle_activity == 0` short-circuit to the fixed `-1` / "No VLE Engagement Data" cluster (Section 7) is generic rule-based logic, not an OULAD-training-time special case — confirmed directly: calling it with a genuinely-zero engagement payload correctly returns `{"cluster_id": -1, "cluster_label": "No VLE Engagement Data"}`.

**Real, previously-undocumented finding**: it is never actually reached by the live app today, for ANY student, cold-start or not. `useAcademicStore.js`'s `buildFromJournal` hardcodes `avg_weekly_clicks: 15, active_weeks_ratio: 0.5, has_vle_activity: 1` as fixed neutral placeholders for every real assignment's `featureRow` — there is currently no real engagement-tracking pipeline in this app analogous to OULAD's VLE clicks, so these three fields never vary by actual student behavior yet. `ModuleDetail.jsx`'s cluster call reuses a task's `featureRow` verbatim, inheriting the same hardcoded values. Verified live: the cold-start test student (zero real engagement) was assigned real cluster 0 ("High-Performing Low-Engagement Light-Workload Studier"), not -1, purely because `has_vle_activity` is always sent as `1`. This is not a bug in the cold-start handling *of the cluster model itself* — it's an honest gap in what data currently feeds it, reported rather than silently patched (building real engagement tracking is a separate, larger feature).

### Hybrid priority layer (`priorityEngine.js`) — confirmed unaffected, as expected

`computeBaseTier`/`computeFinalPriority` take only `daysRemaining` and `taskType` — no history-dependent input. Confirmed both by code inspection and live: the cold-start task's base tier, clamp, and final label all matched a history-rich task with the same deadline/weight exactly. No change needed.

### Side-finding, explicitly out of scope here: `currentGrade` display without a `hasGradeData` check

While screenshotting the cold-start Task Details page, its "Module Grade" stat displayed a bare **"0%"** for a module with no recorded marks — indistinguishable from a genuine 0% grade. `MonthGrid.jsx` and `AcademicRiskSection.jsx` already guard this exact field with `hasGradeData` (documented there as a deliberate honesty rule: "a placeholder 0% must never read as a genuine low grade"); this one stat had been missed. **Fixed** (small, directly in scope since it was found on the very page being verified): `TaskDetails.jsx` now shows "No data yet" instead of "0%" when `!module.hasGradeData`.

A broader grep found the same unguarded pattern in several other places (`ModuleCard.jsx`, `ModuleDetail.jsx`'s "Current Grade" stat, `Exams.jsx`'s "Current grade X%" line, `Dashboard.jsx`'s at-risk-module check, `AIRecommendationCard.jsx`'s urgency-score formula, `ModulePerformanceChart.jsx`). **Not fixed here** — auditing and correcting every `currentGrade` display/formula site across the app is a separate, larger UI-honesty sweep beyond this ML-pipeline cold-start investigation's scope, and is flagged here as a real, concrete follow-up item rather than silently left undiscovered or overclaimed as handled.

### Summary of fallback values by feature (cold-start state)

| Feature | Cold-start value used | Source |
|---|---|---|
| `prior_avg_score` | 76.452355 (dataset mean) | `DEFAULT_PRIOR_AVG_SCORE`, fixed this investigation |
| `weight` | 20 (neutral placeholder) | `DEFAULT_ASSIGNMENT_WEIGHT`, promoted to a named constant this investigation; `hasRealWeight` now excludes it from the explanation panel too |
| `avg_weekly_clicks` | 15 | Hardcoded neutral placeholder (always, not cold-start-specific) |
| `clicks_trend` | 0 | Hardcoded neutral placeholder |
| `active_weeks_ratio` | 0.5 | Hardcoded neutral placeholder |
| `has_vle_activity` | 1 | Hardcoded — means the real `-1` cluster path is currently unreachable (see above) |
| Exam-prep performance multiplier | 1.0 (baseline) | `computePerformanceMultiplier`'s `hasData=false` branch — already correct, re-confirmed live and in `tests/test_exam_prep.py` |
| Exam-prep `exam_type` multiplier | 1.0 (neutral) for missing/unrecognized `exam_type` | `computeExamTypeBudgetMultiplier()`, added this investigation — real values (`final`/`mid`/`lab`/`quiz`) now scale the budget |
| `/predict-priority` confidence | Not cold-start-aware | Known limitation, not fixed (see above) |