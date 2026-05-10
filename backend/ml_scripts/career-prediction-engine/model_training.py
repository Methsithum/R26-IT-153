"""
Model training pipeline for the Integrated Future & Career Prediction Engine.

Trains and evaluates three algorithms per task:
  Model A — Academic Risk Classification  (Logistic Regression | RF | XGBoost)
  Model B — Career Readiness Regression   (Ridge | RF | XGBoost)
Saves all six models plus a metadata pickle to trained-models/saved_objects/.

EXECUTION ORDER: 1. dataset_preprocessing.py  2. model_training.py  3. test_inference.py
USAGE: python model_training.py   (from ml_scripts/career-prediction-engine/)
"""

import sys
import warnings
import joblib
import numpy as np
import pandas as pd

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns

from pathlib import Path
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LogisticRegression, Ridge
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

BASE_DIR  = Path(__file__).resolve().parent
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

PLOTS_DIR.mkdir(parents=True, exist_ok=True)

# Fixed filenames for all 6 saved models — inference layer uses these directly.
RISK_FILENAMES = {
    'Logistic Regression': 'model_A_risk_logistic_regression.pkl',
    'Random Forest'      : 'model_A_risk_random_forest.pkl',
    'XGBoost'            : 'model_A_risk_xgboost.pkl',
}
CAREER_FILENAMES = {
    'Ridge Regression': 'model_B_career_ridge.pkl',
    'Random Forest'   : 'model_B_career_random_forest.pkl',
    'XGBoost'         : 'model_B_career_xgboost.pkl',
}


# =============================================================================
# SECTION 1 — LOAD DATA
# =============================================================================

print("=" * 65)
print("  STEP 1: LOADING PREPROCESSED DATA FROM saved_objects/")
print("=" * 65)

scaler          = joblib.load(SAVED_DIR / 'scaler.pkl')
feature_columns = joblib.load(SAVED_DIR / 'feature_columns.pkl')

X_train_r, y_train_r = joblib.load(SAVED_DIR / 'risk_train.pkl')
X_test_r,  y_test_r  = joblib.load(SAVED_DIR / 'risk_test.pkl')

X_train_c, y_train_c = joblib.load(SAVED_DIR / 'career_train.pkl')
X_test_c,  y_test_c  = joblib.load(SAVED_DIR / 'career_test.pkl')

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

# ── Logistic Regression (linear baseline) ────────────────────────────────────
# Training LR first gives a lower-bound reference point. If RF/XGB only
# marginally outperform LR, the added complexity is not justified.
print("  Training Logistic Regression (baseline)...")
lr_risk = LogisticRegression(
    C            = 0.5,
    max_iter     = 1000,
    class_weight = 'balanced',
    solver       = 'lbfgs',
    random_state = 42
)
lr_risk.fit(X_train_r, y_train_r)
print("  Logistic Regression (Risk) — done.")

# ── Random Forest Classifier ─────────────────────────────────────────────────
# Reduced vs previous version (n_estimators 300→100, max_depth 15→8,
# min_samples 10/4→20/10) to prevent memorising the SMOTE-augmented set.
print("  Training Random Forest Classifier...")
rf_risk = RandomForestClassifier(
    n_estimators      = 100,
    max_depth         = 8,
    min_samples_split = 20,
    min_samples_leaf  = 10,
    max_features      = 'sqrt',
    class_weight      = 'balanced',
    random_state      = 42
)
rf_risk.fit(X_train_r, y_train_r)
print("  Random Forest (Risk) — done.")

# ── XGBoost Classifier ───────────────────────────────────────────────────────
print("  Training XGBoost Classifier...")
xgb_risk = XGBClassifier(
    n_estimators     = 100,
    max_depth        = 4,
    learning_rate    = 0.05,
    subsample        = 0.7,
    colsample_bytree = 0.7,
    reg_alpha        = 0.1,
    reg_lambda       = 1.5,
    min_child_weight = 5,
    eval_metric      = 'mlogloss',
    random_state     = 42,
    verbosity        = 0
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
    Evaluate a classifier on the held-out test set and via cross-validation.

    Returns dict with model, name, y_pred, accuracy, f1, cv_mean, cv_std.
    """
    y_pred = model.predict(X_test)
    acc    = accuracy_score(y_test, y_pred)
    f1     = f1_score(y_test, y_pred, average='weighted')

    skf    = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
    cv_acc = cross_val_score(model, cv_X, cv_y, cv=skf, scoring='accuracy', n_jobs=-1)
    report = classification_report(y_test, y_pred, target_names=label_names)

    print(f"\n  {'─' * 42}")
    print(f"  {model_name}")
    print(f"  {'─' * 42}")
    print(f"  Test Accuracy        : {acc:.4f}")
    print(f"  Weighted F1 Score    : {f1:.4f}")
    print(f"  CV Accuracy (5-fold) : {cv_acc.mean():.4f} ± {cv_acc.std():.4f}")
    print("\n  Classification Report:\n")
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


lr_risk_results  = evaluate_classifier(
    lr_risk,  X_test_r, y_test_r, 'Logistic Regression', X_train_r, y_train_r, RISK_LABELS
)
rf_risk_results  = evaluate_classifier(
    rf_risk,  X_test_r, y_test_r, 'Random Forest',       X_train_r, y_train_r, RISK_LABELS
)
xgb_risk_results = evaluate_classifier(
    xgb_risk, X_test_r, y_test_r, 'XGBoost',             X_train_r, y_train_r, RISK_LABELS
)

best_risk_result = max(
    [lr_risk_results, rf_risk_results, xgb_risk_results], key=lambda r: r['f1']
)
print(f"\n  >> Best Model A: {best_risk_result['name']}"
      f" (Weighted F1 = {best_risk_result['f1']:.4f})")


# ── Confusion Matrix ──────────────────────────────────────────────────────────
def plot_confusion_matrix(y_true, y_pred, label_names, title, save_path):
    cm = confusion_matrix(y_true, y_pred)
    plt.figure(figsize=(7, 5))
    sns.heatmap(
        cm, annot=True, fmt='d', cmap='Blues',
        xticklabels=label_names, yticklabels=label_names, linewidths=0.5
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

# ── Ridge Regression (linear baseline) ───────────────────────────────────────
print("  Training Ridge Regression (baseline)...")
ridge_career = Ridge(alpha=1.0)
ridge_career.fit(X_train_c, y_train_c)
print("  Ridge (Career) — done.")

# ── Random Forest Regressor ───────────────────────────────────────────────────
print("  Training Random Forest Regressor...")
rf_career = RandomForestRegressor(
    n_estimators      = 100,
    max_depth         = 8,
    min_samples_split = 20,
    min_samples_leaf  = 10,
    max_features      = 'sqrt',
    random_state      = 42
)
rf_career.fit(X_train_c, y_train_c)
print("  Random Forest (Career) — done.")

# ── XGBoost Regressor ─────────────────────────────────────────────────────────
print("  Training XGBoost Regressor...")
xgb_career = XGBRegressor(
    n_estimators     = 100,
    max_depth        = 4,
    learning_rate    = 0.05,
    subsample        = 0.7,
    colsample_bytree = 0.7,
    reg_alpha        = 0.1,
    reg_lambda       = 1.5,
    min_child_weight = 5,
    random_state     = 42,
    verbosity        = 0
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
    Evaluate a regressor on the held-out test set and via cross-validation.

    Returns dict with model, name, y_pred, mae, rmse, r2, cv_mean, cv_std.
    """
    y_pred = model.predict(X_test)
    y_true = np.asarray(y_test)

    mae  = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    r2   = r2_score(y_true, y_pred)

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


ridge_career_results = evaluate_regressor(
    ridge_career, X_test_c, y_test_c, 'Ridge Regression', X_train_c, y_train_c
)
rf_career_results    = evaluate_regressor(
    rf_career,    X_test_c, y_test_c, 'Random Forest',    X_train_c, y_train_c
)
xgb_career_results   = evaluate_regressor(
    xgb_career,   X_test_c, y_test_c, 'XGBoost',          X_train_c, y_train_c
)

best_career_result = max(
    [ridge_career_results, rf_career_results, xgb_career_results], key=lambda r: r['r2']
)
print(f"\n  >> Best Model B: {best_career_result['name']}"
      f" (R² = {best_career_result['r2']:.4f})")


# ── Actual vs Predicted Scatter Plot ─────────────────────────────────────────
def plot_actual_vs_predicted(y_true, y_pred, model_name, save_path):
    y_true  = np.asarray(y_true)
    y_pred  = np.asarray(y_pred)
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

# LR and Ridge use coefficients, not feature_importances_ — excluded from chart.
# Use the better-scoring tree model from each task for the side-by-side view.
risk_tree_result   = max([rf_risk_results,   xgb_risk_results],   key=lambda r: r['f1'])
career_tree_result = max([rf_career_results, xgb_career_results], key=lambda r: r['r2'])


def plot_feature_importance_comparison(model_a, model_b, feature_names, save_path, top_n=15):
    label_a = f"Risk ({risk_tree_result['name']})"
    label_b = f"Career ({career_tree_result['name']})"

    imp_a = pd.Series(model_a.feature_importances_, index=feature_names, name=label_a)
    imp_b = pd.Series(model_b.feature_importances_, index=feature_names, name=label_b)

    avg_imp      = (imp_a + imp_b) / 2
    top_features = avg_imp.nlargest(top_n).index

    df_imp = pd.DataFrame({
        label_a: imp_a[top_features],
        label_b: imp_b[top_features]
    }).sort_values(label_a, ascending=True)

    _, ax = plt.subplots(figsize=(10, 8))
    df_imp.plot(kind='barh', ax=ax, color=['#2196F3', '#4CAF50'], alpha=0.85, width=0.7)
    ax.set_title(f'Top {top_n} Feature Importances — Risk vs Career Model (Tree Models)',
                 fontsize=13)
    ax.set_xlabel('Feature Importance Score')
    ax.set_ylabel('Feature')
    ax.legend(loc='lower right')
    ax.grid(axis='x', linestyle='--', alpha=0.4)
    plt.tight_layout()
    plt.savefig(save_path, dpi=150)
    plt.close()
    print(f"  Saved: {save_path}")


plot_feature_importance_comparison(
    risk_tree_result['model'],
    career_tree_result['model'],
    feature_columns,
    PLOTS_DIR / 'feature_importance_comparison.png'
)


# =============================================================================
# SECTION 7 — MODEL COMPARISON BAR CHART  (all 3 algorithms)
# =============================================================================

print("\n" + "=" * 65)
print("  STEP 7: ALGORITHM COMPARISON BAR CHART (LR/Ridge | RF | XGBoost)")
print("=" * 65)


def plot_model_comparison(risk_results_list, career_results_list, save_path):
    """Grouped bar chart: all 3 algorithms × both tasks side by side."""
    algorithms    = [r['name'] for r in risk_results_list]
    risk_scores   = [r['f1'] for r in risk_results_list]
    career_scores = [r['r2'] for r in career_results_list]

    x     = np.arange(len(algorithms))
    width = 0.35

    _, ax = plt.subplots(figsize=(10, 5))
    bars1 = ax.bar(x - width / 2, risk_scores,   width,
                   label='Model A — Academic Risk (Weighted F1)',  color='#2196F3', alpha=0.85)
    bars2 = ax.bar(x + width / 2, career_scores, width,
                   label='Model B — Career Readiness (R² Score)', color='#4CAF50', alpha=0.85)

    for rect in list(bars1) + list(bars2):
        ax.text(
            rect.get_x() + rect.get_width() / 2,
            rect.get_height() + 0.008,
            f'{rect.get_height():.3f}',
            ha='center', va='bottom', fontsize=9, fontweight='bold'
        )

    ax.set_xticks(x)
    ax.set_xticklabels(algorithms, fontsize=10)
    ax.set_ylim(0, 1.15)
    ax.set_ylabel('Score (higher is better)')
    ax.set_title('Algorithm Comparison — Logistic Regression | Random Forest | XGBoost',
                 fontsize=12)
    ax.legend(fontsize=9)
    ax.grid(axis='y', linestyle='--', alpha=0.4)
    plt.tight_layout()
    plt.savefig(save_path, dpi=150)
    plt.close()
    print(f"  Saved: {save_path}")


plot_model_comparison(
    [lr_risk_results,      rf_risk_results,    xgb_risk_results],
    [ridge_career_results, rf_career_results,  xgb_career_results],
    PLOTS_DIR / 'model_comparison_bar_chart.png'
)


# =============================================================================
# SECTION 8 — SAVE ALL 6 MODELS & METADATA
# =============================================================================

print("\n" + "=" * 65)
print("  STEP 8: SAVING ALL MODELS & METADATA")
print("=" * 65)

# All 6 models saved with fixed filenames — inference layer can load any of them.
model_save_map = {
    RISK_FILENAMES['Logistic Regression']: lr_risk,
    RISK_FILENAMES['Random Forest']      : rf_risk,
    RISK_FILENAMES['XGBoost']            : xgb_risk,
    CAREER_FILENAMES['Ridge Regression'] : ridge_career,
    CAREER_FILENAMES['Random Forest']    : rf_career,
    CAREER_FILENAMES['XGBoost']          : xgb_career,
}

for filename, model_obj in model_save_map.items():
    joblib.dump(model_obj, SAVED_DIR / filename)
    print(f"  Saved: {filename}")

# Metadata stores all three results per task + the winner name/filename so the
# inference layer knows which model to load without hard-coding algorithm names.
metadata = {
    # ── Model A ──────────────────────────────────────────────────────────────
    'model_A_winner'         : best_risk_result['name'],
    'model_A_winner_filename': RISK_FILENAMES[best_risk_result['name']],
    'model_A_lr_accuracy'    : round(lr_risk_results['accuracy'],  6),
    'model_A_lr_f1'          : round(lr_risk_results['f1'],        6),
    'model_A_lr_cv_accuracy' : round(lr_risk_results['cv_mean'],   6),
    'model_A_rf_accuracy'    : round(rf_risk_results['accuracy'],  6),
    'model_A_rf_f1'          : round(rf_risk_results['f1'],        6),
    'model_A_rf_cv_accuracy' : round(rf_risk_results['cv_mean'],   6),
    'model_A_xgb_accuracy'   : round(xgb_risk_results['accuracy'], 6),
    'model_A_xgb_f1'         : round(xgb_risk_results['f1'],       6),
    'model_A_xgb_cv_accuracy': round(xgb_risk_results['cv_mean'],  6),
    # ── Model B ──────────────────────────────────────────────────────────────
    'model_B_winner'         : best_career_result['name'],
    'model_B_winner_filename': CAREER_FILENAMES[best_career_result['name']],
    'model_B_ridge_mae'      : round(ridge_career_results['mae'],    6),
    'model_B_ridge_rmse'     : round(ridge_career_results['rmse'],   6),
    'model_B_ridge_r2'       : round(ridge_career_results['r2'],     6),
    'model_B_ridge_cv_r2'    : round(ridge_career_results['cv_mean'], 6),
    'model_B_rf_mae'         : round(rf_career_results['mae'],       6),
    'model_B_rf_rmse'        : round(rf_career_results['rmse'],      6),
    'model_B_rf_r2'          : round(rf_career_results['r2'],        6),
    'model_B_rf_cv_r2'       : round(rf_career_results['cv_mean'],   6),
    'model_B_xgb_mae'        : round(xgb_career_results['mae'],      6),
    'model_B_xgb_rmse'       : round(xgb_career_results['rmse'],     6),
    'model_B_xgb_r2'         : round(xgb_career_results['r2'],       6),
    'model_B_xgb_cv_r2'      : round(xgb_career_results['cv_mean'],  6),
    # ── Shared ───────────────────────────────────────────────────────────────
    'feature_columns'        : feature_columns,
    'risk_label_map'         : RISK_LABEL_MAP,
    'scaler_filename'        : 'scaler.pkl',
}
joblib.dump(metadata, SAVED_DIR / 'model_metadata.pkl')
print("  Saved: model_metadata.pkl")
print(f"\n  All models saved to: {SAVED_DIR}")


# =============================================================================
# SUMMARY
# =============================================================================

print("\n" + "=" * 65)
print("  TRAINING COMPLETE — FINAL SUMMARY")
print("=" * 65)

W   = 22
SEP = "─" * 62

print(f"\n  MODEL A — Academic Risk Classification")
print(f"  {SEP}")
print(f"  {'Algorithm':<{W}} {'Accuracy':>10} {'Weighted F1':>12} {'CV Acc (5-fold)':>16}")
print(f"  {SEP}")
for res in [lr_risk_results, rf_risk_results, xgb_risk_results]:
    print(f"  {res['name']:<{W}} {res['accuracy']:>10.4f} {res['f1']:>12.4f}"
          f" {res['cv_mean']:>10.4f} ± {res['cv_std']:.4f}")
print(f"  Winner: {best_risk_result['name']}")

print(f"\n  MODEL B — Career Readiness Regression")
print(f"  {SEP}")
print(f"  {'Algorithm':<{W}} {'MAE':>8} {'RMSE':>8} {'R²':>8} {'CV R² (5-fold)':>16}")
print(f"  {SEP}")
for res in [ridge_career_results, rf_career_results, xgb_career_results]:
    print(f"  {res['name']:<{W}} {res['mae']:>8.4f} {res['rmse']:>8.4f}"
          f" {res['r2']:>8.4f} {res['cv_mean']:>10.4f} ± {res['cv_std']:.4f}")
print(f"  Winner: {best_career_result['name']}")

print("\n  SAVED FILES")
print(f"  {SEP}")
print(f"  Models & metadata  → {SAVED_DIR}")
for fname in model_save_map:
    print(f"    {fname}")
print("    model_metadata.pkl")
print(f"\n  Plots              → {PLOTS_DIR}")
print("    confusion_matrix_risk.png")
print("    actual_vs_predicted_career.png")
print("    feature_importance_comparison.png")
print("    model_comparison_bar_chart.png")

print("\n" + "=" * 65)
print("  Ready for simulation / inference pipeline.")
print("=" * 65)
