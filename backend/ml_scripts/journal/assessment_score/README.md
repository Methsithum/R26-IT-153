# Assessment Score Prediction

Offline training, evaluation and model-saving pipeline for predicting a
student's score (0-100) on an upcoming assessment, plus a calibrated score
range. This folder is **training/evaluation code only** - no API routes,
services, schemas, Mongo models, or frontend code are added here. See
`../../../trained-models/journal/assessment_score/` for the saved bundles.

## Dataset

[Open University Learning Analytics Dataset (OULAD)](https://analyse.kmi.open.ac.uk/open-dataset),
Kuzilek, J., Hlosta, M. & Zdrahal, Z. *Open University Learning Analytics
dataset.* Sci Data 4, 170171 (2017). https://doi.org/10.1038/sdata.2017.171.
Licensed CC BY 4.0.

Raw CSVs live at `backend/datasets/journal/oulad/` (gitignored - not
committed; `studentVle.csv` alone is 453 MB, over GitHub's 100 MB limit).

## How to run

```
cd backend
venv/Scripts/python ml_scripts/journal/assessment_score/data_prep.py     # builds + caches the training table
venv/Scripts/python ml_scripts/journal/assessment_score/verify.py        # row counts, reference rows, shuffled-target test
venv/Scripts/python ml_scripts/journal/assessment_score/train.py --feature-set journal_compatible
venv/Scripts/python ml_scripts/journal/assessment_score/train.py --feature-set full_oulad
# or both:
venv/Scripts/python ml_scripts/journal/assessment_score/train.py --all
```

`train.py` runs `verify.py`'s checks automatically first and refuses to
train if any of them fail. Run as files (`python path/to/script.py`), not as
an installed package - other `ml_scripts/` folders contain hyphens in their
names, so this project does not rely on package-style imports across
`ml_scripts`.

Intermediate artifacts (the daily VLE aggregate and the final training
table) are cached under `backend/datasets/journal/oulad/_cache/` after the
first run, so subsequent runs are fast. Delete that folder to force a full
rebuild from the raw CSVs.

## Feature sets

- **`full_oulad`** - previous scores + context (assessment type, weight,
  due date, module, demographics, registration) + VLE clicks before the due
  date. Research/reporting only - **not served**, because the live journal
  has no VLE click data and must never fake it.
- **`journal_compatible`** - `prev_mean`, `prev_last`, `prev_count`,
  `assessment_type` only. The weaker of the two, but the only one that
  matches what `ExamModel`/`TaskModel` in the journal actually know before
  an assessment. This is the bundle intended for serving.

Both bundles are saved to
`backend/trained-models/journal/assessment_score/assessment_score_<feature_set>.joblib`
as a plain dict:
`{model, features, conformal_q, alpha, feature_set, pass_mark, trained_on, sklearn_version, trained_at}`.
The `model` is a fitted scikit-learn `Pipeline` (preprocessing + a
`HistGradientBoostingRegressor`) - no custom classes are pickled, so
`backend/app` can `joblib.load()` it without importing `ml_scripts` (see
`backend/tests/test_assessment_score.py`).

## Models and metrics

Ridge, RandomForest and HistGradientBoosting were compared via
`GroupKFold(5)` (grouped by student, so no student's rows appear in both
train and test within a fold); **HistGradientBoostingRegressor is the
model that gets saved**. Reported metrics: MAE, RMSE, R² (mean ± std over
folds), split by cold-start (`prev_count==0`) vs has-history, and (for
`full_oulad`) by assessment type via an A/B/C/D feature-group ablation.

Reports (CSV) are written to `reports/`:
`baselines_and_models_<feature_set>.csv`, `ablation_full_oulad.csv`,
`at_risk_comparison.csv`, `conformal_<feature_set>.csv`,
`temporal_<feature_set>.csv`, `cold_start_split_journal_compatible.csv`.

### Headline numbers (this run; see `reports/` for full detail)

| | full_oulad (HGB, all features) | journal_compatible (HGB) |
|---|---|---|
| 5-fold MAE | 10.52 | 11.35 |
| 5-fold R² | 0.412 | 0.323 |
| Conformal q (alpha=0.10) | ±22.0 | ±23.6 |
| Conformal coverage (test) | 0.897 | 0.897 |
| Temporal (train on 2013B/2013J/2014B, test 2014J) MAE | 12.40 | 13.11 |
| At-risk ROC-AUC (predicted score, full_oulad config C) | 0.878 | - |

Ablation (full_oulad, HGB, GroupKFold(5) MAE): baseline (mean of previous
scores) 13.10 -> A (previous scores only) 12.15 -> B (+context) 10.72 ->
C (+VLE, full feature set) 10.52. D (context+VLE, no previous scores) 12.43
- worse than A alone, confirming previous scores carry more signal than
context+VLE without history. Adding context gives the largest single jump
(~1.4 MAE); VLE clicks add a further, smaller ~0.2 MAE on top - real, but
modest.

At-risk detection (full_oulad config C, score < 40 = at-risk): fixed
rule-based flags (mean previous score < 50 OR no VLE clicks in the last 14
days OR `num_of_prev_attempts >= 1`) flag ~18% of submissions and catch 38%
of true fails at 9% precision. The ML model, flagging on out-of-fold
predicted score < 40, flags only ~1% of submissions for the same ballpark of
signal quality; at recall matched to the rule (~38%), ML precision is ~25%
- roughly 3x fewer false alerts per true fail caught than the rule.

## Limitations

- OULAD has no self-reported preparation, confidence, or study-hours data;
  VLE clicks are an objective proxy only. This does not prove the journal's
  own fields (mood, self-reported prep, etc.) would predict as well.
- `journal_compatible` is meaningfully weaker than `full_oulad` (R² 0.32 vs
  0.41) - it is missing VLE and demographic signal by design, since the
  journal doesn't collect that data. Its accuracy is the honest number to
  quote for anything actually served.
- Distance-learning UK university dataset (2013-2014) - may not generalize
  to other institutions or teaching styles.
- Only students who actually submitted are modelled (submissions with no
  score, banked/carried-over scores, and assessments missing a due date are
  excluded - see `data_prep.py` section 2 for exact row counts at each
  step). 11 of the 24 Exam-type assessments (representing 58% of exam
  submissions) were dropped for missing a per-assessment due date.
- Only ~4.25% of rows are at-risk (score < 40) - at-risk precision is
  inherently low for both the rule and the model; recall/F1/ROC-AUC are the
  more meaningful comparisons.
- Model selection (choosing HistGradientBoosting) used the same
  cross-validation data reported here - a source of mild optimism. The
  temporal validation (train on earlier presentations, test on the latest,
  2014J) is the more realistic estimate of future performance, and is
  noticeably weaker (full_oulad R² drops from 0.41 to 0.16; journal_compatible
  from 0.32 to 0.15) - expect real-world accuracy on a new intake to be
  closer to the temporal numbers than the cross-validated ones.
- The conformal range is calibrated on OULAD, not on this journal's actual
  students - treat the stored `conformal_q` as a reasonable starting point,
  not a guarantee, until recalibrated on real journal data.
- This is an offline proof-of-concept plus a reusable training pipeline, not
  a claim of deployed accuracy. Retrain on real
  `assessment_predictions`-style journal data (predicted vs. actual mark
  pairs, once the journal has accumulated enough of them) before making any
  deployed-accuracy claim.

## API

The serving layer lives in `backend/app/` (routes: `app/routes/assessment_prediction/`,
services: `app/services/assessment_prediction/`, storage model:
`app/models/assessment_prediction/`, config: `app/config/assessment_prediction_settings.py`)
- **not** in this `ml_scripts/` folder, which stays training/evaluation-only.
Only `assessment_score_journal_compatible.joblib` is served; the `full_oulad`
bundle is research-only and is never loaded by app code.

### Endpoints (prefix `/assessment-prediction`)

**`POST /assessment-prediction/predict`**

Request:
```json
{
  "user_id": "<ObjectId string>",
  "subject": "Database Systems",
  "assessment_kind": "exam",
  "exam_type": "final",
  "task_id": null,
  "assessment_date": "2026-11-20"
}
```
`exam_type` (`mid`/`final`/`lab`/`quiz`) is required when `assessment_kind == "exam"`.
`task_id` is optional when `assessment_kind == "task"`. `assessment_date` is
optional - falls back to the stored exam date / task deadline, then today.

Response:
```json
{
  "estimated_mark": 64.2,
  "range_low": 41,
  "range_high": 87,
  "below_pass_mark": false,
  "n_previous_marks": 2,
  "warning": null,
  "model_version": "journal_compatible@2026-09-29T19:46:42.745279+00:00",
  "feature_set": "journal_compatible",
  "assessment_type_used": "Exam",
  "prediction_id": "<ObjectId string>"
}
```
`warning` is `"cold_start: low confidence"` when the student has zero usable
previous marks in that subject (`n_previous_marks == 0`) - the model still
predicts, just with lower confidence than the training data supports.
**An unknown/never-seen `subject` is NOT a validation error** - it is treated
identically to cold start (`n_previous_marks == 0`, same warning), since
`subject` is a free-text filter over the student's own marks, not a document
that must already exist. Only `user_id` (must resolve to a real user) and
`task_id` (if given, must resolve to a real task for that user/subject) are
validated as "must already exist."

**`GET /assessment-prediction/history/{user_id}?limit=20`** - that student's
stored predictions, newest first, each including `actualMark`/`actualMarkRaw`
once known (`null` until a matching mark is saved).

**`GET /assessment-prediction/health`** - `{bundle_loaded, feature_set, model_version}`
(or `{bundle_loaded: false, detail: "..."}` if the bundle file is missing).
Never raises - a status check, not the predict path.

### Error codes

| Code | When |
|---|---|
| 422 | Malformed `user_id`/`task_id` (not a valid ObjectId string), invalid `assessment_kind`, invalid/missing `exam_type` when `assessment_kind == "exam"` |
| 404 | No user found for `user_id`; `task_id` given but no matching task for that user/subject |
| 503 | The joblib bundle file is missing (predict path only - `/health` never 503s) |

A malformed request or missing document never reaches a 500 - only a genuine
server-side bug would.

### Journal -> OULAD `assessment_type` mapping (assumption, in config)

| Journal | OULAD |
|---|---|
| `task` / `assignment` | `TMA` |
| `quiz` | `CMA` |
| `mid` / `final` / `lab` | `Exam` |

This is a reasonable-but-arbitrary equivalence, not an official mapping -
easy to change in `app/config/assessment_prediction_settings.py`.

### Letter-grade -> 0-100 mapping (assumption, in config)

`journal_constants.py` only has `LETTER_GRADE_POINTS` (GPA points, 0.7-4.0
scale) and `parse_letter_grade()` (validates/normalizes the string, returns
it unchanged or `None` - does NOT convert to a number). This is **my own
estimate**, not an official university conversion table:

| Grade | % | Grade | % | Grade | % | Grade | % |
|---|---|---|---|---|---|---|---|
| A+ | 95 | B+ | 77 | C+ | 62 | D+ | 47 |
| A | 87 | B | 72 | C | 57 | D | 42 |
| A- | 82 | B- | 67 | C- | 52 | D- | 37 |

Note: `journal_constants.LETTER_GRADES` is missing `"D-"` even though
`LETTER_GRADE_POINTS` and `FAIL_LETTER_GRADES` both have it - a pre-existing
inconsistency in `journal_constants.py`, left as-is (not this task's job to
fix). `FAIL_LETTER_GRADES` (the journal's own failing grades) and the
model's `pass_mark` (40, from OULAD) are two different, uncalibrated scales
- `below_pass_mark` in the response is informational only, not a claim that
it matches the journal's own pass/fail definition.

### What is stored (`assessment_predictions` collection)

One upserted document per `(userId, assessmentRef, calendar day the
prediction was made)`, so repeated same-day calls update one row instead of
accumulating duplicates: `userId, subject, assessmentKind, assessmentRef,
assessmentDate, features` (the exact dict fed to the model),
`estimated, low, high, belowPassMark, modelVersion, createdAt`, plus
`actualMark`/`actualMarkRaw`/`actualRecordedAt` (all `null` until a matching
mark is later saved via `ExamModel.set_mark`/`TaskModel.set_mark`, at which
point a small additive hook fills them in - see `actual_mark_hook.py`).

Also stored, **store-only and never fed to the model**, a `journalSnapshot`
dict of real journal signals for a future richer model (study minutes over
the 14/30 days before the assessment, completed-session counts, engagement
counts, the subject's assignment progress stage, deadline-pressure/low-study/
overloaded flag counts, and the latest `learning_patterns` values). Built
read-only from `learning_patterns.py`/`context_utils.py`'s existing
functions; if anything in it fails, an empty `{}` is stored instead - it
never breaks a prediction.

### Assumption: previous-mark tie-break on the journal side

Training breaks a tie between same-due-date assessments (for `prev_last`)
by smallest `id_assessment` (OULAD's own row ordering). The journal has no
such field, so the serving feature builder uses ascending MongoDB `_id`
(ObjectId, monotonically increasing by creation time) as the closest
available analogue - documented here since it's a genuine judgment call,
not something stated anywhere else. It only affects `prev_last`; `prev_mean`
and `prev_count` are unaffected by tie order (see
`app/services/assessment_prediction/feature_builder.py`).

## Limitations (serving layer)

- The served model uses only previous marks + assessment type
  (`journal_compatible`) - meaningfully weaker than the research-only
  `full_oulad` model (see the accuracy table above).
- Journal marks are self-reported by the student through the daily
  check-in flow, not verified against an institutional record - possible
  label noise the OULAD training data didn't have.
- The conformal range is calibrated on OULAD, not on this journal's
  students - treat it as a starting point, not a guarantee.
- `below_pass_mark` is informational only (see the letter-grade section
  above for why it's on a different scale than the journal's own
  `FAIL_LETTER_GRADES`).
- **Journal routes, including `/assessment-prediction`, are unauthenticated
  project-wide: any caller who knows a `user_id` can read that user's
  predictions and marks via `/history`.** This is an existing, project-wide
  convention (no journal route has authentication), not something specific
  to this feature - flagged here because this endpoint surfaces marks and
  predicted scores, which is more sensitive than most journal data.
- Retrain on real `assessment_predictions` data (predicted vs. actual mark
  pairs) before claiming deployed accuracy - the bundle currently serving
  was trained entirely on OULAD, a different population.
- `actualMark` is not cleared if the underlying mark is later rolled back
  (abandon/delete), so it can be stale label data.

### Future work: NOT implemented

- Using the prediction in at-risk alerts (`alerts.py` is untouched).
- A gamification quest tied to beating the predicted range.
- Comparing predicted vs. actual mark in the weekly reflection.
- Any frontend display of predictions.
- Collecting preparation-level/confidence questions in the daily journal
  flow (the journal_compatible model has no such signal to use even if it
  existed today).
