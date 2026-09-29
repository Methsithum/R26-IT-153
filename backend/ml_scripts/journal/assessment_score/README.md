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
