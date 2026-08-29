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
1. **Base tier** (dominant): from real days-until-deadline + `taskType`. Assignments: ≤2 days → High, 3–7 → Medium, 8–14 → Medium, ≥15 → Low. Exams (longer real-world lead time): ≤7 days → High, 8–14 → Medium, 15–30 → Medium, ≥31 → Low. Overdue (`daysRemaining < 0`) → always High, unconditionally.
2. **ML modifier** (secondary, bounded): the (already monotonic, per 5c) `/predict-priority` label is converted to the same 0/1/2 scale and clamped to shift the base tier by **at most ±1**: `modifier = clamp(mlLevel - baseLevel, -1, 1)`, `finalLevel = clamp(baseLevel + modifier, 0, 2)` — skipped entirely when overdue, which always stays High regardless of what the model says.

The 5c fix is *why the ML label can be trusted at all* here — an unconstrained model's label could disagree with the deadline in an arbitrary, inconsistent direction; the monotonic model's disagreement is only ever "the wrong *amount*," which bounding to ±1 tier safely absorbs.

**Transparency.** `/explain`'s SHAP output is only shown when the ML modifier actually moved the result off the base tier (`dominantMechanism: "ml"`); when the base tier alone determined the result (`"deadline"`), `ExplanationPanel` shows a plain sentence instead (e.g. *"High priority mainly because it's due in 2 days"*) and hides the SHAP bars, since they'd otherwise explain a label different from the one on screen. The two are never blended into one sentence.

**Applied consistently, in one place.** `computeFinalPriority(daysRemaining, taskType, mlPriorityLabel)` is the single implementation. Rather than call it separately in every screen, `applyPriorityEngineToScheduleResult()` rewrites `priority_label` in a `/schedule`/`/reschedule` response's `tasks` registry (and `overload_warning`) once, at the API boundary in `useWeeklySchedule()`/`useReschedule()` (`frontend/src/hooks/useAcademicData.js`) — every screen reading `schedule.tasks[taskId].priority_label` (Dashboard, TodayTimeline, DayView, WeekGrid, MonthGrid, Tasks) gets the hybrid result automatically. `TaskDetails.jsx` is the one exception (it calls `/predict-priority` directly rather than reading the schedule), so it calls `computeFinalPriority` explicitly on that raw label.

**Data model.** Assignments now carry a `taskType` field (`"assignment"` | `"exam"`), defaulted to `"assignment"` everywhere assignments are constructed (`useAcademicStore.js`'s `buildFromJournal`, `AddAcademicData.jsx`, `academicMocks.js`). In practice this is always `"assignment"` today — real calendar exams (the separate `exams` collection/array) still deliberately never go through `/predict-priority` at all (Section 6/MonthGrid.jsx) — the field exists so the exam thresholds above have something real to read if that changes.

**Verification.**
- Real scenario: "TMA — Data Structures & Algorithms" (12 days remaining, weight 10) vs. "dddddd" (32 days remaining, weight 20, same module family as the original 5c investigation). Both currently predict ML `High`. Base tiers: 12 days → Medium; 32 days → Low. Final: DSA `baseTier=Medium, mlLevel=High, modifier=+1` → **High**; dddddd `baseTier=Low, mlLevel=High, modifier=+1` → **Medium**. 12-day task (**High**) ≥ 32-day task (**Medium**) — confirmed.
- Original 5c pair re-checked under this layer: near-term (1 day, weight 20) → base High, ML High, modifier 0 → **High** (`dominantMechanism: "deadline"`). Distant/"dddddd" (32 days, weight 20) → base Low, ML High, modifier +1 → **Medium** (`dominantMechanism: "ml"`). Near-term (**High**) ≥ distant (**Medium**) — still holds, as expected, since 5c's within-task monotonicity is untouched by this layer.

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
| `POST /reschedule` | previous schedule + remaining free slots + completed/new tasks | same shape as `/schedule` |
| `POST /todo` | a `/schedule` or `/reschedule` response | array of to-do entries with `reminder_message` |

**Error handling:** Pydantic validation → 422. Model/service failures → 500 with a clear message. If a `.joblib` file fails to load at startup, the app still boots (other endpoints keep working) and logs a `STARTUP ERROR`, verified by deliberately removing a model file and confirming graceful degradation.

**Known real bug already found and fixed:** `generate_schedule()`'s `tasks` registry initially omitted `weight`, which `add_task()` requires — this would have broken `reschedule()` reconstructing state from a prior response. Fixed by adding `weight` to the registry.

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

A detailed page spec (Section 13) assumes backend capabilities that do not exist yet: a database (MongoDB was mentioned as target architecture, not yet implemented), and CRUD endpoints for students/modules/assignments/exams, task completion, and rescheduling-with-persistence. **None of these exist yet** — the only real, working backend is the 6 ML endpoints in Section 9.

**Confirmed approach:** build the full frontend page set now. Wire real API calls wherever the 6 existing ML endpoints can genuinely serve a page (priority prediction, explanation, clustering, weekly schedule generation/rescheduling, to-do list). For every other page/feature that needs data from an endpoint that doesn't exist yet (student profile CRUD, module management, exam tracking, notifications, add-academic-data forms, analytics requiring stored history) — build against realistic mock data, structured so each can be swapped for a real API call later with minimal rework. Do not block frontend development on backend expansion.

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

1. **Backend: semester-planning endpoint** — loop `StudyScheduler` across a full term using a recurring weekly free-time pattern, not one-off weekly slots. Required before the Study Planner's Month/Semester toggle can show real (non-mocked) data.
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