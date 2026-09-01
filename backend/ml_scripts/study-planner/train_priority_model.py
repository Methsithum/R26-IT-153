

import os
import time
import warnings

import joblib
import matplotlib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from imblearn.over_sampling import SMOTE
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    ConfusionMatrixDisplay,
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.naive_bayes import GaussianNB
from sklearn.neighbors import KNeighborsClassifier
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier
from xgboost import XGBClassifier

matplotlib.use("Agg")
warnings.filterwarnings("ignore")

# ---------------------------------------------------------------------------
# Paths (relative to this script's location, so it works regardless of cwd)
# ---------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))

DATASETS_DIR = os.path.join(BACKEND_DIR, "datasets", "study-planner")
OUTPUTS_DIR = os.path.join(BACKEND_DIR, "ml_scripts", "study-planner", "outputs")
MODELS_DIR = os.path.join(BACKEND_DIR, "app", "models", "study_planner")

os.makedirs(OUTPUTS_DIR, exist_ok=True)
os.makedirs(MODELS_DIR, exist_ok=True)

RANDOM_STATE = 42
CLASS_ORDER = ["Low", "Medium", "High"]  # fixed order used for plots/reports

sns.set_theme(style="whitegrid")


def section(title):
    print("\n" + "=" * 90)
    print(title)
    print("=" * 90)


# ===========================================================================
# 1. LOAD AND JOIN DATA
# ===========================================================================
section("1. LOAD AND JOIN DATA")

assessments = pd.read_csv(os.path.join(DATASETS_DIR, "assessments.csv"))
student_assessment = pd.read_csv(os.path.join(DATASETS_DIR, "studentAssessment.csv"))
student_info = pd.read_csv(os.path.join(DATASETS_DIR, "studentInfo.csv"))
student_registration = pd.read_csv(os.path.join(DATASETS_DIR, "studentRegistration.csv"))
courses = pd.read_csv(os.path.join(DATASETS_DIR, "courses.csv"))

print(f"assessments: {assessments.shape}, studentAssessment: {student_assessment.shape}, "
      f"studentInfo: {student_info.shape}, studentRegistration: {student_registration.shape}, "
      f"courses: {courses.shape}")

# Exam-type rows carry date == '?' because their date is set at module level,
# not per-assessment. We only model per-assessment planning priority, so drop them.
before = len(assessments)
assessments = assessments[assessments["date"] != "?"].copy()
assessments["date"] = assessments["date"].astype(int)
print(f"assessments: dropped {before - len(assessments)} rows with date == '?' (Exam-type rows)")

before = len(student_assessment)
student_assessment = student_assessment[student_assessment["score"] != "?"].copy()
student_assessment["score"] = student_assessment["score"].astype(float)
print(f"studentAssessment: dropped {before - len(student_assessment)} rows with score == '?'")

# Inner join: only assessments that were actually attempted and scored.
df = student_assessment.merge(assessments, on="id_assessment", how="inner")
print(f"After studentAssessment + assessments (inner): {df.shape}")

df = df.merge(
    student_info[[
        "code_module", "code_presentation", "id_student",
        "num_of_prev_attempts", "studied_credits", "disability",
        "highest_education", "age_band", "final_result",
    ]],
    on=["code_module", "code_presentation", "id_student"],
    how="left",
)
print(f"After + studentInfo (left): {df.shape}")

student_registration = student_registration.copy()
student_registration["date_registration"] = pd.to_numeric(
    student_registration["date_registration"], errors="coerce"
)
df = df.merge(
    student_registration[["code_module", "code_presentation", "id_student", "date_registration"]],
    on=["code_module", "code_presentation", "id_student"],
    how="left",
)
print(f"After + studentRegistration (left): {df.shape}")

df = df.merge(
    courses[["code_module", "code_presentation", "module_presentation_length"]],
    on=["code_module", "code_presentation"],
    how="left",
)
print(f"After + courses (left): {df.shape}")


# ===========================================================================
# 1b. ENGINEER REAL ENGAGEMENT FEATURES FROM studentVle.csv (large file)
# ===========================================================================
section("1b. ENGINEER ENGAGEMENT FEATURES FROM studentVle.csv (chunked)")

VLE_PATH = os.path.join(DATASETS_DIR, "studentVle.csv")
vle_features = None

try:
    t0 = time.time()
    chunk_iter = pd.read_csv(VLE_PATH, chunksize=500_000)

    # Aggregate to per-student/module/presentation/week totals incrementally,
    # so the ~423MB raw file is never held in memory - only the much smaller
    # weekly summary is accumulated across chunks.
    weekly_parts = []
    n_rows = 0
    for i, chunk in enumerate(chunk_iter):
        chunk["week"] = chunk["date"] // 7  # week number relative to module start (can be negative pre-start)
        grp = (
            chunk.groupby(["code_module", "code_presentation", "id_student", "week"])["sum_click"]
            .sum()
            .reset_index()
        )
        weekly_parts.append(grp)
        n_rows += len(chunk)
        if (i + 1) % 5 == 0:
            print(f"  processed {n_rows:,} raw rows so far... ({time.time() - t0:.1f}s elapsed)")

    # Combine partial weekly aggregates and sum again (a student/week pair can
    # span two chunks) to get the true per-student-module-week total clicks.
    weekly_clicks = (
        pd.concat(weekly_parts, ignore_index=True)
        .groupby(["code_module", "code_presentation", "id_student", "week"])["sum_click"]
        .sum()
        .reset_index()
    )
    print(f"Finished chunked read of studentVle.csv: {n_rows:,} raw rows in {time.time() - t0:.1f}s")
    print(f"Aggregated weekly_clicks table shape: {weekly_clicks.shape}")

    # --- Build per-student-module engagement features from the weekly table ---
    def summarize_group(g):
        g = g.sort_values("week")
        avg_weekly_clicks = g["sum_click"].mean()
        active_weeks_ratio = (g["sum_click"] > 0).mean()
        # Trend proxy: most recent week's clicks vs the student's own average
        # of all earlier weeks (not including the most recent one).
        if len(g) >= 2:
            recent = g["sum_click"].iloc[-1]
            earlier_avg = g["sum_click"].iloc[:-1].mean()
            clicks_trend = recent - earlier_avg
        else:
            clicks_trend = 0.0
        return pd.Series({
            "avg_weekly_clicks": avg_weekly_clicks,
            "clicks_trend": clicks_trend,
            "active_weeks_ratio": active_weeks_ratio,
        })

    vle_features = (
        weekly_clicks.groupby(["code_module", "code_presentation", "id_student"])
        .apply(summarize_group)
        .reset_index()
    )
    vle_features["has_vle_activity"] = True
    print(f"Per-student-module engagement feature table shape: {vle_features.shape}")

except Exception as e:
    print(f"WARNING: failed to process studentVle.csv ({e}). "
          f"Skipping engagement features and continuing with the rest of the pipeline.")
    vle_features = None

if vle_features is not None:
    df = df.merge(
        vle_features,
        on=["code_module", "code_presentation", "id_student"],
        how="left",
    )
    # Students with no VLE record at all: fill engagement features with 0 and flag them.
    engagement_cols = ["avg_weekly_clicks", "clicks_trend", "active_weeks_ratio"]
    df["has_vle_activity"] = df["has_vle_activity"].fillna(False)
    df[engagement_cols] = df[engagement_cols].fillna(0.0)
    print("Merged engagement features into task-level table.")
else:
    df["avg_weekly_clicks"] = 0.0
    df["clicks_trend"] = 0.0
    df["active_weeks_ratio"] = 0.0
    df["has_vle_activity"] = False
    print("Engagement features unavailable - filled with 0 / False placeholders.")


# ===========================================================================
# 2. AVOID TARGET LEAKAGE - engineer prior_avg_score
#    (score, date_submitted, and anything derived from date_submitted, plus
#    final_result, are NEVER used as model INPUT FEATURES - see section 3.
#    score/date_submitted ARE still used below, in section 5, but only to
#    build the ground-truth Priority_Label - not as a feature - see section 5
#    for why that's the correct, non-leaky way to do supervised learning.)
# ===========================================================================
section("2. ENGINEER LEAKAGE-FREE prior_avg_score")

# Sort by deadline order within each student's module/presentation so that
# "prior" means "earlier-deadline assessments", matching how a planner would
# actually see the timeline (not by date_submitted, which would leak).
df = df.sort_values(["id_student", "code_module", "code_presentation", "date"]).reset_index(drop=True)

# Expanding mean of score, shifted by 1 row within each student-module group,
# so the current row's own score is excluded (that's the leakage-free part).
grp = df.groupby(["id_student", "code_module", "code_presentation"])["score"]
df["prior_avg_score"] = grp.transform(lambda s: s.expanding().mean().shift(1))

# Fallback for a student's very first assessment in a module (no prior rows yet):
# use that module/presentation's cohort-wide mean score up to that point.
# Simpler and documented choice: cohort mean score for the module/presentation,
# falling back further to the overall dataset mean score if even that is unavailable.
cohort_mean = df.groupby(["code_module", "code_presentation"])["score"].transform("mean")
overall_mean = df["score"].mean()
df["prior_avg_score"] = df["prior_avg_score"].fillna(cohort_mean).fillna(overall_mean)

print(f"prior_avg_score engineered. Rows that needed the cohort/overall-mean fallback: "
      f"{(grp.transform(lambda s: s.expanding().mean().shift(1)).isna()).sum()}")

# days_until_deadline_at_planning: we have no true "planning date" in OULAD,
# so we use the assessment deadline itself (date) as the forward-looking
# urgency signal. This is intentionally the same column as `date`, kept as
# an explicitly-named proxy so the leakage-avoidance reasoning is documented
# inline rather than silently reusing `date` for two purposes.
df["days_until_deadline_at_planning"] = df["date"]


# ===========================================================================
# 5. CREATE THE TARGET LABEL - Priority_Label (outcome-based, not
#    formula-recoverable from the model's own input features)
#
#    Standard supervised learning: the LABEL is allowed to look at the
#    ground truth (score, submitted_late) because that's what we're teaching
#    the model to predict in hindsight. What must never happen is score /
#    date_submitted / submitted_late leaking into the FEATURE matrix X - that
#    is enforced in section 3, which drops them from df immediately after
#    this block uses them to build Priority_Label. If Priority_Label were
#    instead derived only from weight/date/prior_avg_score (i.e. from the
#    model's own inputs), any model would trivially "recover" the label
#    arithmetic and score ~99-100%, which would validate the pipeline but
#    prove nothing about real predictive ability - so we deliberately do not
#    do that here.
# ===========================================================================
section("5. BUILD OUTCOME-BASED Priority_Label (from raw score/date_submitted)")

# submitted_late uses the raw, still-present date_submitted vs. deadline date.
# This raw column is used ONLY here, for label construction, and is dropped
# (along with score and date_submitted themselves) in section 3 below - it
# never reaches the feature matrix X.
df["submitted_late"] = (df["date_submitted"] > df["date"]).astype(int)

def label_from_outcome(row):
    # High priority (in hindsight): the task genuinely needed urgent attention.
    if row["score"] < 50 or row["submitted_late"] == 1 or (row["score"] < 60 and row["weight"] >= 20):
        return "High"
    # Low priority: comfortably handled, on time, and not high-stakes.
    if row["score"] >= 75 and row["submitted_late"] == 0 and row["weight"] < 15:
        return "Low"
    # Everything else.
    return "Medium"

df["Priority_Label"] = df.apply(label_from_outcome, axis=1)

print("Priority_Label class distribution (real, unbalanced - not artificially adjusted):")
print(df["Priority_Label"].value_counts())
print(df["Priority_Label"].value_counts(normalize=True).round(3))


# ===========================================================================
# 3. DROP UNWANTED COLUMNS (identifiers, PII, fairness-sensitive, leakage)
#    score, date_submitted, submitted_late were used ABOVE only to build
#    Priority_Label - they are dropped here, before the feature matrix is
#    built, so they never appear as model inputs.
# ===========================================================================
section("3. DROP UNWANTED / LEAKAGE COLUMNS (used only for label construction above)")

drop_cols = [
    "id_assessment", "id_student",  # identifiers
    "score", "date_submitted", "is_banked",  # leakage: only known after completion (used above for the label only)
    "days_early_or_late", "submitted_late",  # leakage: derived from date_submitted (used above for the label only)
    "final_result",  # leakage: only known at end of module
    "disability", "highest_education", "age_band",  # fairness-sensitive, dropped from model input
]
present_drop_cols = [c for c in drop_cols if c in df.columns]
print(f"Dropping columns: {present_drop_cols}")
df_model = df.drop(columns=present_drop_cols)


# ===========================================================================
# 4. FINAL FEATURE SET
# ===========================================================================
section("4. FINAL FEATURE SET")

feature_cols = [
    "date", "weight", "assessment_type",
    "num_of_prev_attempts", "studied_credits", "module_presentation_length",
    "date_registration", "prior_avg_score",
    "code_module",
    "avg_weekly_clicks", "clicks_trend", "active_weeks_ratio", "has_vle_activity",
]
feature_cols = [c for c in feature_cols if c in df_model.columns]
print(f"Model input features ({len(feature_cols)}): {feature_cols}")
assert "score" not in feature_cols and "date_submitted" not in feature_cols and "submitted_late" not in feature_cols, \
    "Leakage check failed: outcome columns must not be in the feature set."


# ===========================================================================
# 6. PREPROCESSING
# ===========================================================================
section("6. PREPROCESSING")

# --- Encode categoricals ---
le_assessment_type = LabelEncoder()
df_model["assessment_type_enc"] = le_assessment_type.fit_transform(df_model["assessment_type"].astype(str))

le_code_module = LabelEncoder()
df_model["code_module_enc"] = le_code_module.fit_transform(df_model["code_module"].astype(str))

label_encoders = {
    "assessment_type": le_assessment_type,
    "code_module": le_code_module,
}

model_feature_cols = [c for c in feature_cols if c not in ("assessment_type", "code_module")]
model_feature_cols += ["assessment_type_enc", "code_module_enc"]
if "has_vle_activity" in model_feature_cols:
    df_model["has_vle_activity"] = df_model["has_vle_activity"].astype(int)

# --- Save the full leakage-free dataset (features + label) before splitting ---
export_cols = model_feature_cols + ["Priority_Label"]
df_model[export_cols].to_csv(
    os.path.join(OUTPUTS_DIR, "oulad_task_level_leakage_free.csv"), index=False
)
print(f"Saved final leakage-free dataset: {export_cols}")

# --- Null report ---
print("\nNull counts in model features before imputation:")
print(df_model[model_feature_cols].isna().sum())

# date_registration can be NaN (student registered before/without a clean numeric
# record, or coercion failure) - impute with the median, a robust default for a
# roughly-continuous "days relative to module start" feature.
if df_model["date_registration"].isna().any():
    median_reg = df_model["date_registration"].median()
    df_model["date_registration"] = df_model["date_registration"].fillna(median_reg)
    print(f"Imputed missing date_registration with median = {median_reg}")

# Any remaining numeric NaNs (defensive - none expected after step 2/1b handling)
remaining_na = df_model[model_feature_cols].isna().sum().sum()
if remaining_na > 0:
    df_model[model_feature_cols] = df_model[model_feature_cols].fillna(df_model[model_feature_cols].median(numeric_only=True))
    print(f"Imputed {remaining_na} remaining missing values with column medians.")

X = df_model[model_feature_cols].copy()
y = df_model["Priority_Label"].copy()

# --- Train/test split (80/20, stratified) ---
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=RANDOM_STATE
)
print(f"\nTrain shape: {X_train.shape}, Test shape: {X_test.shape}")

# --- Class balance check / SMOTE ---
train_dist = y_train.value_counts(normalize=True)
print("\nTraining class distribution:")
print(train_dist.round(3))

min_class_frac = train_dist.min()
SMOTE_THRESHOLD = 0.15
if min_class_frac < SMOTE_THRESHOLD:
    print(f"Smallest class is {min_class_frac:.1%} of training data (< {SMOTE_THRESHOLD:.0%}) -> applying SMOTE to training set only.")
    smote = SMOTE(random_state=RANDOM_STATE)
    X_train, y_train = smote.fit_resample(X_train, y_train)
    print(f"After SMOTE, training shape: {X_train.shape}")
    print(y_train.value_counts(normalize=True).round(3))
else:
    print(f"Smallest class is {min_class_frac:.1%} of training data (>= {SMOTE_THRESHOLD:.0%}) -> dataset is sufficiently balanced, skipping SMOTE.")

# --- Scaling (fit on train only) ---
scaler = StandardScaler()
X_train_scaled = pd.DataFrame(scaler.fit_transform(X_train), columns=X_train.columns, index=X_train.index)
X_test_scaled = pd.DataFrame(scaler.transform(X_test), columns=X_test.columns, index=X_test.index)


# ===========================================================================
# 7. TRAIN LOGISTIC REGRESSION (primary model)
# ===========================================================================
section("7. LOGISTIC REGRESSION (primary model)")

lr = LogisticRegression(max_iter=1000, random_state=RANDOM_STATE)
lr.fit(X_train_scaled, y_train)
lr_pred = lr.predict(X_test_scaled)
lr_proba = lr.predict_proba(X_test_scaled)

lr_acc = accuracy_score(y_test, lr_pred)
lr_f1_weighted = f1_score(y_test, lr_pred, average="weighted")
lr_f1_macro = f1_score(y_test, lr_pred, average="macro")

print(f"Accuracy: {lr_acc:.4f}")
print(f"Weighted F1: {lr_f1_weighted:.4f}")
print(f"Macro F1: {lr_f1_macro:.4f}")
print("\nClassification report:")
print(classification_report(y_test, lr_pred, labels=CLASS_ORDER))

lr_cm = confusion_matrix(y_test, lr_pred, labels=CLASS_ORDER)
lr_cm_df = pd.DataFrame(lr_cm, index=[f"true_{c}" for c in CLASS_ORDER], columns=[f"pred_{c}" for c in CLASS_ORDER])
print("\nConfusion matrix:")
print(lr_cm_df)

# One-vs-rest ROC-AUC (macro + per-class)
y_test_bin = pd.get_dummies(y_test)[CLASS_ORDER].values
class_to_idx = {c: i for i, c in enumerate(lr.classes_)}
lr_proba_ordered = lr_proba[:, [class_to_idx[c] for c in CLASS_ORDER]]

roc_auc_per_class = {}
for i, c in enumerate(CLASS_ORDER):
    roc_auc_per_class[c] = roc_auc_score(y_test_bin[:, i], lr_proba_ordered[:, i])
roc_auc_macro = roc_auc_score(y_test_bin, lr_proba_ordered, average="macro", multi_class="ovr")
print(f"\nMacro ROC-AUC (OvR): {roc_auc_macro:.4f}")
print(f"Per-class ROC-AUC: {roc_auc_per_class}")

lr_coef_df = pd.DataFrame(lr.coef_, columns=X_train_scaled.columns, index=lr.classes_)
print("\nLogistic Regression coefficients per class:")
print(lr_coef_df)
lr_coef_df.to_csv(os.path.join(OUTPUTS_DIR, "lr_coefficients.csv"))

cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
cv_scores = cross_val_score(lr, X_train_scaled, y_train, cv=cv, scoring="f1_weighted")
print(f"\n5-fold stratified CV weighted F1: mean={cv_scores.mean():.4f}, std={cv_scores.std():.4f}")


# ===========================================================================
# 8. TRAIN AND COMPARE ADDITIONAL MODELS
# ===========================================================================
section("8. TRAIN AND COMPARE ADDITIONAL MODELS")

models_unscaled = {
    "Random Forest": RandomForestClassifier(n_estimators=300, max_depth=8, random_state=RANDOM_STATE),
    "Gradient Boosting": GradientBoostingClassifier(n_estimators=200, max_depth=4, random_state=RANDOM_STATE),
    "XGBoost": XGBClassifier(
        n_estimators=300, max_depth=6, learning_rate=0.1,
        random_state=RANDOM_STATE, eval_metric="mlogloss",
    ),
    "Decision Tree": DecisionTreeClassifier(max_depth=8, random_state=RANDOM_STATE),
}
models_scaled = {
    "SVM RBF": SVC(random_state=RANDOM_STATE, probability=True),
    "KNN": KNeighborsClassifier(n_neighbors=7),
    "Naive Bayes": GaussianNB(),
}

all_models = {"Logistic Regression": lr}
comparison_rows = []

def evaluate(name, model, y_pred):
    acc = accuracy_score(y_test, y_pred)
    f1w = f1_score(y_test, y_pred, average="weighted")
    report = classification_report(y_test, y_pred, labels=CLASS_ORDER, output_dict=True)
    high = report["High"]
    comparison_rows.append({
        "Model": name,
        "Accuracy": acc,
        "Weighted F1": f1w,
        "High-Priority Precision": high["precision"],
        "High-Priority Recall": high["recall"],
        "High-Priority F1": high["f1-score"],
    })
    print(f"{name}: Accuracy={acc:.4f}, Weighted F1={f1w:.4f}, "
          f"High Precision={high['precision']:.4f}, High Recall={high['recall']:.4f}, High F1={high['f1-score']:.4f}")

# Encode-only XGBoost needs numeric labels
xgb_label_encoder = LabelEncoder()
xgb_label_encoder.fit(CLASS_ORDER)
y_train_xgb = xgb_label_encoder.transform(y_train)

evaluate("Logistic Regression", lr, lr_pred)

for name, model in models_unscaled.items():
    if name == "XGBoost":
        model.fit(X_train, y_train_xgb)
        pred_num = model.predict(X_test)
        pred = xgb_label_encoder.inverse_transform(pred_num)
    else:
        model.fit(X_train, y_train)
        pred = model.predict(X_test)
    all_models[name] = model
    evaluate(name, model, pred)

for name, model in models_scaled.items():
    model.fit(X_train_scaled, y_train)
    pred = model.predict(X_test_scaled)
    all_models[name] = model
    evaluate(name, model, pred)

comparison_df = pd.DataFrame(comparison_rows).sort_values("Weighted F1", ascending=False).reset_index(drop=True)
print("\nModel comparison table (sorted by Weighted F1):")
print(comparison_df)
comparison_df.to_csv(os.path.join(OUTPUTS_DIR, "model_comparison_results.csv"), index=False)

# --- Leakage sanity check: Priority_Label is now built from real outcomes
# (score/submitted_late), not from the model's own input features, so scores
# this high are NOT expected. Flag loudly rather than silently reporting them.
# Factored into leakage_guard.py so it's independently unit-testable (see
# tests/test_leakage_guard.py) against both a deliberately-leaky toy case and
# this real production comparison table, instead of only ever running as
# part of the full multi-minute training pipeline.
from leakage_guard import LEAKAGE_SUSPECT_THRESHOLD, find_leakage_suspects  # noqa: E402

suspect_rows = find_leakage_suspects(comparison_df, LEAKAGE_SUSPECT_THRESHOLD)
if not suspect_rows.empty:
    print(f"\n*** WARNING: {len(suspect_rows)} model(s) exceeded {LEAKAGE_SUSPECT_THRESHOLD:.0%} "
          f"Accuracy or Weighted F1: {suspect_rows['Model'].tolist()}. ***")
    print("*** Since Priority_Label is derived from real outcomes (score/submitted_late) and NOT from ***")
    print("*** the model's own input features, scores this high are suspicious and may indicate remaining ***")
    print("*** target leakage. Review feature/label construction (sections 2-5) before trusting these results. ***")
else:
    print(f"\nNo model exceeded the {LEAKAGE_SUSPECT_THRESHOLD:.0%} leakage-suspicion threshold on Accuracy or Weighted F1 - "
          f"scores look consistent with a genuinely non-trivial prediction task.")


# ===========================================================================
# 9. SAVE VISUAL OUTPUTS AS PNG
# ===========================================================================
section("9. SAVE VISUAL OUTPUTS")

# --- model_comparison_bar_chart.png ---
plt.figure(figsize=(11, 6))
plot_df = comparison_df.set_index("Model")[["Accuracy", "Weighted F1", "High-Priority F1"]]
plot_df.plot(kind="bar", figsize=(11, 6))
plt.title("Model Comparison: Accuracy, Weighted F1, High-Priority F1", fontsize=14)
plt.ylabel("Score", fontsize=12)
plt.xlabel("Model", fontsize=12)
plt.xticks(rotation=30, ha="right")
plt.legend(title="Metric", fontsize=10)
plt.tight_layout()
plt.savefig(os.path.join(OUTPUTS_DIR, "model_comparison_bar_chart.png"), dpi=300)
plt.close()

# --- lr_confusion_matrix.png ---
plt.figure(figsize=(7, 6))
sns.heatmap(lr_cm_df, annot=True, fmt="d", cmap="Blues", cbar=True)
plt.title("Logistic Regression - Confusion Matrix", fontsize=14)
plt.ylabel("True Label", fontsize=12)
plt.xlabel("Predicted Label", fontsize=12)
plt.tight_layout()
plt.savefig(os.path.join(OUTPUTS_DIR, "lr_confusion_matrix.png"), dpi=300)
plt.close()

# --- lr_roc_curve.png ---
plt.figure(figsize=(7, 6))
for i, c in enumerate(CLASS_ORDER):
    fpr, tpr, _ = roc_curve(y_test_bin[:, i], lr_proba_ordered[:, i])
    plt.plot(fpr, tpr, label=f"{c} (AUC = {roc_auc_per_class[c]:.3f})")
plt.plot([0, 1], [0, 1], "k--", label="Chance")
plt.title("Logistic Regression - Multiclass ROC Curves (One-vs-Rest)", fontsize=14)
plt.xlabel("False Positive Rate", fontsize=12)
plt.ylabel("True Positive Rate", fontsize=12)
plt.legend(loc="lower right", fontsize=10)
plt.tight_layout()
plt.savefig(os.path.join(OUTPUTS_DIR, "lr_roc_curve.png"), dpi=300)
plt.close()

# --- feature_importance_comparison.png ---
best_tree_name = comparison_df[comparison_df["Model"].isin(["Random Forest", "XGBoost", "Gradient Boosting", "Decision Tree"])].iloc[0]["Model"]
best_tree_model = all_models[best_tree_name]

fig, axes = plt.subplots(1, 2, figsize=(14, 6))

lr_importance = lr_coef_df.abs().mean(axis=0).sort_values(ascending=True)
axes[0].barh(lr_importance.index, lr_importance.values, color="steelblue")
axes[0].set_title("Logistic Regression\n(mean |coefficient| across classes)", fontsize=12)
axes[0].set_xlabel("Mean |Coefficient|", fontsize=11)

tree_importance = pd.Series(best_tree_model.feature_importances_, index=X_train.columns).sort_values(ascending=True)
axes[1].barh(tree_importance.index, tree_importance.values, color="darkorange")
axes[1].set_title(f"{best_tree_name}\n(feature importance)", fontsize=12)
axes[1].set_xlabel("Importance", fontsize=11)

fig.suptitle("Feature Importance Comparison: Logistic Regression vs. Best Tree-Based Model", fontsize=14)
plt.tight_layout()
plt.savefig(os.path.join(OUTPUTS_DIR, "feature_importance_comparison.png"), dpi=300)
plt.close()

print(f"Saved PNG outputs to {OUTPUTS_DIR}")


# ===========================================================================
# 11. SAVE TRAINED MODEL
# ===========================================================================
section("11. SAVE BEST MODEL, SCALER, AND ENCODERS")

best_row = comparison_df.iloc[0]
best_model_name = best_row["Model"]
best_model = all_models[best_model_name]
print(f"Best model by Weighted F1: {best_model_name} (Weighted F1 = {best_row['Weighted F1']:.4f})")

joblib.dump(best_model, os.path.join(MODELS_DIR, "priority_model.joblib"))
joblib.dump(scaler, os.path.join(MODELS_DIR, "scaler.joblib"))
joblib.dump(label_encoders, os.path.join(MODELS_DIR, "label_encoders.joblib"))
print(f"Saved priority_model.joblib, scaler.joblib, label_encoders.joblib to {MODELS_DIR}")

if best_model_name == "XGBoost":
    joblib.dump(xgb_label_encoder, os.path.join(MODELS_DIR, "xgb_label_encoder.joblib"))
    print("Best model is XGBoost - also saved xgb_label_encoder.joblib (numeric<->label mapping).")


# ===========================================================================
# 12. FINAL SUMMARY
# ===========================================================================
section("12. FINAL SUMMARY")

print("Model comparison (sorted by Weighted F1):")
print(comparison_df.to_string(index=False))

best_high_recall_row = comparison_df.sort_values("High-Priority Recall", ascending=False).iloc[0]

print(f"""
Summary:
- Best overall model (Weighted F1): {best_row['Model']}
  (Accuracy={best_row['Accuracy']:.4f}, Weighted F1={best_row['Weighted F1']:.4f}).
- Best High-Priority Recall: {best_high_recall_row['Model']}
  (Recall={best_high_recall_row['High-Priority Recall']:.4f}).
- Logistic Regression (primary/baseline model): Accuracy={lr_acc:.4f}, Weighted F1={lr_f1_weighted:.4f},
  Macro ROC-AUC={roc_auc_macro:.4f}, 5-fold CV weighted F1={cv_scores.mean():.4f} (+/- {cv_scores.std():.4f}).
- Priority_Label is derived from real outcomes (score, submitted_late) that are NOT in the feature
  set, so this is a genuine generalization task rather than label-formula recovery. Tree-based
  ensembles typically edge out the linear Logistic Regression baseline here because the true
  relationship between prior performance/engagement/workload and struggling on a future task is
  nonlinear and involves feature interactions - splits capture that more directly than a linear
  decision boundary, at some cost to interpretability.
- Saved artifacts: {os.path.relpath(os.path.join(MODELS_DIR, 'priority_model.joblib'), BACKEND_DIR)},
  scaler.joblib, label_encoders.joblib (+ xgb_label_encoder.joblib if XGBoost won).
""")

print("Done.")
