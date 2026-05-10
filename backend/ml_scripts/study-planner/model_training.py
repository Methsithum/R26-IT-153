# backend/ml_scripts/study-planner/model_training_complete.py
"""
Model Training for Academic Priority Prediction
COMPLETE FIXED VERSION - All variables properly defined
"""

import matplotlib
matplotlib.use('Agg')

import numpy as np
import pandas as pd
import joblib
import json
import shutil
import warnings
warnings.filterwarnings('ignore')

import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
import sys

from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import (
    accuracy_score, f1_score, classification_report, 
    confusion_matrix, roc_curve, roc_auc_score
)
from sklearn.utils.class_weight import compute_class_weight
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier

# ---------------------------------------------------
# PATHS
# ---------------------------------------------------

project_root = Path(__file__).parent.parent.parent
sys.path.append(str(project_root))

DATASET_PATH = project_root / 'datasets' / 'study-planner'
TRAINED_MODELS_PATH = project_root / 'trained-models' / 'study-planner'
VIZ_PATH = TRAINED_MODELS_PATH / 'visualizations'

TRAINED_MODELS_PATH.mkdir(parents=True, exist_ok=True)
VIZ_PATH.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------
# CLEANUP
# ---------------------------------------------------

def cleanup_old_models():
    print("\n🧹 Cleaning old models...")
    
    for file in TRAINED_MODELS_PATH.glob("*"):
        if file.is_file() and file.suffix not in ['.json', '.txt']:
            file.unlink(missing_ok=True)
    
    if VIZ_PATH.exists():
        shutil.rmtree(VIZ_PATH)
    
    VIZ_PATH.mkdir(parents=True, exist_ok=True)
    
    print("✅ Cleanup done")

# ---------------------------------------------------
# LOAD DATA
# ---------------------------------------------------

def load_data():
    print("\n📊 Loading preprocessed data...")
    
    X_train = np.load(DATASET_PATH / "X_train.npy")
    X_val = np.load(DATASET_PATH / "X_val.npy")
    X_test = np.load(DATASET_PATH / "X_test.npy")
    
    y_train = np.load(DATASET_PATH / "y_train.npy")
    y_val = np.load(DATASET_PATH / "y_val.npy")
    
    # Try to load feature columns if available
    feature_cols_path = TRAINED_MODELS_PATH / 'feature_columns.pkl'
    if feature_cols_path.exists():
        feature_cols = joblib.load(feature_cols_path)
    else:
        feature_cols = [f"feature_{i}" for i in range(X_train.shape[1])]
    
    print(f"✅ Data loaded:")
    print(f"   - Training: {X_train.shape}")
    print(f"   - Validation: {X_val.shape}")
    print(f"   - Test: {X_test.shape}")
    print(f"   - Features: {len(feature_cols)}")
    
    return X_train, X_val, X_test, y_train, y_val, feature_cols

# ---------------------------------------------------
# CLASS WEIGHTS
# ---------------------------------------------------

def get_class_weights(y_train):
    classes = np.unique(y_train)
    weights = compute_class_weight(class_weight='balanced', classes=classes, y=y_train)
    class_weight_dict = {int(c): float(w) for c, w in zip(classes, weights)}
    
    print("\n📊 Class Weights:")
    priority_names = {0: 'Low', 1: 'Medium', 2: 'High'}
    for cls, weight in class_weight_dict.items():
        print(f"   Priority {cls} ({priority_names[cls]}): {weight:.4f}")
    
    return class_weight_dict

# ---------------------------------------------------
# TRAIN MODELS
# ---------------------------------------------------

def train_xgboost(X_train, y_train, X_val, y_val, class_weights):
    """Train XGBoost model"""
    print("\n🚀 Training XGBoost...")
    
    sample_weights = np.array([class_weights[y] for y in y_train])
    
    model = XGBClassifier(
        objective='multi:softprob',
        num_class=3,
        eval_metric='mlogloss',
        n_estimators=200,
        max_depth=6,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1
    )
    
    # Train
    model.fit(X_train, y_train, sample_weight=sample_weights)
    
    # Predictions
    y_pred = model.predict(X_val)
    y_pred_proba = model.predict_proba(X_val)
    
    # Metrics
    acc = accuracy_score(y_val, y_pred)
    f1 = f1_score(y_val, y_pred, average='weighted')
    
    print(f"   ✅ Accuracy: {acc:.4f} ({acc*100:.2f}%)")
    print(f"   ✅ F1-Score: {f1:.4f}")
    
    return model, acc, f1, y_pred, y_pred_proba

def train_random_forest(X_train, y_train, X_val, y_val, class_weights):
    """Train Random Forest model"""
    print("\n🌲 Training Random Forest...")
    
    model = RandomForestClassifier(
        n_estimators=300,
        max_depth=15,
        min_samples_split=5,
        min_samples_leaf=2,
        class_weight=class_weights,
        random_state=42,
        n_jobs=-1
    )
    
    model.fit(X_train, y_train)
    
    # Predictions
    y_pred = model.predict(X_val)
    y_pred_proba = model.predict_proba(X_val)
    
    # Metrics
    acc = accuracy_score(y_val, y_pred)
    f1 = f1_score(y_val, y_pred, average='weighted')
    
    print(f"   ✅ Accuracy: {acc:.4f} ({acc*100:.2f}%)")
    print(f"   ✅ F1-Score: {f1:.4f}")
    
    return model, acc, f1, y_pred, y_pred_proba

def train_gradient_boosting(X_train, y_train, X_val, y_val, class_weights):
    """Train Gradient Boosting model"""
    print("\n📈 Training Gradient Boosting...")
    
    sample_weights = np.array([class_weights[y] for y in y_train])
    
    model = GradientBoostingClassifier(
        n_estimators=200,
        learning_rate=0.1,
        max_depth=5,
        subsample=0.8,
        random_state=42
    )
    
    model.fit(X_train, y_train, sample_weight=sample_weights)
    
    # Predictions
    y_pred = model.predict(X_val)
    y_pred_proba = model.predict_proba(X_val)
    
    # Metrics
    acc = accuracy_score(y_val, y_pred)
    f1 = f1_score(y_val, y_pred, average='weighted')
    
    print(f"   ✅ Accuracy: {acc:.4f} ({acc*100:.2f}%)")
    print(f"   ✅ F1-Score: {f1:.4f}")
    
    return model, acc, f1, y_pred, y_pred_proba

# ---------------------------------------------------
# VISUALIZATION FUNCTIONS
# ---------------------------------------------------

def plot_class_distribution(y_train, y_val, save_path):
    """Plot class distribution comparison"""
    fig, axes = plt.subplots(1, 2, figsize=(12, 5))
    
    priority_names = ['Low Priority\n(0)', 'Medium Priority\n(1)', 'High Priority\n(2)']
    colors = ['#2ecc71', '#f39c12', '#e74c3c']
    
    # Training distribution
    train_counts = np.bincount(y_train.astype(int))
    bars1 = axes[0].bar(priority_names, train_counts, color=colors, edgecolor='black', linewidth=1.5)
    axes[0].set_title('Training Set Class Distribution', fontsize=14, fontweight='bold')
    axes[0].set_ylabel('Number of Samples', fontsize=12)
    axes[0].set_xlabel('Priority Level', fontsize=12)
    
    # Add value labels
    for bar, count in zip(bars1, train_counts):
        height = bar.get_height()
        axes[0].text(bar.get_x() + bar.get_width()/2., height + 10,
                    f'{count}\n({count/len(y_train)*100:.1f}%)',
                    ha='center', va='bottom', fontsize=10)
    
    # Validation distribution
    val_counts = np.bincount(y_val.astype(int))
    bars2 = axes[1].bar(priority_names, val_counts, color=colors, edgecolor='black', linewidth=1.5)
    axes[1].set_title('Validation Set Class Distribution', fontsize=14, fontweight='bold')
    axes[1].set_ylabel('Number of Samples', fontsize=12)
    axes[1].set_xlabel('Priority Level', fontsize=12)
    
    # Add value labels
    for bar, count in zip(bars2, val_counts):
        height = bar.get_height()
        axes[1].text(bar.get_x() + bar.get_width()/2., height + 5,
                    f'{count}\n({count/len(y_val)*100:.1f}%)',
                    ha='center', va='bottom', fontsize=10)
    
    plt.tight_layout()
    plt.savefig(save_path, dpi=150, bbox_inches='tight')
    plt.close()
    print(f"   ✅ Class distribution plot saved")

def plot_confusion_matrices(models_data, y_val, save_path):
    """Plot confusion matrices for all models"""
    n_models = len(models_data)
    fig, axes = plt.subplots(1, n_models, figsize=(5*n_models, 4))
    
    if n_models == 1:
        axes = [axes]
    
    priority_names = ['Low', 'Medium', 'High']
    
    for idx, model_info in enumerate(models_data):
        # Unpack based on length
        if len(model_info) == 5:  # (name, model, acc, f1, pred)
            model_name, _, _, _, y_pred = model_info
        else:  # (name, model, acc, f1, pred, proba)
            model_name, _, _, _, y_pred, _ = model_info
        
        cm = confusion_matrix(y_val, y_pred)
        
        # Create heatmap
        sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', ax=axes[idx],
                   xticklabels=priority_names, yticklabels=priority_names,
                   cbar_kws={'label': 'Count'})
        
        acc = accuracy_score(y_val, y_pred)
        axes[idx].set_title(f'{model_name}\nAccuracy: {acc*100:.2f}%', 
                           fontsize=12, fontweight='bold')
        axes[idx].set_xlabel('Predicted Priority', fontsize=10)
        axes[idx].set_ylabel('Actual Priority', fontsize=10)
    
    plt.tight_layout()
    plt.savefig(save_path, dpi=150, bbox_inches='tight')
    plt.close()
    print(f"   ✅ Confusion matrices saved")

def plot_model_comparison(models_data, save_path):
    """Plot model comparison bar charts"""
    model_names = []
    accuracies = []
    f1_scores = []
    
    for model_info in models_data:
        if len(model_info) == 5:  # (name, model, acc, f1, pred)
            model_name, _, acc, f1, _ = model_info
        else:  # (name, model, acc, f1, pred, proba)
            model_name, _, acc, f1, _, _ = model_info
        
        model_names.append(model_name)
        accuracies.append(acc)
        f1_scores.append(f1)
    
    fig, axes = plt.subplots(1, 2, figsize=(14, 6))
    
    # Accuracy comparison
    colors = ['#3498db', '#2ecc71', '#e74c3c']
    bars1 = axes[0].barh(model_names, accuracies, color=colors, edgecolor='black', linewidth=1.5)
    axes[0].set_xlabel('Accuracy Score', fontsize=12, fontweight='bold')
    axes[0].set_title('Model Accuracy Comparison', fontsize=14, fontweight='bold')
    axes[0].set_xlim([0.7, 1.0])
    
    # Add value labels
    for bar, acc in zip(bars1, accuracies):
        width = bar.get_width()
        axes[0].text(width + 0.01, bar.get_y() + bar.get_height()/2, 
                    f'{acc*100:.2f}%', ha='left', va='center', fontsize=10, fontweight='bold')
    
    # F1-Score comparison
    bars2 = axes[1].barh(model_names, f1_scores, color=colors, edgecolor='black', linewidth=1.5)
    axes[1].set_xlabel('F1-Score', fontsize=12, fontweight='bold')
    axes[1].set_title('Model F1-Score Comparison', fontsize=14, fontweight='bold')
    axes[1].set_xlim([0.7, 1.0])
    
    # Add value labels
    for bar, f1 in zip(bars2, f1_scores):
        width = bar.get_width()
        axes[1].text(width + 0.01, bar.get_y() + bar.get_height()/2, 
                    f'{f1:.4f}', ha='left', va='center', fontsize=10, fontweight='bold')
    
    plt.tight_layout()
    plt.savefig(save_path, dpi=150, bbox_inches='tight')
    plt.close()
    print(f"   ✅ Model comparison chart saved")

def plot_roc_curves(models_data, y_val, save_path):
    """Plot ROC curves for all models"""
    fig, axes = plt.subplots(1, 3, figsize=(15, 5))
    
    priority_names = ['Low Priority (0)', 'Medium Priority (1)', 'High Priority (2)']
    colors = ['#2ecc71', '#f39c12', '#e74c3c']
    linestyles = ['-', '--', '-.']
    
    for class_idx in range(3):
        ax = axes[class_idx]
        
        for idx, model_info in enumerate(models_data):
            # Unpack based on length
            if len(model_info) == 6:  # (name, model, acc, f1, pred, proba)
                model_name, _, _, _, _, y_pred_proba = model_info
            else:  # (name, model, acc, f1, pred)
                continue  # Skip if no probabilities
            
            fpr, tpr, _ = roc_curve(y_val == class_idx, y_pred_proba[:, class_idx])
            auc = roc_auc_score(y_val == class_idx, y_pred_proba[:, class_idx])
            ax.plot(fpr, tpr, label=f'{model_name} (AUC = {auc:.3f})', 
                   linewidth=2, color=colors[idx], linestyle=linestyles[idx])
        
        ax.plot([0, 1], [0, 1], 'k--', label='Random Classifier', linewidth=1, alpha=0.5)
        ax.set_xlabel('False Positive Rate', fontsize=11)
        ax.set_ylabel('True Positive Rate', fontsize=11)
        ax.set_title(f'ROC Curve - {priority_names[class_idx]}', fontsize=12, fontweight='bold')
        ax.legend(loc='lower right', fontsize=9)
        ax.grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig(save_path, dpi=150, bbox_inches='tight')
    plt.close()
    print(f"   ✅ ROC curves saved")

def plot_feature_importance(model, model_name, feature_cols, save_path, top_n=20):
    """Plot feature importance for tree-based models"""
    if hasattr(model, 'feature_importances_'):
        importances = model.feature_importances_
        
        # Ensure we have the right number of features
        if len(importances) != len(feature_cols):
            feature_cols = [f'Feature_{i}' for i in range(len(importances))]
        
        indices = np.argsort(importances)[::-1][:top_n]
        
        fig, ax = plt.subplots(figsize=(10, 8))
        
        colors = plt.cm.viridis(np.linspace(0, 1, top_n))
        bars = ax.barh(range(top_n), importances[indices], color=colors, edgecolor='black', linewidth=0.5)
        
        ax.set_yticks(range(top_n))
        ax.set_yticklabels([feature_cols[i][:30] for i in indices], fontsize=9)
        ax.set_xlabel('Importance Score', fontsize=12, fontweight='bold')
        ax.set_title(f'{model_name} - Top {top_n} Feature Importance', fontsize=14, fontweight='bold')
        ax.invert_yaxis()
        
        # Add value labels
        for i, (bar, val) in enumerate(zip(bars, importances[indices])):
            ax.text(val + 0.005, i, f'{val:.4f}', va='center', fontsize=8)
        
        plt.tight_layout()
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
        plt.close()
        print(f"   ✅ Feature importance plot saved for {model_name}")

def create_summary_plot(models_data, save_path):
    """Create a summary plot with all metrics"""
    fig, ax = plt.subplots(figsize=(10, 6))
    
    model_names = []
    accuracies = []
    f1_scores = []
    
    for model_info in models_data:
        if len(model_info) == 5:  # (name, model, acc, f1, pred)
            model_name, _, acc, f1, _ = model_info
        else:  # (name, model, acc, f1, pred, proba)
            model_name, _, acc, f1, _, _ = model_info
        
        model_names.append(model_name)
        accuracies.append(acc * 100)
        f1_scores.append(f1 * 100)
    
    x = np.arange(len(model_names))
    width = 0.35
    
    bars1 = ax.bar(x - width/2, accuracies, width, label='Accuracy', color='#3498db', edgecolor='black')
    bars2 = ax.bar(x + width/2, f1_scores, width, label='F1-Score', color='#2ecc71', edgecolor='black')
    
    ax.set_xlabel('Models', fontsize=12, fontweight='bold')
    ax.set_ylabel('Score (%)', fontsize=12, fontweight='bold')
    ax.set_title('Model Performance Comparison', fontsize=14, fontweight='bold')
    ax.set_xticks(x)
    ax.set_xticklabels(model_names, fontsize=11)
    ax.legend(fontsize=11)
    ax.set_ylim([70, 100])
    ax.grid(True, alpha=0.3, axis='y')
    
    # Add value labels on bars
    for bars in [bars1, bars2]:
        for bar in bars:
            height = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2., height + 0.5,
                   f'{height:.1f}%', ha='center', va='bottom', fontsize=9, fontweight='bold')
    
    plt.tight_layout()
    plt.savefig(save_path, dpi=150, bbox_inches='tight')
    plt.close()
    print(f"   ✅ Summary plot saved")

def create_detailed_report(models_data, best_model_data, best_name, y_train, y_val, feature_cols, save_path):
    """Create detailed text report"""
    # Extract best model predictions
    if len(best_model_data) == 5:  # (name, model, acc, f1, pred)
        _, _, best_acc, best_f1, best_pred = best_model_data
    else:  # (name, model, acc, f1, pred, proba)
        _, _, best_acc, best_f1, best_pred, _ = best_model_data
    
    with open(save_path, 'w', encoding='utf-8') as f:
        f.write("=" * 80 + "\n")
        f.write("ACADEMIC PRIORITY PREDICTION - MODEL TRAINING REPORT\n")
        f.write("=" * 80 + "\n\n")
        
        # Dataset summary
        f.write("📊 DATASET SUMMARY\n")
        f.write("-" * 40 + "\n")
        f.write(f"Training samples: {len(y_train)}\n")
        f.write(f"Validation samples: {len(y_val)}\n")
        f.write(f"Number of features: {len(feature_cols)}\n")
        f.write(f"Number of classes: 3 (Low, Medium, High)\n\n")
        
        # Class distribution
        f.write("📈 CLASS DISTRIBUTION\n")
        f.write("-" * 40 + "\n")
        train_counts = np.bincount(y_train.astype(int))
        val_counts = np.bincount(y_val.astype(int))
        for i, name in enumerate(['Low', 'Medium', 'High']):
            f.write(f"{name} Priority:\n")
            f.write(f"  - Training: {train_counts[i]} ({train_counts[i]/len(y_train)*100:.1f}%)\n")
            f.write(f"  - Validation: {val_counts[i]} ({val_counts[i]/len(y_val)*100:.1f}%)\n")
        f.write("\n")
        
        # Model comparison
        f.write("🏆 MODEL PERFORMANCE COMPARISON\n")
        f.write("-" * 40 + "\n")
        f.write(f"{'Model':<20} {'Accuracy':<12} {'F1-Score':<12}\n")
        f.write("-" * 50 + "\n")
        
        for model_info in models_data:
            if len(model_info) == 5:
                model_name, _, acc, f1, _ = model_info
            else:
                model_name, _, acc, f1, _, _ = model_info
            f.write(f"{model_name:<20} {acc*100:>6.2f}%{'':<4} {f1:>8.4f}\n")
        f.write("\n")
        
        # Best model details
        f.write(f"⭐ BEST MODEL: {best_name}\n")
        f.write("-" * 40 + "\n")
        f.write(f"Validation Accuracy: {best_acc*100:.2f}%\n")
        f.write(f"Validation F1-Score: {best_f1:.4f}\n\n")
        
        # Classification report for best model
        f.write("📋 DETAILED CLASSIFICATION REPORT\n")
        f.write("-" * 40 + "\n")
        report = classification_report(y_val, best_pred, 
                                      target_names=['Low Priority', 'Medium Priority', 'High Priority'],
                                      output_dict=True)
        
        f.write(f"{'Class':<15} {'Precision':<12} {'Recall':<12} {'F1-Score':<12} {'Support':<10}\n")
        f.write("-" * 65 + "\n")
        for class_name in ['Low Priority', 'Medium Priority', 'High Priority']:
            metrics = report[class_name]
            f.write(f"{class_name:<15} {metrics['precision']*100:>6.2f}%{'':<4} "
                   f"{metrics['recall']*100:>6.2f}%{'':<4} "
                   f"{metrics['f1-score']*100:>6.2f}%{'':<4} "
                   f"{metrics['support']:<10}\n")
        
        f.write("\n")
        f.write(f"{'Accuracy':<15} {report['accuracy']*100:>6.2f}%{'':<31}\n")
        f.write(f"{'Macro Avg':<15} {report['macro avg']['precision']*100:>6.2f}%{'':<4} "
               f"{report['macro avg']['recall']*100:>6.2f}%{'':<4} "
               f"{report['macro avg']['f1-score']*100:>6.2f}%\n")
        
        # Confusion matrix
        f.write("\n📊 CONFUSION MATRIX\n")
        f.write("-" * 40 + "\n")
        cm = confusion_matrix(y_val, best_pred)
        f.write("                 Predicted\n")
        f.write("                 Low   Medium  High\n")
        f.write(f"Actual Low      {cm[0,0]:>4}   {cm[0,1]:>4}    {cm[0,2]:>4}\n")
        f.write(f"      Medium    {cm[1,0]:>4}   {cm[1,1]:>4}    {cm[1,2]:>4}\n")
        f.write(f"      High      {cm[2,0]:>4}   {cm[2,1]:>4}    {cm[2,2]:>4}\n")
        
        # Performance summary
        f.write("\n📈 PERFORMANCE SUMMARY\n")
        f.write("-" * 40 + "\n")
        f.write(f"Overall Accuracy: {best_acc*100:.2f}%\n")
        f.write(f"Macro F1-Score: {report['macro avg']['f1-score']*100:.2f}%\n")
        f.write(f"Weighted F1-Score: {best_f1*100:.2f}%\n")
        
        f.write("\n" + "=" * 80 + "\n")
        f.write("END OF REPORT\n")
        f.write("=" * 80 + "\n")
    
    print(f"   ✅ Detailed report saved")

# ---------------------------------------------------
# SAVE MODEL
# ---------------------------------------------------

def save_all(model, scaler, feature_cols, model_metadata):
    """Save all model artifacts"""
    print("\n💾 Saving model artifacts...")
    
    joblib.dump(model, TRAINED_MODELS_PATH / "xgboost_model.pkl")
    joblib.dump(model, TRAINED_MODELS_PATH / "academic_priority_model.pkl")
    joblib.dump(scaler, TRAINED_MODELS_PATH / "scaler.pkl")
    joblib.dump(feature_cols, TRAINED_MODELS_PATH / "feature_columns.pkl")
    
    with open(TRAINED_MODELS_PATH / "model_metadata.json", "w") as f:
        json.dump(model_metadata, f, indent=2)
    
    print("✅ All models and artifacts saved successfully")

# ---------------------------------------------------
# MAIN
# ---------------------------------------------------

def main():
    print("\n" + "=" * 60)
    print("🎯 ACADEMIC PRIORITY MODEL TRAINING")
    print("WITH COMPLETE VISUALIZATIONS")
    print("=" * 60)
    
    cleanup_old_models()
    
    # Load data
    X_train, X_val, X_test, y_train, y_val, feature_cols = load_data()
    
    # Scale data
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_val_scaled = scaler.transform(X_val)
    X_test_scaled = scaler.transform(X_test)
    
    # Plot class distribution
    print("\n📊 Generating initial visualizations...")
    plot_class_distribution(y_train, y_val, VIZ_PATH / 'class_distribution.png')
    
    # Get class weights
    class_weights = get_class_weights(y_train)
    
    # Train all models
    print("\n" + "=" * 50)
    print("TRAINING MODELS")
    print("=" * 50)
    
    results = []
    
    # XGBoost
    xgb_model, xgb_acc, xgb_f1, xgb_pred, xgb_proba = train_xgboost(
        X_train_scaled, y_train, X_val_scaled, y_val, class_weights
    )
    results.append(("XGBoost", xgb_model, xgb_acc, xgb_f1, xgb_pred, xgb_proba))
    
    # Random Forest
    rf_model, rf_acc, rf_f1, rf_pred, rf_proba = train_random_forest(
        X_train_scaled, y_train, X_val_scaled, y_val, class_weights
    )
    results.append(("Random Forest", rf_model, rf_acc, rf_f1, rf_pred, rf_proba))
    
    # Gradient Boosting
    gb_model, gb_acc, gb_f1, gb_pred, gb_proba = train_gradient_boosting(
        X_train_scaled, y_train, X_val_scaled, y_val, class_weights
    )
    results.append(("Gradient Boosting", gb_model, gb_acc, gb_f1, gb_pred, gb_proba))
    
    # Find best model
    best_idx = np.argmax([r[2] for r in results])
    best_model_data = results[best_idx]
    best_name = best_model_data[0]
    best_model = best_model_data[1]
    best_acc = best_model_data[2]
    best_f1 = best_model_data[3]
    
    print("\n" + "=" * 50)
    print(f"🏆 BEST MODEL: {best_name}")
    print(f"   Accuracy: {best_acc*100:.2f}%")
    print(f"   F1-Score: {best_f1:.4f}")
    print("=" * 50)
    
    # Generate all visualizations
    print("\n📈 Generating comprehensive visualizations...")
    
    # Confusion matrices
    plot_confusion_matrices(results, y_val, VIZ_PATH / 'confusion_matrices.png')
    
    # Model comparison
    plot_model_comparison(results, VIZ_PATH / 'model_comparison.png')
    
    # ROC curves
    plot_roc_curves(results, y_val, VIZ_PATH / 'roc_curves.png')
    
    # Summary plot
    create_summary_plot(results, VIZ_PATH / 'summary_plot.png')
    
    # Feature importance for best model
    plot_feature_importance(best_model, best_name, feature_cols, 
                           VIZ_PATH / f'{best_name.lower().replace(" ", "_")}_feature_importance.png')
    
    # Create detailed report
    create_detailed_report(results, best_model_data, best_name, y_train, y_val, feature_cols,
                          TRAINED_MODELS_PATH / 'training_report.txt')
    
    # Save everything
    model_metadata = {
        'best_model': best_name,
        'accuracy': float(best_acc),
        'f1_score': float(best_f1),
        'num_features': X_train.shape[1],
        'num_classes': 3,
        'class_weights': class_weights
    }
    
    save_all(best_model, scaler, feature_cols, model_metadata)
    
    # Print final summary
    print("\n" + "=" * 60)
    print("✅ TRAINING COMPLETED SUCCESSFULLY!")
    print("=" * 60)
    print(f"\n📁 All artifacts saved in: {TRAINED_MODELS_PATH}")
    print(f"📊 Visualizations saved in: {VIZ_PATH}")
    print(f"\n📈 Generated Visualizations:")
    print(f"   ✅ Class Distribution Plot")
    print(f"   ✅ Confusion Matrices (all models)")
    print(f"   ✅ Model Comparison Chart")
    print(f"   ✅ ROC Curves")
    print(f"   ✅ Summary Performance Plot")
    print(f"   ✅ Feature Importance Plot")
    print(f"   ✅ Detailed Text Report")
    print(f"\n🎯 Best Model: {best_name}")
    print(f"   Accuracy: {best_acc*100:.2f}%")
    print(f"   F1-Score: {best_f1:.4f}")
    print("=" * 60)

# ---------------------------------------------------

if __name__ == "__main__":
    main()