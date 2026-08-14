# At-Risk Student Prediction — Study Planner

Trains and evaluates at-risk student classifiers on two datasets:

- **Students Performance Dataset** — 5,000 rows, one row per student.
- **OULAD** (Open University Learning Analytics Dataset) — assessment
  submissions + VLE clickstream, aggregated to one row per
  (`code_module`, `code_presentation`, `id_student`).

The two datasets have incompatible schemas and populations, so they are
kept as **two separate feature tables and two separate model families**
rather than merged into one.

## Pipeline

Run the three scripts in order from this directory
(`backend/ml_scripts/study-planner/`):

```bash
python build_features.py   # cleans + aggregates raw data -> features/
python train_models.py     # splits, tunes, trains, saves models -> ../../trained-models/study-planner/models/
python evaluate.py         # scores on held-out test set -> ../../trained-models/study-planner/results/
```

Use the project's venv interpreter, e.g. on Windows:
`..\..\venv\Scripts\python.exe build_features.py`

### 1. `build_features.py`

- Reads raw CSVs from `backend/datasets/study-planner/` (flat folder — no
  `oulad/` subfolder; the performance file is named
  `Students Performance Dataset.csv`, with spaces).
- OULAD: merges `assessments` + `studentAssessment` on `id_assessment`,
  computes `days_late = date_submitted - date` per submission, aggregates
  to student-module level (avg score, avg lateness, count of late
  submissions). Aggregates the ~450MB `studentVle.csv` in 500k-row chunks
  (never loaded fully into memory) into per-student-module click/engagement
  totals. Binarizes `at_risk = 1` if `final_result` in `{Fail, Withdrawn}`.
- Performance dataset: fills missing `Parent_Education_Level` (~1,025 rows)
  with an explicit `"Unknown"` category rather than the mode, so the model
  can learn whether missingness itself is informative. Binarizes
  `at_risk = 1` if `Grade` in `{D, F}`.
- Outputs `features/performance_features.csv` and `features/oulad_features.csv`.

### 2. `train_models.py`

- **Leakage guard (important):** in the Performance dataset, `Grade` is a
  deterministic threshold of `Total_Score`, and `Total_Score` is itself a
  weighted combination of `Final_Score` + the other score columns. Both
  `Total_Score` and `Final_Score` are **excluded** from the feature set —
  otherwise the model just reconstructs the grading formula (trivial
  F1 ≈ 1.0) instead of learning a genuine early-warning signal from
  mid-course indicators (attendance, midterm, assignments, quizzes,
  participation, projects, study habits, demographics).
- OULAD splits use `StratifiedGroupKFold` grouped on `id_student` (two-stage,
  ~70/15/15) so the same student never appears in more than one split.
- Performance dataset uses plain stratified `train_test_split` (70/15/15) —
  each row is already a unique student.
- Trains Logistic Regression (baseline, `StandardScaler` + `class_weight=
  "balanced"`), Random Forest, and XGBoost (`scale_pos_weight` set from the
  training class ratio) per dataset.
- Random Forest / XGBoost hyperparameters are tuned with
  `RandomizedSearchCV` (20 iterations) scored **only on the validation
  fold** via a `PredefinedSplit` — the test set is never touched during
  search.
- Saves each fitted pipeline (preprocessing + model) with `joblib` to
  `../../trained-models/study-planner/models/<dataset>_<model>.pkl`, plus
  a `<dataset>_feature_schema.json` recording the exact numeric/categorical
  input columns for later inference, and a `<dataset>_holdout_data.pkl`
  with the untouched test set.

### 3. `evaluate.py`

- Loads each saved model + its holdout test set, reports precision,
  recall, F1, and ROC-AUC.
- Prints and saves a single comparison table:
  `../../trained-models/study-planner/results/model_comparison.csv`.
- Plots a confusion matrix for the best (highest-F1) model per dataset.
- Prints the top 10 feature importances for the Random Forest and XGBoost
  models.

## Results (test set, from the last run)

| Dataset     | Model                | Precision | Recall | F1    | ROC-AUC |
|-------------|-----------------------|-----------|--------|-------|---------|
| performance | logistic_regression  | 0.730     | 0.814  | 0.770 | 0.889   |
| performance | random_forest        | 0.716     | 0.775  | 0.744 | 0.865   |
| performance | xgboost               | 0.711     | 0.788  | 0.747 | 0.877   |
| oulad       | logistic_regression  | 0.958     | 0.900  | 0.928 | 0.976   |
| oulad       | random_forest        | 0.981     | 0.903  | 0.940 | 0.984   |
| oulad       | xgboost               | 0.980     | 0.914  | 0.945 | 0.984   |

Re-run `evaluate.py` after any retraining to regenerate this table.

## Loading a saved model for inference

```python
import json
import joblib

model = joblib.load("trained-models/study-planner/models/oulad_xgboost.pkl")
schema = json.load(open("trained-models/study-planner/models/oulad_feature_schema.json"))

# Build a dataframe with exactly schema["feature_columns"], in any order,
# then:
proba_at_risk = model.predict_proba(new_students_df[schema["feature_columns"]])[:, 1]
```

Each saved model is a full `sklearn.Pipeline` (imputation + one-hot
encoding/scaling + classifier), so raw feature values can be passed in
directly — no separate preprocessing step is needed at inference time.
