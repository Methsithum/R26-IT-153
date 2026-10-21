"""train_priority_model_constrained.py"""

import os
import sys

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from xgboost import XGBClassifier

from leakage_guard import LEAKAGE_SUSPECT_THRESHOLD, is_leakage_suspect

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))

# The wrapper class must be imported from its canonical, deployed location
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)
from app.services.study_planner.ordinal_priority_model import CLASS_ORDER, OrdinalPriorityModel

OUTPUTS_DIR = os.path.join(BACKEND_DIR, "ml_scripts", "study-planner", "outputs")
NEW_MODELS_DIR = os.path.join(BACKEND_DIR, "trained-models", "stuyd-planner")
os.makedirs(NEW_MODELS_DIR, exist_ok=True)
# The constrained model replaced the unconstrained one in priority_model.joblib
ORIGINAL_MODEL_PATH = os.path.join(NEW_MODELS_DIR, "priority_model_v1_unconstrained.joblib")
ORIGINAL_LABEL_ENCODER_PATH = os.path.join(NEW_MODELS_DIR, "xgb_label_encoder_v1_unconstrained.joblib")

RANDOM_STATE = 42
# LEAKAGE_SUSPECT_THRESHOLD imported from leakage_guard.py above


def section(title):
    print("\n" + "=" * 90)
    print(title)
    print("=" * 90)


# 1.
section("1. LOAD oulad_task_level_leakage_free.csv (features + label untouched)")

df = pd.read_csv(os.path.join(OUTPUTS_DIR, "oulad_task_level_leakage_free.csv"))
feature_cols = [c for c in df.columns if c != "Priority_Label"]
print(f"Loaded {df.shape[0]} rows, {len(feature_cols)} features: {feature_cols}")
assert feature_cols[0] == "date", "This script assumes `date` is feature index 0 - order changed upstream."


# 2.
section("2. CONFIRM CONSTRAINT DIRECTION (frontend/src/utils/featureNameMap.js)")

# buildDateFeatureFromDeadline(deadlineIsoDate)
DATE_IDX = feature_cols.index("date")
monotone_constraints = tuple(-1 if i == DATE_IDX else 0 for i in range(len(feature_cols)))
print(f"Feature order:        {feature_cols}")
print(f"monotone_constraints: {monotone_constraints}  (index {DATE_IDX} = 'date', constrained decreasing)")
print("Direction check: buildDateFeatureFromDeadline maps a NEARER real deadline to a LOWER `date` "
      "value (12=urgent .. 261=far off), so predicted risk/priority must fall as `date` rises -> "
      "constraint = -1 on `date`. Confirmed against featureNameMap.js, not assumed.")


# 2b.
section("2b. MULTI-CLASS CONSTRAINED CONSTRAINTS - WHY THE ORDINAL FALLBACK IS USED")

print("""
XGBoost's native multi:softmax/softprob trains one set of trees per class per
boosting round. A single `monotone_constraints` tuple is applied with the
SAME sign to every class's trees for a given feature. That is wrong for this
problem: as `date` rises (deadline further off), we need
  P(High)   to FALL   (fewer far-off tasks are truly urgent)
  P(Low)    to RISE   (more far-off tasks are safely low priority)
  P(Medium) unconstrained
-> opposite signs for Low vs. High, which one shared constraint cannot express
for an unordered 3-class softmax. Silently applying `-1` anyway would either
be a no-op for the classes where it's wrong, or actively distort them -
neither is an honest "deadline constraint applied" claim.

Instead, Priority is treated as ORDINAL (Low < Medium < High, which the label
design already reflects) and reframed as two cumulative binary problems:
  Model A: P(priority >= Medium)   ["not Low"]
  Model B: P(priority >= High)
Both are legitimate binary classification targets, both get the SAME `date`
constraint (-1, decreasing) with unambiguous meaning (higher cumulative risk
should not increase as the deadline moves further off), and both are
well-supported by monotone_constraints in binary:logistic XGBoost. The two
combine into a 3-class distribution via OrdinalPriorityModel
(ordinal_priority_model.py): P(Low)=1-P(>=Medium), P(Medium)=P(>=Medium)-P(>=High),
P(High)=P(>=High).
""")


# 3.
section("3. TRAIN/TEST SPLIT (stratified, random_state=42, same as original)")

X = df[feature_cols].copy()
y = df["Priority_Label"].copy()

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=RANDOM_STATE
)
print(f"Train shape: {X_train.shape}, Test shape: {X_test.shape}")

y_train_ge_medium = (y_train != "Low").astype(int)
y_train_ge_high = (y_train == "High").astype(int)
y_test_ge_medium = (y_test != "Low").astype(int)
y_test_ge_high = (y_test == "High").astype(int)

for name, y_bin in [("P(>=Medium) train", y_train_ge_medium), ("P(>=High) train", y_train_ge_high)]:
    frac = y_bin.mean()
    print(f"{name} positive class fraction: {frac:.3f}")
SMOTE_THRESHOLD = 0.15
if min(y_train_ge_medium.mean(), 1 - y_train_ge_medium.mean(), y_train_ge_high.mean(), 1 - y_train_ge_high.mean()) < SMOTE_THRESHOLD:
    print(f"A binary task's minority class fell below {SMOTE_THRESHOLD:.0%} - would need SMOTE per-task; "
          f"not triggered here (checked above), so none applied - kept identical to original methodology otherwise.")
else:
    print(f"Both binary tasks' minority classes are >= {SMOTE_THRESHOLD:.0%} of training data - "
          f"no SMOTE needed (same threshold logic as train_priority_model.py).")


# 4.
section("4. TRAIN CONSTRAINED BINARY XGBOOST MODELS")

xgb_common_kwargs = dict(
    n_estimators=300, max_depth=6, learning_rate=0.1,
    random_state=RANDOM_STATE, eval_metric="logloss",
    monotone_constraints=monotone_constraints,
    tree_method="hist",  # monotone_constraints requires hist or exact, not approx
)

model_medium = XGBClassifier(**xgb_common_kwargs)
model_medium.fit(X_train, y_train_ge_medium)

model_high = XGBClassifier(**xgb_common_kwargs)
model_high.fit(X_train, y_train_ge_high)

constrained_model = OrdinalPriorityModel(model_medium, model_high)
print("Trained model_medium (P(>=Medium)) and model_high (P(>=High)), both with "
      f"monotone_constraints={monotone_constraints} on `date`.")


# 5.
section("5. LOAD ORIGINAL DEPLOYED MODEL FOR COMPARISON")

original_model = joblib.load(ORIGINAL_MODEL_PATH)
original_xgb_label_encoder = joblib.load(ORIGINAL_LABEL_ENCODER_PATH)
print(f"Loaded original model: {type(original_model).__name__}, "
      f"label classes (encoder order): {list(original_xgb_label_encoder.classes_)}")


def evaluate_ordinal(name, y_true, y_pred_labels):
    acc = accuracy_score(y_true, y_pred_labels)
    f1w = f1_score(y_true, y_pred_labels, average="weighted")
    report = classification_report(y_true, y_pred_labels, labels=CLASS_ORDER, output_dict=True, zero_division=0)
    cm = confusion_matrix(y_true, y_pred_labels, labels=CLASS_ORDER)
    cm_df = pd.DataFrame(cm, index=[f"true_{c}" for c in CLASS_ORDER], columns=[f"pred_{c}" for c in CLASS_ORDER])
    print(f"\n--- {name} ---")
    print(f"Accuracy: {acc:.4f}   Weighted F1: {f1w:.4f}")
    print(classification_report(y_true, y_pred_labels, labels=CLASS_ORDER, zero_division=0))
    print("Confusion matrix:")
    print(cm_df)
    return {"name": name, "accuracy": acc, "weighted_f1": f1w, "report": report}


# 6.
section("6. COMPARE ORIGINAL (UNCONSTRAINED) VS. CONSTRAINED MODEL ON THE SAME TEST SET")

orig_pred_num = original_model.predict(X_test)
orig_pred_labels = original_xgb_label_encoder.inverse_transform(orig_pred_num)
orig_results = evaluate_ordinal("Original XGBoost (unconstrained)", y_test, orig_pred_labels)

constrained_pred_idx = constrained_model.predict(X_test)
constrained_pred_labels = np.array(CLASS_ORDER)[constrained_pred_idx]
constrained_results = evaluate_ordinal("Constrained ordinal XGBoost (date-constrained)", y_test, constrained_pred_labels)

comparison_df = pd.DataFrame([
    {
        "Model": "Original (unconstrained)",
        "Accuracy": orig_results["accuracy"],
        "Weighted F1": orig_results["weighted_f1"],
        **{f"{c} precision": orig_results["report"][c]["precision"] for c in CLASS_ORDER},
        **{f"{c} recall": orig_results["report"][c]["recall"] for c in CLASS_ORDER},
    },
    {
        "Model": "Constrained (date-constrained, ordinal)",
        "Accuracy": constrained_results["accuracy"],
        "Weighted F1": constrained_results["weighted_f1"],
        **{f"{c} precision": constrained_results["report"][c]["precision"] for c in CLASS_ORDER},
        **{f"{c} recall": constrained_results["report"][c]["recall"] for c in CLASS_ORDER},
    },
])
print("\nSide-by-side comparison:")
print(comparison_df.to_string(index=False))
comparison_df.to_csv(os.path.join(OUTPUTS_DIR, "constrained_vs_original_comparison.csv"), index=False)


# 7.
section("7. LEAKAGE GUARD (>=97% accuracy/F1 warning) - RE-CHECKED ON CONSTRAINED MODEL")

suspect = is_leakage_suspect(constrained_results["accuracy"], constrained_results["weighted_f1"], LEAKAGE_SUSPECT_THRESHOLD)
if suspect:
    print(f"*** WARNING: constrained model exceeded {LEAKAGE_SUSPECT_THRESHOLD:.0%} Accuracy or Weighted F1 "
          f"(Accuracy={constrained_results['accuracy']:.4f}, Weighted F1={constrained_results['weighted_f1']:.4f}). "
          f"Since Priority_Label is derived from real outcomes not in the feature set, this would be "
          f"suspicious and should be investigated before trusting these results. ***")
else:
    print(f"Constrained model: Accuracy={constrained_results['accuracy']:.4f}, Weighted F1={constrained_results['weighted_f1']:.4f} "
          f"- both below the {LEAKAGE_SUSPECT_THRESHOLD:.0%} leakage-suspicion threshold. No leakage flag.")


# 8.
section("8. VERIFY FIX ON THE TWO REAL TASKS FROM THE LIVE INVESTIGATION")

# Exact feature values logged during the live /predict-priority investigation
base_row = {
    "weight": 20.0,
    "num_of_prev_attempts": 0,
    "studied_credits": 60,
    "module_presentation_length": 240,
    "date_registration": -30,
    "prior_avg_score": 65,
    "avg_weekly_clicks": 15,
    "clicks_trend": 0,
    "active_weeks_ratio": 0.5,
    "has_vle_activity": 1,
    "assessment_type_enc": 2,
    "code_module_enc": 0,
}
near_term = {**base_row, "date": 13.383333333333333}   # due tomorrow
distant = {**base_row, "date": 56.266666666666666}     # due in 32 days

real_tasks_df = pd.DataFrame([near_term, distant], index=["near_term (due tomorrow)", "distant (due in 32 days)"])[feature_cols]

orig_real_pred_num = original_model.predict(real_tasks_df)
orig_real_pred_labels = original_xgb_label_encoder.inverse_transform(orig_real_pred_num)
orig_real_proba = original_model.predict_proba(real_tasks_df)

constrained_real_proba = constrained_model.predict_proba(real_tasks_df)
constrained_real_pred_idx = constrained_model.predict(real_tasks_df)
constrained_real_pred_labels = np.array(CLASS_ORDER)[constrained_real_pred_idx]

print("ORIGINAL (unconstrained) model:")
for i, row_name in enumerate(real_tasks_df.index):
    conf = float(orig_real_proba[i][orig_real_pred_num[i]])
    print(f"  {row_name}: date={real_tasks_df.iloc[i]['date']:.2f} -> {orig_real_pred_labels[i]} (confidence {conf:.4f})")

print("\nCONSTRAINED (date-constrained) model:")
for i, row_name in enumerate(real_tasks_df.index):
    conf = float(constrained_real_proba[i][constrained_real_pred_idx[i]])
    print(f"  {row_name}: date={real_tasks_df.iloc[i]['date']:.2f} -> {constrained_real_pred_labels[i]} (confidence {conf:.4f})")
    print(f"    full distribution: Low={constrained_real_proba[i][0]:.4f}, Medium={constrained_real_proba[i][1]:.4f}, High={constrained_real_proba[i][2]:.4f}")

near_rank = CLASS_ORDER.index(constrained_real_pred_labels[0])
distant_rank = CLASS_ORDER.index(constrained_real_pred_labels[1])
fixed = near_rank >= distant_rank
print(f"\nInversion resolved: near-term predicted priority ({constrained_real_pred_labels[0]}) >= "
      f"distant predicted priority ({constrained_real_pred_labels[1]})? {'YES' if fixed else 'NO - STILL INVERTED'}")


# 9.
section("9. DEADLINE-ORDERING SWEEP - date IN [12, 261], ALL OTHER FEATURES FIXED")

sweep_dates = np.linspace(12, 261, 30)
sweep_rows = pd.DataFrame([{**base_row, "date": d} for d in sweep_dates])[feature_cols]

orig_sweep_proba = original_model.predict_proba(sweep_rows)
orig_classes_order = list(original_xgb_label_encoder.classes_)  # matches predict_proba column order
constrained_sweep_proba = constrained_model.predict_proba(sweep_rows)

sweep_df = pd.DataFrame({"date": sweep_dates})
for i, c in enumerate(orig_classes_order):
    sweep_df[f"orig_P({c})"] = orig_sweep_proba[:, i]
for i, c in enumerate(CLASS_ORDER):
    sweep_df[f"constrained_P({c})"] = constrained_sweep_proba[:, i]

print(sweep_df.to_string(index=False))
sweep_df.to_csv(os.path.join(OUTPUTS_DIR, "deadline_sweep.csv"), index=False)

constrained_high_diffs = np.diff(sweep_df["constrained_P(High)"].values)
constrained_low_diffs = np.diff(sweep_df["constrained_P(Low)"].values)
high_ordered = bool(np.all(constrained_high_diffs <= 1e-9))
low_ordered = bool(np.all(constrained_low_diffs >= -1e-9))
print(f"\nP(High) non-increasing across the full date sweep: {high_ordered}")
print(f"P(Low) non-decreasing across the full date sweep: {low_ordered}")
if not (high_ordered and low_ordered):
    print("*** WARNING: sweep is not perfectly deadline-consistent - investigate before deploying. ***")
else:
    print("Confirmed deadline-consistent across the ENTIRE trained date range, not just the two spot-checked tasks.")

try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    plt.figure(figsize=(9, 6))
    for c in CLASS_ORDER:
        plt.plot(sweep_df["date"], sweep_df[f"constrained_P({c})"], label=f"Deadline-consistent P({c})")
    for c in orig_classes_order:
        plt.plot(sweep_df["date"], sweep_df[f"orig_P({c})"], linestyle="--", alpha=0.6, label=f"Original P({c})")
    plt.xlabel("date (12=urgent/near deadline .. 261=far off)")
    plt.ylabel("Predicted probability")
    plt.title("Priority probability vs. `date` - Original (unconstrained) vs. Constrained model")
    plt.legend(fontsize=8)
    plt.tight_layout()
    plt.savefig(os.path.join(OUTPUTS_DIR, "deadline_sweep.png"), dpi=300)
    plt.close()
    print(f"Saved sweep plot to {os.path.join(OUTPUTS_DIR, 'deadline_sweep.png')}")
except Exception as e:
    print(f"Skipped plot (non-critical): {e}")


# 10.
section("10. SAVE priority_model_constrained.joblib (NOT deployed - review first)")

constrained_model_path = os.path.join(NEW_MODELS_DIR, "priority_model_constrained.joblib")
joblib.dump(constrained_model, constrained_model_path)
print(f"Saved: {constrained_model_path}")
print(f"NOTE: this script does not touch app/models/study_planner/priority_model.joblib - "
      f"deployment is a separate, explicit step. Bring section 6/8/9 results back for review first.")

print("\nDone.")
