# backend/ml_scripts/study-planner/model_training.py
"""
Model Training for Academic Priority Prediction
With Class Weights - Fresh Training
"""

import matplotlib
matplotlib.use('Agg')

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import joblib
import json
import shutil
import warnings
warnings.filterwarnings('ignore')

from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, classification_report, roc_auc_score,
    roc_curve
)
from sklearn.model_selection import cross_val_score, RandomizedSearchCV
from sklearn.utils.class_weight import compute_class_weight
from xgboost import XGBClassifier
from collections import Counter

import os
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.append(str(project_root))

# Define paths
DATASET_PATH = project_root / 'datasets' / 'study-planner'
TRAINED_MODELS_PATH = project_root / 'trained-models' / 'study-planner'
VIZ_PATH = TRAINED_MODELS_PATH / 'visualizations'

def cleanup_old_models():
    """Delete old model files for fresh training"""
    print("\n" + "=" * 70)
    print(" CLEANING UP OLD MODEL FILES ")
    print("=" * 70)
    
    if TRAINED_MODELS_PATH.exists():
        # Delete all files but keep directory structure
        for file in TRAINED_MODELS_PATH.glob('*'):
            if file.is_file():
                file.unlink()
                print(f"  🗑️ Deleted: {file.name}")
        print(f"\n  ✅ Cleaned {TRAINED_MODELS_PATH}")
    else:
        print(f"  📁 Creating directory: {TRAINED_MODELS_PATH}")
        TRAINED_MODELS_PATH.mkdir(parents=True, exist_ok=True)
    
    # Recreate visualizations directory
    if VIZ_PATH.exists():
        shutil.rmtree(VIZ_PATH)
    VIZ_PATH.mkdir(parents=True, exist_ok=True)
    print(f"  📁 Created visualizations directory")

def load_preprocessed_data():
    """Load preprocessed data"""
    print("\n" + "=" * 70)
    print(" LOADING PREPROCESSED DATA ")
    print("=" * 70)
    
    # Check if files exist
    X_train_path = DATASET_PATH / 'X_train.npy'
    if not X_train_path.exists():
        print("\n❌ Preprocessed data not found! Run data_preprocessing.py first!")
        sys.exit(1)
    
    X_train = np.load(DATASET_PATH / 'X_train.npy')
    X_val = np.load(DATASET_PATH / 'X_val.npy')
    y_train = np.load(DATASET_PATH / 'y_train.npy')
    y_val = np.load(DATASET_PATH / 'y_val.npy')
    X_test = np.load(DATASET_PATH / 'X_test.npy')
    
    # Load or create feature columns
    feature_cols_path = TRAINED_MODELS_PATH / 'feature_columns.pkl'
    if feature_cols_path.exists():
        feature_cols = joblib.load(feature_cols_path)
    else:
        feature_cols = [f'feature_{i}' for i in range(X_train.shape[1])]
    
    print(f"  - X_train: {X_train.shape}")
    print(f"  - X_val: {X_val.shape}")
    print(f"  - X_test: {X_test.shape}")
    print(f"  - y_train distribution: {dict(Counter(y_train))}")
    print(f"  - y_val distribution: {dict(Counter(y_val))}")
    print(f"  - Features: {len(feature_cols)}")
    
    return X_train, X_val, y_train, y_val, X_test, feature_cols

def compute_and_save_class_weights(y_train):
    """Compute class weights and save them"""
    print("\n" + "=" * 70)
    print(" COMPUTING CLASS WEIGHTS ")
    print("=" * 70)
    
    # Get class distribution
    class_counts = Counter(y_train)
    n_samples = len(y_train)
    n_classes = len(class_counts)
    
    print(f"\n  📊 Training Class Distribution:")
    priority_names = {0: 'Low', 1: 'Medium', 2: 'High'}
    for cls in sorted(class_counts.keys()):
        count = class_counts[cls]
        percentage = (count / n_samples) * 100
        print(f"     Priority {cls} ({priority_names[cls]}): {count} samples ({percentage:.1f}%)")
    
    # Method 1: Balanced class weights
    balanced_weights = compute_class_weight('balanced', classes=np.unique(y_train), y=y_train)
    class_weight_dict = {int(cls): float(weight) for cls, weight in zip(np.unique(y_train), balanced_weights)}
    
    print(f"\n  📊 Computed Class Weights (balanced method):")
    for cls, weight in class_weight_dict.items():
        print(f"     Priority {cls} ({priority_names[cls]}): {weight:.4f}")
    
    # Method 2: Manual inverse frequency weights
    manual_weights = {}
    for cls, count in class_counts.items():
        manual_weights[cls] = n_samples / (n_classes * count)
    
    print(f"\n  📊 Manual Class Weights (inverse frequency):")
    for cls, weight in manual_weights.items():
        print(f"     Priority {cls} ({priority_names[cls]}): {weight:.4f}")
    
    # Save class weights
    joblib.dump(class_weight_dict, TRAINED_MODELS_PATH / 'class_weights.pkl')
    with open(TRAINED_MODELS_PATH / 'class_weights.json', 'w') as f:
        json.dump(class_weight_dict, f, indent=2)
    print(f"\n  ✅ Class weights saved")
    
    return class_weight_dict

def plot_class_distribution(y_train, y_val):
    """Plot class distribution"""
    fig, axes = plt.subplots(1, 2, figsize=(12, 5))
    
    priority_names = ['Low (0)', 'Medium (1)', 'High (2)']
    colors = ['green', 'orange', 'red']
    
    # Training distribution
    train_counts = Counter(y_train)
    axes[0].bar(range(3), [train_counts.get(i, 0) for i in range(3)], color=colors)
    axes[0].set_xlabel('Priority Level')
    axes[0].set_ylabel('Count')
    axes[0].set_title(f'Training Set\nTotal: {len(y_train)} samples')
    axes[0].set_xticks(range(3))
    axes[0].set_xticklabels(priority_names)
    for i in range(3):
        count = train_counts.get(i, 0)
        axes[0].text(i, count + 5, str(count), ha='center')
    
    # Validation distribution
    val_counts = Counter(y_val)
    axes[1].bar(range(3), [val_counts.get(i, 0) for i in range(3)], color=colors)
    axes[1].set_xlabel('Priority Level')
    axes[1].set_ylabel('Count')
    axes[1].set_title(f'Validation Set\nTotal: {len(y_val)} samples')
    axes[1].set_xticks(range(3))
    axes[1].set_xticklabels(priority_names)
    for i in range(3):
        count = val_counts.get(i, 0)
        axes[1].text(i, count + 5, str(count), ha='center')
    
    plt.tight_layout()
    plt.savefig(VIZ_PATH / 'class_distribution.png', dpi=150, bbox_inches='tight')
    plt.close()
    print(f"  ✅ Class distribution plot saved")

def train_xgboost(X_train, y_train, X_val, y_val, class_weight_dict):
    """Train XGBoost with class weights"""
    print("\n" + "=" * 70)
    print(" TRAINING XGBOOST (Primary Model)")
    print("=" * 70)
    
    # Create sample weights
    sample_weights = np.array([class_weight_dict[y] for y in y_train])
    
    print(f"\n  Sample weight statistics:")
    print(f"     Min: {sample_weights.min():.4f}")
    print(f"     Max: {sample_weights.max():.4f}")
    print(f"     Mean: {sample_weights.mean():.4f}")
    
    # Hyperparameter tuning
    print("\n  Tuning hyperparameters...")
    
    xgb_params = {
        'n_estimators': [100, 200, 300],
        'max_depth': [4, 6, 8],
        'learning_rate': [0.05, 0.1, 0.15],
        'subsample': [0.7, 0.8, 0.9],
        'colsample_bytree': [0.7, 0.8, 0.9],
        'min_child_weight': [1, 3, 5],
        'gamma': [0, 0.1, 0.2]
    }
    
    xgb_grid = RandomizedSearchCV(
        XGBClassifier(random_state=42, use_label_encoder=False, eval_metric='mlogloss', n_jobs=-1),
        xgb_params,
        n_iter=30,
        cv=5,
        scoring='accuracy',
        n_jobs=-1,
        verbose=0,
        random_state=42
    )
    
    xgb_grid.fit(X_train, y_train, sample_weight=sample_weights)
    
    best_model = xgb_grid.best_estimator_
    best_params = xgb_grid.best_params_
    best_cv_score = xgb_grid.best_score_
    
    print(f"\n  ✅ Best parameters: {best_params}")
    print(f"  ✅ Best CV score: {best_cv_score:.4f}")
    
    # Evaluate on validation set
    y_val_pred = best_model.predict(X_val)
    val_accuracy = accuracy_score(y_val, y_val_pred)
    val_f1 = f1_score(y_val, y_val_pred, average='weighted')
    
    print(f"\n  📊 Validation Results:")
    print(f"     Accuracy: {val_accuracy:.4f} ({val_accuracy*100:.2f}%)")
    print(f"     F1-Score: {val_f1:.4f}")
    
    # Per-class accuracy
    for cls in [0, 1, 2]:
        mask = y_val == cls
        if np.sum(mask) > 0:
            class_acc = accuracy_score(y_val[mask], y_val_pred[mask])
            print(f"     Priority {cls} Accuracy: {class_acc:.4f} ({class_acc*100:.2f}%)")
    
    # Get probabilities for ROC
    y_val_proba = best_model.predict_proba(X_val)
    
    return best_model, best_params, best_cv_score, val_accuracy, val_f1, y_val_pred, y_val_proba

def train_random_forest(X_train, y_train, X_val, y_val, class_weight_dict):
    """Train Random Forest with class weights"""
    print("\n" + "=" * 70)
    print(" TRAINING RANDOM FOREST (Comparison)")
    print("=" * 70)
    
    print("\n  Tuning hyperparameters...")
    
    rf_params = {
        'n_estimators': [100, 200, 300],
        'max_depth': [10, 15, 20, None],
        'min_samples_split': [2, 5, 10],
        'min_samples_leaf': [1, 2, 4],
        'max_features': ['sqrt', 'log2']
    }
    
    rf_grid = RandomizedSearchCV(
        RandomForestClassifier(random_state=42, class_weight=class_weight_dict, n_jobs=-1),
        rf_params,
        n_iter=20,
        cv=5,
        scoring='accuracy',
        n_jobs=-1,
        verbose=0,
        random_state=42
    )
    
    rf_grid.fit(X_train, y_train)
    
    best_model = rf_grid.best_estimator_
    best_params = rf_grid.best_params_
    best_cv_score = rf_grid.best_score_
    
    print(f"\n  ✅ Best parameters: {best_params}")
    print(f"  ✅ Best CV score: {best_cv_score:.4f}")
    
    # Evaluate on validation set
    y_val_pred = best_model.predict(X_val)
    val_accuracy = accuracy_score(y_val, y_val_pred)
    val_f1 = f1_score(y_val, y_val_pred, average='weighted')
    
    print(f"\n  📊 Validation Results:")
    print(f"     Accuracy: {val_accuracy:.4f} ({val_accuracy*100:.2f}%)")
    print(f"     F1-Score: {val_f1:.4f}")
    
    # Per-class accuracy
    for cls in [0, 1, 2]:
        mask = y_val == cls
        if np.sum(mask) > 0:
            class_acc = accuracy_score(y_val[mask], y_val_pred[mask])
            print(f"     Priority {cls} Accuracy: {class_acc:.4f} ({class_acc*100:.2f}%)")
    
    # Get probabilities for ROC
    y_val_proba = best_model.predict_proba(X_val)
    
    return best_model, best_params, best_cv_score, val_accuracy, val_f1, y_val_pred, y_val_proba

def train_gradient_boosting(X_train, y_train, X_val, y_val, class_weight_dict):
    """Train Gradient Boosting with class weights"""
    print("\n" + "=" * 70)
    print(" TRAINING GRADIENT BOOSTING (Comparison)")
    print("=" * 70)
    
    # Create sample weights
    sample_weights = np.array([class_weight_dict[y] for y in y_train])
    
    print("\n  Tuning hyperparameters...")
    
    gb_params = {
        'n_estimators': [100, 200, 300],
        'max_depth': [3, 5, 7],
        'learning_rate': [0.05, 0.1, 0.15],
        'subsample': [0.7, 0.8, 0.9]
    }
    
    gb_grid = RandomizedSearchCV(
        GradientBoostingClassifier(random_state=42),
        gb_params,
        n_iter=15,
        cv=5,
        scoring='accuracy',
        n_jobs=-1,
        verbose=0,
        random_state=42
    )
    
    gb_grid.fit(X_train, y_train, sample_weight=sample_weights)
    
    best_model = gb_grid.best_estimator_
    best_params = gb_grid.best_params_
    best_cv_score = gb_grid.best_score_
    
    print(f"\n  ✅ Best parameters: {best_params}")
    print(f"  ✅ Best CV score: {best_cv_score:.4f}")
    
    # Evaluate on validation set
    y_val_pred = best_model.predict(X_val)
    val_accuracy = accuracy_score(y_val, y_val_pred)
    val_f1 = f1_score(y_val, y_val_pred, average='weighted')
    
    print(f"\n  📊 Validation Results:")
    print(f"     Accuracy: {val_accuracy:.4f} ({val_accuracy*100:.2f}%)")
    print(f"     F1-Score: {val_f1:.4f}")
    
    # Per-class accuracy
    for cls in [0, 1, 2]:
        mask = y_val == cls
        if np.sum(mask) > 0:
            class_acc = accuracy_score(y_val[mask], y_val_pred[mask])
            print(f"     Priority {cls} Accuracy: {class_acc:.4f} ({class_acc*100:.2f}%)")
    
    # Get probabilities for ROC
    y_val_proba = best_model.predict_proba(X_val)
    
    return best_model, best_params, best_cv_score, val_accuracy, val_f1, y_val_pred, y_val_proba

def plot_confusion_matrix(y_true, y_pred, model_name, save_path):
    """Plot confusion matrix"""
    cm = confusion_matrix(y_true, y_pred)
    fig, ax = plt.subplots(figsize=(8, 6))
    
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', ax=ax,
                xticklabels=['Low (0)', 'Medium (1)', 'High (2)'],
                yticklabels=['Low (0)', 'Medium (1)', 'High (2)'])
    ax.set_xlabel('Predicted Priority')
    ax.set_ylabel('Actual Priority')
    ax.set_title(f'{model_name} - Confusion Matrix')
    
    plt.tight_layout()
    plt.savefig(save_path, dpi=150, bbox_inches='tight')
    plt.close()

def plot_feature_importance(model, feature_cols, model_name, save_path, top_n=15):
    """Plot feature importance"""
    if hasattr(model, 'feature_importances_'):
        importances = model.feature_importances_
        indices = np.argsort(importances)[::-1][:top_n]
        
        fig, ax = plt.subplots(figsize=(12, 8))
        bars = ax.barh(range(len(indices)), importances[indices])
        ax.set_yticks(range(len(indices)))
        ax.set_yticklabels([feature_cols[i][:35] for i in indices], fontsize=10)
        ax.set_xlabel('Feature Importance')
        ax.set_title(f'{model_name} - Top {top_n} Features')
        ax.invert_yaxis()
        
        # Add value labels
        for i, (bar, val) in enumerate(zip(bars, importances[indices])):
            ax.text(val + 0.01, i, f'{val:.3f}', va='center', fontsize=9)
        
        plt.tight_layout()
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
        plt.close()
        
        # Save to CSV
        importance_df = pd.DataFrame({
            'Feature': [feature_cols[i] for i in indices],
            'Importance': importances[indices]
        })
        importance_df.to_csv(TRAINED_MODELS_PATH / f'{model_name}_feature_importance.csv', index=False)

def plot_roc_curves(y_true, y_proba, model_name, save_path):
    """Plot ROC curves"""
    if y_proba is None:
        return
    
    n_classes = y_proba.shape[1]
    fig, ax = plt.subplots(figsize=(8, 6))
    
    colors = ['blue', 'green', 'red']
    class_names = ['Low (0)', 'Medium (1)', 'High (2)']
    
    for i in range(n_classes):
        fpr, tpr, _ = roc_curve(y_true == i, y_proba[:, i])
        auc = roc_auc_score(y_true == i, y_proba[:, i])
        ax.plot(fpr, tpr, color=colors[i], label=f'{class_names[i]} (AUC = {auc:.3f})')
    
    ax.plot([0, 1], [0, 1], 'k--', label='Random')
    ax.set_xlabel('False Positive Rate')
    ax.set_ylabel('True Positive Rate')
    ax.set_title(f'{model_name} - ROC Curves')
    ax.legend(loc='lower right')
    
    plt.tight_layout()
    plt.savefig(save_path, dpi=150, bbox_inches='tight')
    plt.close()

def plot_model_comparison(results_df, save_path):
    """Plot model comparison"""
    fig, axes = plt.subplots(1, 2, figsize=(14, 6))
    
    # Accuracy comparison
    axes[0].barh(results_df['Model'], results_df['Validation Accuracy'], color=['red', 'blue', 'green'])
    axes[0].set_xlabel('Validation Accuracy')
    axes[0].set_title('Model Accuracy Comparison')
    axes[0].set_xlim([0.5, 1.0])
    for i, (model, acc) in enumerate(zip(results_df['Model'], results_df['Validation Accuracy'])):
        axes[0].text(acc + 0.01, i, f'{acc*100:.1f}%', va='center')
    
    # F1 Score comparison
    axes[1].barh(results_df['Model'], results_df['Validation F1'], color=['red', 'blue', 'green'])
    axes[1].set_xlabel('Validation F1-Score')
    axes[1].set_title('Model F1-Score Comparison')
    axes[1].set_xlim([0.5, 1.0])
    for i, (model, f1) in enumerate(zip(results_df['Model'], results_df['Validation F1'])):
        axes[1].text(f1 + 0.01, i, f'{f1*100:.1f}%', va='center')
    
    plt.tight_layout()
    plt.savefig(save_path, dpi=150, bbox_inches='tight')
    plt.close()

def save_model_and_artifacts(model, model_name, metrics, X_train, y_train, feature_cols, scaler, class_weight_dict):
    """Save all model artifacts"""
    print("\n" + "=" * 70)
    print(" SAVING MODEL AND ARTIFACTS ")
    print("=" * 70)
    
    # Save primary model
    model_path = TRAINED_MODELS_PATH / 'academic_priority_model.pkl'
    joblib.dump(model, model_path)
    print(f"  ✅ Primary model saved: {model_path}")
    
    # Save XGBoost model separately
    xgboost_path = TRAINED_MODELS_PATH / 'xgboost_model.pkl'
    joblib.dump(model, xgboost_path)
    print(f"  ✅ XGBoost model saved: {xgboost_path}")
    
    # Save scaler
    scaler_path = TRAINED_MODELS_PATH / 'scaler.pkl'
    joblib.dump(scaler, scaler_path)
    print(f"  ✅ Scaler saved: {scaler_path}")
    
    # Save feature columns
    feature_cols_path = TRAINED_MODELS_PATH / 'feature_columns.pkl'
    joblib.dump(feature_cols, feature_cols_path)
    print(f"  ✅ Feature columns saved: {feature_cols_path}")
    
    # Save feature columns as JSON
    with open(TRAINED_MODELS_PATH / 'feature_columns.json', 'w') as f:
        json.dump(feature_cols, f, indent=2)
    
    # Save model metadata
    metadata = {
        'model_name': model_name,
        'model_type': model.__class__.__name__,
        'num_features': len(feature_cols),
        'num_classes': len(np.unique(y_train)),
        'class_weights': class_weight_dict,
        'metrics': {
            'accuracy': float(metrics['val_accuracy']),
            'f1_score': float(metrics['val_f1']),
            'best_cv_score': float(metrics['best_cv_score'])
        }
    }
    
    with open(TRAINED_MODELS_PATH / 'model_metadata.json', 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f"  ✅ Model metadata saved")
    
    # Save model summary
    with open(TRAINED_MODELS_PATH / 'model_summary.txt', 'w') as f:
        f.write("=" * 60 + "\n")
        f.write("ACADEMIC PRIORITY PREDICTION MODEL\n")
        f.write("=" * 60 + "\n\n")
        f.write(f"Model: {model_name}\n")
        f.write(f"Model Type: {model.__class__.__name__}\n\n")
        f.write(f"Number of Features: {len(feature_cols)}\n")
        f.write(f"Number of Classes: {len(np.unique(y_train))}\n\n")
        f.write("Class Weights:\n")
        for cls, weight in class_weight_dict.items():
            priority_name = {0: 'Low', 1: 'Medium', 2: 'High'}[cls]
            f.write(f"  - Priority {cls} ({priority_name}): {weight:.4f}\n")
        f.write("\nModel Performance:\n")
        f.write(f"  - Validation Accuracy: {metrics['val_accuracy']:.4f}\n")
        f.write(f"  - Validation F1-Score: {metrics['val_f1']:.4f}\n")
        f.write(f"  - Best CV Score: {metrics['best_cv_score']:.4f}\n")
    
    print(f"  ✅ Model summary saved")

def main():
    """Main training pipeline"""
    print("\n" + "=" * 70)
    print(" ACADEMIC PRIORITY PREDICTION - MODEL TRAINING ")
    print(" WITH CLASS WEIGHTS ")
    print("=" * 70)
    
    # Clean up old models
    cleanup_old_models()
    
    # Load data
    X_train, X_val, y_train, y_val, X_test, feature_cols = load_preprocessed_data()
    
    # Create and save scaler
    from sklearn.preprocessing import StandardScaler
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_val_scaled = scaler.transform(X_val)
    X_test_scaled = scaler.transform(X_test)
    
    print(f"\n  ✅ Data scaled successfully")
    
    # Compute and save class weights
    class_weight_dict = compute_and_save_class_weights(y_train)
    
    # Plot class distribution
    plot_class_distribution(y_train, y_val)
    
    # Train all models
    results = []
    
    # 1. XGBoost
    xgb_model, xgb_params, xgb_cv, xgb_acc, xgb_f1, xgb_pred, xgb_proba = train_xgboost(
        X_train_scaled, y_train, X_val_scaled, y_val, class_weight_dict
    )
    results.append({
        'Model': 'XGBoost',
        'CV Score': xgb_cv,
        'Validation Accuracy': xgb_acc,
        'Validation F1': xgb_f1,
        'Model Object': xgb_model,
        'Predictions': xgb_pred,
        'Probabilities': xgb_proba
    })
    
    # 2. Random Forest
    rf_model, rf_params, rf_cv, rf_acc, rf_f1, rf_pred, rf_proba = train_random_forest(
        X_train_scaled, y_train, X_val_scaled, y_val, class_weight_dict
    )
    results.append({
        'Model': 'Random Forest',
        'CV Score': rf_cv,
        'Validation Accuracy': rf_acc,
        'Validation F1': rf_f1,
        'Model Object': rf_model,
        'Predictions': rf_pred,
        'Probabilities': rf_proba
    })
    
    # 3. Gradient Boosting
    gb_model, gb_params, gb_cv, gb_acc, gb_f1, gb_pred, gb_proba = train_gradient_boosting(
        X_train_scaled, y_train, X_val_scaled, y_val, class_weight_dict
    )
    results.append({
        'Model': 'Gradient Boosting',
        'CV Score': gb_cv,
        'Validation Accuracy': gb_acc,
        'Validation F1': gb_f1,
        'Model Object': gb_model,
        'Predictions': gb_pred,
        'Probabilities': gb_proba
    })
    
    # Create comparison dataframe
    comparison_df = pd.DataFrame([
        {k: v for k, v in r.items() if k not in ['Model Object', 'Predictions', 'Probabilities']}
        for r in results
    ])
    
    print("\n" + "=" * 70)
    print(" MODEL COMPARISON RESULTS ")
    print("=" * 70)
    print(comparison_df.to_string(index=False))
    
    # Save comparison
    comparison_df.to_csv(TRAINED_MODELS_PATH / 'model_comparison.csv', index=False)
    
    # Select best model (by validation accuracy)
    best_result = max(results, key=lambda x: x['Validation Accuracy'])
    best_model = best_result['Model Object']
    best_model_name = best_result['Model']
    
    print(f"\n" + "=" * 70)
    print(f"🏆 BEST MODEL: {best_model_name}")
    print(f"   Validation Accuracy: {best_result['Validation Accuracy']*100:.2f}%")
    print(f"   Validation F1-Score: {best_result['Validation F1']:.4f}")
    print(f"   CV Score: {best_result['CV Score']:.4f}")
    print("=" * 70)
    
    # Generate visualizations for each model
    print("\n" + "=" * 70)
    print(" GENERATING VISUALIZATIONS ")
    print("=" * 70)
    
    for result in results:
        model_name = result['Model']
        model_viz_path = VIZ_PATH / model_name.replace(' ', '_')
        model_viz_path.mkdir(exist_ok=True)
        
        # Confusion Matrix
        plot_confusion_matrix(y_val, result['Predictions'], model_name,
                             model_viz_path / f'{model_name}_confusion_matrix.png')
        
        # ROC Curves
        plot_roc_curves(y_val, result['Probabilities'], model_name,
                        model_viz_path / f'{model_name}_roc_curves.png')
        
        # Feature Importance (for tree-based models)
        plot_feature_importance(result['Model Object'], feature_cols, model_name,
                                model_viz_path / f'{model_name}_feature_importance.png')
        
        print(f"  ✅ {model_name} visualizations saved")
    
    # Plot model comparison
    plot_model_comparison(comparison_df, VIZ_PATH / 'model_comparison.png')
    print(f"  ✅ Model comparison chart saved")
    
    # Save best model and artifacts
    metrics = {
        'val_accuracy': best_result['Validation Accuracy'],
        'val_f1': best_result['Validation F1'],
        'best_cv_score': best_result['CV Score']
    }
    
    save_model_and_artifacts(best_model, best_model_name, metrics,
                            X_train_scaled, y_train, feature_cols, scaler, class_weight_dict)
    
    # Final evaluation
    print("\n" + "=" * 70)
    print(" FINAL EVALUATION REPORT ")
    print("=" * 70)
    
    print("\n📊 Classification Report:")
    print(classification_report(y_val, best_result['Predictions'], 
                                target_names=['Low (0)', 'Medium (1)', 'High (2)']))
    
    # Test on unseen data
    print("\n" + "=" * 70)
    print(" TEST ON UNSEEN DATA ")
    print("=" * 70)
    
    y_test_pred = best_model.predict(X_test_scaled)
    print(f"  - Test predictions shape: {y_test_pred.shape}")
    print(f"  - Test prediction distribution:")
    for p in sorted(np.unique(y_test_pred)):
        count = (y_test_pred == p).sum()
        priority_name = {0: 'Low', 1: 'Medium', 2: 'High'}[p]
        print(f"      Priority {p} ({priority_name}): {count} ({count/len(y_test_pred)*100:.1f}%)")
    
    # Save test predictions
    np.save(TRAINED_MODELS_PATH / 'test_predictions.npy', y_test_pred)
    np.save(TRAINED_MODELS_PATH / 'val_predictions.npy', best_result['Predictions'])
    np.save(TRAINED_MODELS_PATH / 'val_true_labels.npy', y_val)
    
    print("\n" + "=" * 70)
    print(" ✅ MODEL TRAINING COMPLETED SUCCESSFULLY ")
    print("=" * 70)
    print(f"\n📁 All artifacts saved in: {TRAINED_MODELS_PATH}")
    print(f"📊 Visualizations saved in: {VIZ_PATH}")
    print(f"\n🎯 Final Model Accuracy: {best_result['Validation Accuracy']*100:.2f}%")
    
    if best_result['Validation Accuracy'] >= 0.90:
        print(f"🎉 EXCELLENT! Model exceeds target (75-90%)!")
    elif best_result['Validation Accuracy'] >= 0.75:
        print(f"✅ GOOD! Model meets target (75-90%)!")
    else:
        print(f"⚠️ Model accuracy below target. Consider more data.")
    
    return best_model, best_model_name, best_result['Validation Accuracy']

if __name__ == "__main__":
    main()