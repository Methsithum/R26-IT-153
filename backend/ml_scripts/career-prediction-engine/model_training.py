# =============================================================================
# FILE: model_training.py
# PROJECT: Integrated Future & Career Prediction Engine
# DESCRIPTION: Trains, evaluates, compares, and saves two predictive models:
#   Model A — Academic Risk Classification  (Random Forest vs XGBoost)
#   Model B — Career Readiness Regression   (Random Forest vs XGBoost)
#
# PREREQUISITES: Run dataset_preprocessing.py first to generate saved_objects/.
# USAGE:         python model_training.py   (from ml_scripts/career-prediction-engine/)
# =============================================================================

import os
import sys
import warnings
import joblib
import numpy as np
import pandas as pd

# Use non-interactive backend so plots are written to files, not displayed.
# This makes the script safe to run in terminal / CI environments.
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns

from pathlib import Path
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import (
    accuracy_score, f1_score, classification_report,
    confusion_matrix, mean_absolute_error, mean_squared_error, r2_score
)
from sklearn.model_selection import StratifiedKFold, KFold, cross_val_score
from xgboost import XGBClassifier, XGBRegressor

warnings.filterwarnings('ignore')


# =============================================================================
# PATH SETUP & VALIDATION
# =============================================================================

# __file__ gives the absolute path of this script regardless of the working
# directory, so paths stay correct even if the user runs the script from a
# different folder.
BASE_DIR  = Path(__file__).resolve().parent          # ml_scripts/career-prediction-engine/
SAVED_DIR = (BASE_DIR / '..' / '..' / 'trained-models'
             / 'career-prediction-engine' / 'saved_objects').resolve()
PLOTS_DIR = (BASE_DIR / '..' / '..' / 'trained-models'
             / 'career-prediction-engine' / 'plots').resolve()

if not SAVED_DIR.exists():
    print("\n" + "=" * 65)
    print("  ERROR: saved_objects/ folder not found.")
    print("=" * 65)
    print(f"  Expected location : {SAVED_DIR}")
    print("\n  Please run dataset_preprocessing.py first to generate")
    print("  the preprocessed data files (.pkl), then re-run this script.")
    print("=" * 65)
    sys.exit(1)

# Create the plots directory if it does not yet exist.
PLOTS_DIR.mkdir(parents=True, exist_ok=True)


# =============================================================================
# SECTION 1 — LOAD DATA
# =============================================================================

print("=" * 65)
print("  STEP 1: LOADING PREPROCESSED DATA FROM saved_objects/")
print("=" * 65)

# All objects were serialised by dataset_preprocessing.py using joblib.
# We load them directly — no re-splitting, re-scaling, or re-balancing.
scaler          = joblib.load(SAVED_DIR / 'scaler.pkl')
feature_columns = joblib.load(SAVED_DIR / 'feature_columns.pkl')

# risk_train contains the SMOTE-balanced training set for classification.
X_train_r, y_train_r = joblib.load(SAVED_DIR / 'risk_train.pkl')
X_test_r,  y_test_r  = joblib.load(SAVED_DIR / 'risk_test.pkl')

# career_train/test contain the scaled regression splits.
X_train_c, y_train_c = joblib.load(SAVED_DIR / 'career_train.pkl')
X_test_c,  y_test_c  = joblib.load(SAVED_DIR / 'career_test.pkl')

# Human-readable label map used for classification reports and plots.
RISK_LABEL_MAP = {0: 'Low', 1: 'Medium', 2: 'High'}
RISK_LABELS    = [RISK_LABEL_MAP[i] for i in sorted(RISK_LABEL_MAP)]

print(f"  Risk   — train: {X_train_r.shape}  | test: {X_test_r.shape}")
print(f"  Career — train: {X_train_c.shape} | test: {X_test_c.shape}")
print(f"  Features loaded: {len(feature_columns)}")
print(f"  All .pkl files loaded from: {SAVED_DIR}")


# =============================================================================
# SECTION 2 — TRAIN MODEL A  (Academic Risk Classification)
# =============================================================================

print("\n" + "=" * 65)
print("  STEP 2: TRAINING MODEL A — ACADEMIC RISK CLASSIFICATION")
print("=" * 65)

# ── Random Forest Classifier ─────────────────────────────────────────────────
# class_weight='balanced' adds a second layer of imbalance protection on top of
# the SMOTE already applied during preprocessing. This guards against any
# residual imbalance in the SMOTE-balanced splits.
# n_estimators=300 gives stable, low-variance predictions on a 10k-row dataset.
# max_depth=15 prevents trees from growing too deep and memorising noise.
# min_samples_split/leaf add regularisation by requiring meaningful support
# before any further split or leaf creation.
print("  Training Random Forest Classifier...")
rf_risk = RandomForestClassifier(
    n_estimators     = 300,
    max_depth        = 15,
    min_samples_split= 10,
    min_samples_leaf = 4,
    max_features     = 'sqrt',      # standard heuristic for classification
    class_weight     = 'balanced',
    random_state     = 42,
    n_jobs           = -1           # use all CPU cores
)
rf_risk.fit(X_train_r, y_train_r)
print("  Random Forest (Risk) — done.")

# ── XGBoost Classifier ───────────────────────────────────────────────────────
# subsample + colsample_bytree introduce stochasticity that reduces overfitting
# while maintaining strong predictive power.
# gamma (min_child_weight) and reg_alpha/lambda (L1/L2) further regularise the
# model, which is important for a research dataset of moderate size.
# A lower learning_rate (0.05) with more estimators typically generalises
# better than a high rate with fewer trees.
print("  Training XGBoost Classifier...")
xgb_risk = XGBClassifier(
    n_estimators     = 300,
    max_depth        = 6,
    learning_rate    = 0.05,
    subsample        = 0.8,
    colsample_bytree = 0.8,
    gamma            = 1,
    reg_alpha        = 0.1,
    reg_lambda       = 1.0,
    objective        = 'multi:softmax',
    num_class        = 3,
    eval_metric      = 'mlogloss',
    random_state     = 42,
    verbosity        = 0,
    n_jobs           = -1
)
xgb_risk.fit(X_train_r, y_train_r)
print("  XGBoost (Risk) — done.")


# =============================================================================
# SECTION 3 — EVALUATE MODEL A
# =============================================================================

print("\n" + "=" * 65)
print("  STEP 3: EVALUATING MODEL A — ACADEMIC RISK CLASSIFICATION")
print("=" * 65)


def evaluate_classifier(model, X_test, y_test, model_name,
                         cv_X, cv_y, label_names, n_splits=5):
    """
    Evaluate a trained classifier on the held-out test set and via cross-validation.

    Args:
        model       : Fitted sklearn-compatible classifier.
        X_test      : Scaled test features.
        y_test      : True integer labels for the test set.
        model_name  : Display name used in printed output.
        cv_X / cv_y : Training data used for cross-validation.
        label_names : Ordered list of class name strings.
        n_splits    : Number of stratified CV folds.

    Returns:
        dict with model, name, y_pred, accuracy, f1, cv_mean, cv_std.

    Note on CV data: cv_X comes from the SMOTE-balanced training set. This means
    synthetic samples may appear in both train and validation folds, which can
    give slightly optimistic CV estimates. The held-out test set (no SMOTE) is
    the definitive evaluation benchmark.
    """
    y_pred = model.predict(X_test)

    acc = accuracy_score(y_test, y_pred)
    # Weighted F1 accounts for class-frequency differences in the test set,
    # making it a more informative single metric than macro F1 here.
    f1  = f1_score(y_test, y_pred, average='weighted')

    # Stratified folds preserve the class ratio in every fold, which is
    # essential for a 3-class problem where fold composition matters.
    skf    = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
    cv_acc = cross_val_score(model, cv_X, cv_y, cv=skf, scoring='accuracy', n_jobs=-1)

    report = classification_report(y_test, y_pred, target_names=label_names)

    print(f"\n  {'─' * 42}")
    print(f"  {model_name}")
    print(f"  {'─' * 42}")
    print(f"  Test Accuracy        : {acc:.4f}")
    print(f"  Weighted F1 Score    : {f1:.4f}")
    print(f"  CV Accuracy (5-fold) : {cv_acc.mean():.4f} ± {cv_acc.std():.4f}")
    print(f"\n  Classification Report:\n")
    for line in report.splitlines():
        print(f"    {line}")

    return {
        'model'   : model,
        'name'    : model_name,
        'y_pred'  : y_pred,
        'accuracy': acc,
        'f1'      : f1,
        'cv_mean' : cv_acc.mean(),
        'cv_std'  : cv_acc.std()
    }


rf_risk_results  = evaluate_classifier(
    rf_risk,  X_test_r, y_test_r, 'Random Forest', X_train_r, y_train_r, RISK_LABELS
)
xgb_risk_results = evaluate_classifier(
    xgb_risk, X_test_r, y_test_r, 'XGBoost',       X_train_r, y_train_r, RISK_LABELS
)

# Select winner by weighted F1: more robust than accuracy alone because it
# rewards correct predictions across all three risk classes proportionally.
best_risk_result = max([rf_risk_results, xgb_risk_results], key=lambda r: r['f1'])
best_risk_model  = best_risk_result['model']
best_risk_slug   = best_risk_result['name'].lower().replace(' ', '_')

print(f"\n  >> Best Model A: {best_risk_result['name']}"
      f" (Weighted F1 = {best_risk_result['f1']:.4f})")

# ── Confusion Matrix ──────────────────────────────────────────────────────────
def plot_confusion_matrix(y_true, y_pred, label_names, title, save_path):
    """
    Plot and save a confusion matrix heatmap.

    The confusion matrix shows per-class prediction patterns. Off-diagonal
    values reveal which risk classes are most frequently confused, helping
    identify where the model needs improvement.
    """
    cm = confusion_matrix(y_true, y_pred)

    plt.figure(figsize=(7, 5))
    sns.heatmap(
        cm, annot=True, fmt='d', cmap='Blues',
        xticklabels=label_names, yticklabels=label_names,
        linewidths=0.5
    )
    plt.title(title, fontsize=13)
    plt.ylabel('True Label')
    plt.xlabel('Predicted Label')
    plt.tight_layout()
    plt.savefig(save_path, dpi=150)
    plt.close()
    print(f"  Saved: {save_path}")


plot_confusion_matrix(
    y_test_r,
    best_risk_result['y_pred'],
    RISK_LABELS,
    f"Confusion Matrix — Academic Risk ({best_risk_result['name']})",
    PLOTS_DIR / 'confusion_matrix_risk.png'
)


# =============================================================================
# SECTION 4 — TRAIN MODEL B  (Career Readiness Regression)
# =============================================================================

print("\n" + "=" * 65)
print("  STEP 4: TRAINING MODEL B — CAREER READINESS REGRESSION")
print("=" * 65)

# ── Random Forest Regressor ───────────────────────────────────────────────────
# min_samples_leaf=5 smooths predictions on the continuous career_readiness_score
# target, reducing variance without significantly increasing bias.
print("  Training Random Forest Regressor...")
rf_career = RandomForestRegressor(
    n_estimators     = 300,
    max_depth        = 15,
    min_samples_split= 10,
    min_samples_leaf = 5,
    max_features     = 'sqrt',
    random_state     = 42,
    n_jobs           = -1
)
rf_career.fit(X_train_c, y_train_c)
print("  Random Forest (Career) — done.")

# ── XGBoost Regressor ─────────────────────────────────────────────────────────
# reg:squarederror is the standard MSE objective for regression.
# The same regularisation strategy as Model A is applied: low learning_rate
# with many estimators, L1+L2 penalties, and column/row subsampling.
print("  Training XGBoost Regressor...")
xgb_career = XGBRegressor(
    n_estimators     = 300,
    max_depth        = 6,
    learning_rate    = 0.05,
    subsample        = 0.8,
    colsample_bytree = 0.8,
    gamma            = 1,
    reg_alpha        = 0.1,
    reg_lambda       = 1.0,
    objective        = 'reg:squarederror',
    eval_metric      = 'rmse',
    random_state     = 42,
    verbosity        = 0,
    n_jobs           = -1
)
xgb_career.fit(X_train_c, y_train_c)
print("  XGBoost (Career) — done.")


# =============================================================================
# SECTION 5 — EVALUATE MODEL B
# =============================================================================

print("\n" + "=" * 65)
print("  STEP 5: EVALUATING MODEL B — CAREER READINESS REGRESSION")
print("=" * 65)


def evaluate_regressor(model, X_test, y_test, model_name, cv_X, cv_y, n_splits=5):
    """
    Evaluate a trained regressor on the held-out test set and via cross-validation.

    Args:
        model       : Fitted sklearn-compatible regressor.
        X_test      : Scaled test features.
        y_test      : True continuous target values.
        model_name  : Display name used in printed output.
        cv_X / cv_y : Training data for cross-validation.
        n_splits    : Number of KFold CV folds.

    Returns:
        dict with model, name, y_pred, mae, rmse, r2, cv_mean, cv_std.

    Metrics used:
        MAE  — average absolute error; interpretable in the same units as the score.
        RMSE — penalises large errors more than MAE; useful for detecting outlier predictions.
        R²   — proportion of variance explained; scale-independent and intuitive.
    """
    y_pred = model.predict(X_test)
    y_true = np.asarray(y_test)

    mae  = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    r2   = r2_score(y_true, y_pred)

    # Standard KFold (not stratified) is appropriate for regression.
    kf    = KFold(n_splits=n_splits, shuffle=True, random_state=42)
    cv_r2 = cross_val_score(model, cv_X, cv_y, cv=kf, scoring='r2', n_jobs=-1)

    print(f"\n  {'─' * 42}")
    print(f"  {model_name}")
    print(f"  {'─' * 42}")
    print(f"  MAE            : {mae:.4f}")
    print(f"  RMSE           : {rmse:.4f}")
    print(f"  R² Score       : {r2:.4f}")
    print(f"  CV R² (5-fold) : {cv_r2.mean():.4f} ± {cv_r2.std():.4f}")

    return {
        'model'  : model,
        'name'   : model_name,
        'y_pred' : y_pred,
        'mae'    : mae,
        'rmse'   : rmse,
        'r2'     : r2,
        'cv_mean': cv_r2.mean(),
        'cv_std' : cv_r2.std()
    }


rf_career_results  = evaluate_regressor(
    rf_career,  X_test_c, y_test_c, 'Random Forest', X_train_c, y_train_c
)
xgb_career_results = evaluate_regressor(
    xgb_career, X_test_c, y_test_c, 'XGBoost',       X_train_c, y_train_c
)

# Select winner by R²: higher means the model explains more variance in the
# career readiness score. R² is preferred over RMSE here because it is
# scale-independent and directly comparable across datasets.
best_career_result = max([rf_career_results, xgb_career_results], key=lambda r: r['r2'])
best_career_model  = best_career_result['model']
best_career_slug   = best_career_result['name'].lower().replace(' ', '_')

print(f"\n  >> Best Model B: {best_career_result['name']}"
      f" (R² = {best_career_result['r2']:.4f})")

# ── Actual vs Predicted Scatter Plot ─────────────────────────────────────────
def plot_actual_vs_predicted(y_true, y_pred, model_name, save_path):
    """
    Scatter plot of true vs predicted values for a regression model.

    Points clustered tightly along the red diagonal (perfect-fit line) indicate
    a well-calibrated model. Systematic deviation from the diagonal (e.g., a
    curved band) signals non-linearity that the model has not captured.
    """
    y_true = np.asarray(y_true)
    y_pred = np.asarray(y_pred)
    min_val = min(y_true.min(), y_pred.min()) - 1
    max_val = max(y_true.max(), y_pred.max()) + 1

    plt.figure(figsize=(7, 6))
    plt.scatter(y_true, y_pred, alpha=0.35, s=12, color='steelblue', label='Predictions')
    plt.plot([min_val, max_val], [min_val, max_val], 'r--', lw=1.5, label='Perfect fit')
    plt.xlim(min_val, max_val)
    plt.ylim(min_val, max_val)
    plt.xlabel('Actual Career Readiness Score')
    plt.ylabel('Predicted Career Readiness Score')
    plt.title(f'Actual vs Predicted — Career Readiness ({model_name})', fontsize=13)
    plt.legend()
    plt.tight_layout()
    plt.savefig(save_path, dpi=150)
    plt.close()
    print(f"  Saved: {save_path}")


plot_actual_vs_predicted(
    y_test_c,
    best_career_result['y_pred'],
    best_career_result['name'],
    PLOTS_DIR / 'actual_vs_predicted_career.png'
)


# =============================================================================
# SECTION 6 — FEATURE IMPORTANCE COMPARISON
# =============================================================================

print("\n" + "=" * 65)
print("  STEP 6: FEATURE IMPORTANCE COMPARISON PLOT")
print("=" * 65)


def plot_feature_importance_comparison(model_a, model_b, feature_names, save_path, top_n=15):
    """
    Side-by-side horizontal bar chart comparing feature importances from the
    two best models (one classifier, one regressor).

    Features are ranked by their average importance across both models so that
    features critical to either task appear at the top. This view helps identify
    which student attributes are universally predictive vs task-specific.

    Args:
        model_a      : Best classification model (risk).
        model_b      : Best regression model (career).
        feature_names: List of feature column names (same order as training data).
        save_path    : File path to save the PNG.
        top_n        : Number of top features to display.
    """
    imp_a = pd.Series(model_a.feature_importances_, index=feature_names, name='Risk Model (A)')
    imp_b = pd.Series(model_b.feature_importances_, index=feature_names, name='Career Model (B)')

    # Rank features by average importance across both tasks.
    avg_imp      = (imp_a + imp_b) / 2
    top_features = avg_imp.nlargest(top_n).index

    df_imp = pd.DataFrame({
        'Risk Model (A)': imp_a[top_features],
        'Career Model (B)': imp_b[top_features]
    }).sort_values('Risk Model (A)', ascending=True)

    fig, ax = plt.subplots(figsize=(10, 8))
    df_imp.plot(kind='barh', ax=ax, color=['#2196F3', '#4CAF50'], alpha=0.85, width=0.7)
    ax.set_title(f'Top {top_n} Feature Importances — Risk vs Career Model', fontsize=13)
    ax.set_xlabel('Feature Importance Score')
    ax.set_ylabel('Feature')
    ax.legend(loc='lower right')
    ax.grid(axis='x', linestyle='--', alpha=0.4)
    plt.tight_layout()
    plt.savefig(save_path, dpi=150)
    plt.close()
    print(f"  Saved: {save_path}")


plot_feature_importance_comparison(
    best_risk_model,
    best_career_model,
    feature_columns,
    PLOTS_DIR / 'feature_importance_comparison.png'
)


# =============================================================================
# SECTION 7 — MODEL COMPARISON BAR CHART
# =============================================================================

print("\n" + "=" * 65)
print("  STEP 7: ALGORITHM COMPARISON BAR CHART (RF vs XGBoost)")
print("=" * 65)


def plot_model_comparison(risk_rf, risk_xgb, career_rf, career_xgb, save_path):
    """
    Grouped bar chart comparing Random Forest and XGBoost across both tasks.

    Metric used per task:
        Model A (classification) — Weighted F1 score (0–1 scale)
        Model B (regression)     — R² score         (0–1 scale)
    Both metrics are on the same 0–1 scale, so placing them side by side in a
    single chart gives an intuitive visual comparison without misleading the reader.
    """
    algorithms  = ['Random Forest', 'XGBoost']
    risk_scores   = [risk_rf['f1'],     risk_xgb['f1']]
    career_scores = [career_rf['r2'],   career_xgb['r2']]

    x     = np.arange(len(algorithms))
    width = 0.35

    fig, ax = plt.subplots(figsize=(8, 5))
    bars1 = ax.bar(x - width / 2, risk_scores,   width,
                   label='Model A — Academic Risk (Weighted F1)',   color='#2196F3', alpha=0.85)
    bars2 = ax.bar(x + width / 2, career_scores, width,
                   label='Model B — Career Readiness (R² Score)', color='#4CAF50', alpha=0.85)

    # Annotate each bar with its numeric value for quick reading.
    for bar in list(bars1) + list(bars2):
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height() + 0.008,
            f'{bar.get_height():.3f}',
            ha='center', va='bottom', fontsize=9, fontweight='bold'
        )

    ax.set_xticks(x)
    ax.set_xticklabels(algorithms, fontsize=11)
    ax.set_ylim(0, 1.15)
    ax.set_ylabel('Score (higher is better)')
    ax.set_title('Algorithm Comparison — Random Forest vs XGBoost', fontsize=13)
    ax.legend(fontsize=9)
    ax.grid(axis='y', linestyle='--', alpha=0.4)
    plt.tight_layout()
    plt.savefig(save_path, dpi=150)
    plt.close()
    print(f"  Saved: {save_path}")


plot_model_comparison(
    rf_risk_results, xgb_risk_results,
    rf_career_results, xgb_career_results,
    PLOTS_DIR / 'model_comparison_bar_chart.png'
)


# =============================================================================
# SECTION 8 — SAVE BEST MODELS & METADATA
# =============================================================================

print("\n" + "=" * 65)
print("  STEP 8: SAVING MODELS & METADATA")
print("=" * 65)

# Filenames embed the winning algorithm so saved files are self-documenting.
risk_filename   = f'model_A_risk_{best_risk_slug}.pkl'
career_filename = f'model_B_career_{best_career_slug}.pkl'

joblib.dump(best_risk_model,   SAVED_DIR / risk_filename)
print(f"  Saved: {risk_filename}")

joblib.dump(best_career_model, SAVED_DIR / career_filename)
print(f"  Saved: {career_filename}")

# model_metadata.pkl is the single source of truth for the inference layer.
# It contains everything the API/simulation script needs to load the right
# model files, reconstruct predictions, and report metrics — without having
# to hard-code algorithm names or paths elsewhere.
metadata = {
    # Model A
    'model_A_filename'   : risk_filename,
    'model_A_algorithm'  : best_risk_result['name'],
    'model_A_accuracy'   : round(best_risk_result['accuracy'], 6),
    'model_A_f1'         : round(best_risk_result['f1'],       6),
    'model_A_cv_accuracy': round(best_risk_result['cv_mean'],  6),
    # Model B
    'model_B_filename'   : career_filename,
    'model_B_algorithm'  : best_career_result['name'],
    'model_B_mae'        : round(best_career_result['mae'],     6),
    'model_B_rmse'       : round(best_career_result['rmse'],    6),
    'model_B_r2'         : round(best_career_result['r2'],      6),
    'model_B_cv_r2'      : round(best_career_result['cv_mean'], 6),
    # Shared
    'feature_columns'    : feature_columns,
    'risk_label_map'     : RISK_LABEL_MAP,
    'scaler_filename'    : 'scaler.pkl',
}
joblib.dump(metadata, SAVED_DIR / 'model_metadata.pkl')
print(f"  Saved: model_metadata.pkl")
print(f"\n  All models saved to: {SAVED_DIR}")


# =============================================================================
# SUMMARY
# =============================================================================

print("\n" + "=" * 65)
print("  TRAINING COMPLETE — FINAL SUMMARY")
print("=" * 65)

print(f"""
  MODEL A — Academic Risk Classification
  {'─' * 52}
  Algorithms compared  : Random Forest  |  XGBoost
  RF  — Accuracy: {rf_risk_results['accuracy']:.4f}   F1: {rf_risk_results['f1']:.4f}
  XGB — Accuracy: {xgb_risk_results['accuracy']:.4f}   F1: {xgb_risk_results['f1']:.4f}
  Winner               : {best_risk_result['name']}
  Final Accuracy        : {best_risk_result['accuracy']:.4f}
  Final Weighted F1     : {best_risk_result['f1']:.4f}
  5-Fold CV Accuracy    : {best_risk_result['cv_mean']:.4f} ± {best_risk_result['cv_std']:.4f}

  MODEL B — Career Readiness Regression
  {'─' * 52}
  Algorithms compared  : Random Forest  |  XGBoost
  RF  — MAE: {rf_career_results['mae']:.4f}   RMSE: {rf_career_results['rmse']:.4f}   R²: {rf_career_results['r2']:.4f}
  XGB — MAE: {xgb_career_results['mae']:.4f}   RMSE: {xgb_career_results['rmse']:.4f}   R²: {xgb_career_results['r2']:.4f}
  Winner               : {best_career_result['name']}
  Final MAE             : {best_career_result['mae']:.4f}
  Final RMSE            : {best_career_result['rmse']:.4f}
  Final R² Score        : {best_career_result['r2']:.4f}
  5-Fold CV R²          : {best_career_result['cv_mean']:.4f} ± {best_career_result['cv_std']:.4f}

  SAVED FILES
  {'─' * 52}
  Models & metadata  → {SAVED_DIR}
    {risk_filename}
    {career_filename}
    model_metadata.pkl

  Plots              → {PLOTS_DIR}
    confusion_matrix_risk.png
    actual_vs_predicted_career.png
    feature_importance_comparison.png
    model_comparison_bar_chart.png
""")

print("=" * 65)
print("  Ready for simulation / inference pipeline.")
print("=" * 65)
