"""explain_priority_shap.py"""

import json
import os
import sys

import joblib
import matplotlib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

matplotlib.use("Agg")

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))

OUTPUTS_DIR = os.path.join(BACKEND_DIR, "ml_scripts", "study-planner", "outputs")
MODELS_DIR = os.path.join(BACKEND_DIR, "app", "models", "study_planner")

DATASET_PATH = os.path.join(OUTPUTS_DIR, "oulad_task_level_leakage_free.csv")
MODEL_PATH = os.path.join(MODELS_DIR, "priority_model.joblib")
SCALER_PATH = os.path.join(MODELS_DIR, "scaler.joblib")
LABEL_ENCODERS_PATH = os.path.join(MODELS_DIR, "label_encoders.joblib")
XGB_LABEL_ENCODER_PATH = os.path.join(MODELS_DIR, "xgb_label_encoder.joblib")

os.makedirs(OUTPUTS_DIR, exist_ok=True)

RANDOM_STATE = 42
CLASS_ORDER = ["Low", "Medium", "High"]


def section(title):
    print("\n" + "=" * 90)
    print(title)
    print("=" * 90)


# 0.
section("0. CHECK REQUIRED INPUT FILES")

required_files = {
    DATASET_PATH: "train_priority_model.py",
    MODEL_PATH: "train_priority_model.py",
    SCALER_PATH: "train_priority_model.py",
    LABEL_ENCODERS_PATH: "train_priority_model.py",
}
missing = [(p, script) for p, script in required_files.items() if not os.path.exists(p)]
if missing:
    print("ERROR: missing required input file(s):")
    for p, script in missing:
        print(f"  - {p}  (run {script} first to generate this)")
    sys.exit(1)
print("All required input files found.")


# 1.
section("1. LOAD MODEL, SCALER, ENCODERS, AND DATA")

model = joblib.load(MODEL_PATH)
scaler = joblib.load(SCALER_PATH)
label_encoders = joblib.load(LABEL_ENCODERS_PATH)
print(f"Loaded model: {type(model).__name__}")

# The saved model is an XGBClassifier.
is_xgboost = type(model).__name__ == "XGBClassifier"
xgb_label_encoder = None
if is_xgboost:
    if not os.path.exists(XGB_LABEL_ENCODER_PATH):
        print(f"ERROR: model is XGBoost but {XGB_LABEL_ENCODER_PATH} is missing "
              f"(run train_priority_model.py first to regenerate it).")
        sys.exit(1)
    xgb_label_encoder = joblib.load(XGB_LABEL_ENCODER_PATH)
    print(f"Loaded xgb_label_encoder, classes: {list(xgb_label_encoder.classes_)}")

df = pd.read_csv(DATASET_PATH)
print(f"Loaded leakage-free dataset: {df.shape}")

feature_cols = [c for c in df.columns if c != "Priority_Label"]
# Sanity check
if hasattr(model, "feature_names_in_"):
    assert list(model.feature_names_in_) == feature_cols, (
        "Feature mismatch between the saved model and the leakage-free dataset columns - "
        "re-run train_priority_model.py to regenerate consistent artifacts."
    )
print(f"Feature columns ({len(feature_cols)}): {feature_cols}")

X = df[feature_cols]
y = df["Priority_Label"]

# Re-derive the IDENTICAL 80/20 stratified split used during training
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=RANDOM_STATE
)
print(f"Re-derived test set (unscaled, matching XGBoost's training input): {X_test.shape}")


# 2.
section("2. COMPUTE SHAP VALUES ON THE TEST SET")

import shap  # imported after the file-existence checks so a missing dependency fails fast with a clear message above

explainer = shap.TreeExplainer(model)
print("Computing SHAP values for the full test set (this may take a moment)...")
shap_values = explainer(X_test)
print(f"SHAP values shape: {shap_values.values.shape}  (rows, features, classes)")

# shap_values.values is (n_rows, n_features, n_classes) for multiclass XGBoost.
if xgb_label_encoder is not None:
    class_names_by_index = list(xgb_label_encoder.classes_)
else:
    class_names_by_index = list(model.classes_)
high_idx = class_names_by_index.index("High")
print(f"SHAP class axis order: {class_names_by_index} (High priority is index {high_idx})")


# 3.
section("3. SAVE GLOBAL SHAP PLOTS")

# --- shap_summary_plot.png: beeswarm for the High priority class ---
plt.figure(figsize=(10, 7))
shap.summary_plot(
    shap_values[:, :, high_idx].values,
    X_test,
    feature_names=feature_cols,
    show=False,
)
plt.title("SHAP Summary (Beeswarm) - Feature Impact on 'High' Priority Prediction", fontsize=13)
plt.tight_layout()
plt.savefig(os.path.join(OUTPUTS_DIR, "shap_summary_plot.png"), dpi=300, bbox_inches="tight")
plt.close()
print("Saved shap_summary_plot.png (High priority class beeswarm).")

# --- shap_bar_plot.png: mean |SHAP| ranking, averaged across all classes ---
mean_abs_shap_per_class = np.abs(shap_values.values).mean(axis=0)  # (n_features, n_classes)
mean_abs_shap_overall = mean_abs_shap_per_class.mean(axis=1)       # (n_features,) averaged over classes
importance_order = np.argsort(mean_abs_shap_overall)

plt.figure(figsize=(10, 7))
plt.barh(
    [feature_cols[i] for i in importance_order],
    mean_abs_shap_overall[importance_order],
    color="steelblue",
)
plt.title("Mean |SHAP Value| by Feature (averaged across High/Medium/Low)", fontsize=13)
plt.xlabel("Mean |SHAP value| (impact on model output)", fontsize=11)
plt.tight_layout()
plt.savefig(os.path.join(OUTPUTS_DIR, "shap_bar_plot.png"), dpi=300, bbox_inches="tight")
plt.close()
print("Saved shap_bar_plot.png (overall feature importance ranking).")


# 4.
section("4. PER-ROW EXPLANATION HELPER")


def explain_single_prediction(row_features):
    """Explain one prediction."""
    if isinstance(row_features, pd.Series):
        row_df = row_features.to_frame().T[feature_cols]
    else:
        row_df = row_features[feature_cols]

    pred_num = model.predict(row_df)[0]
    predicted_label = (
        xgb_label_encoder.inverse_transform([pred_num])[0]
        if xgb_label_encoder is not None
        else pred_num
    )
    class_idx = class_names_by_index.index(predicted_label)

    row_shap = explainer(row_df)
    contributions = {
        feature_cols[i]: float(row_shap.values[0, i, class_idx])
        for i in range(len(feature_cols))
    }
    return predicted_label, contributions


def sentence_from_contributions(predicted_label, contributions, top_n=2):
    """Builds a plain-English sentence from the top contributing features."""
    ranked = sorted(contributions.items(), key=lambda kv: abs(kv[1]), reverse=True)[:top_n]
    parts = []
    for feature, value in ranked:
        sign = "+" if value >= 0 else ""
        parts.append(f"{feature} ({sign}{value:.2f} contribution)")
    joined = " and ".join(parts)
    return f"Task flagged {predicted_label} priority mainly because of {joined}."


# --- Demonstrate on 3 sample rows from the test set ---
section("5. DEMONSTRATE ON 3 SAMPLE TEST ROWS")

sample_rows = X_test.sample(n=3, random_state=RANDOM_STATE)
sample_explanations = []
for i, (idx, row) in enumerate(sample_rows.iterrows(), start=1):
    predicted_label, contributions = explain_single_prediction(row)
    sentence = sentence_from_contributions(predicted_label, contributions)
    true_label = y_test.loc[idx]
    print(f"\nSample {i} (test row index {idx}):")
    print(f"  True label: {true_label} | Predicted label: {predicted_label}")
    print(f"  {sentence}")
    sample_explanations.append({
        "test_row_index": int(idx),
        "true_label": true_label,
        "predicted_label": predicted_label,
        "feature_values": {k: float(v) for k, v in row.to_dict().items()},
        "shap_contributions": contributions,
        "explanation_sentence": sentence,
    })

with open(os.path.join(OUTPUTS_DIR, "sample_shap_explanations.json"), "w") as f:
    json.dump(sample_explanations, f, indent=2)
print(f"\nSaved sample_shap_explanations.json with {len(sample_explanations)} example explanations.")


# 6.
section("6. SUMMARY")
top_feature = feature_cols[importance_order[-1]]
print(f"""
Summary:
- Computed SHAP values (TreeExplainer) for the {len(X_test)}-row held-out test set.
- Globally, '{top_feature}' has the highest mean |SHAP| impact on Priority_Label predictions.
- Saved global plots: shap_summary_plot.png (High-class beeswarm), shap_bar_plot.png (overall ranking).
- Saved 3 worked per-row explanations (feature contributions + plain-English sentence) to
  sample_shap_explanations.json - this mirrors what explain_single_prediction() returns and is the
  function the backend API can call at inference time to show students why a task was prioritized.
- All outputs saved to: {OUTPUTS_DIR}
""")
print("Done.")
