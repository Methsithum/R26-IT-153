"""
Complete Model Training with Class Weights for Imbalanced Data
Author: Your Name
Date: 2026-05-05
Purpose: Train multiple models with class weights for priority prediction
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from xgboost import XGBClassifier
from sklearn.metrics import (
    classification_report, 
    confusion_matrix, 
    accuracy_score, 
    f1_score,
    recall_score,
    precision_score,
    roc_auc_score,
    roc_curve
)
from sklearn.model_selection import GridSearchCV, cross_val_score, StratifiedKFold
from sklearn.preprocessing import label_binarize
import joblib
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
import json
import warnings
import os
warnings.filterwarnings('ignore')

# Import preprocessor
import sys
sys.path.append(str(Path(__file__).resolve().parent))
from data_preprocessing import AcademicDataPreprocessor

# Set paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
MODEL_PATH = BASE_DIR / "trained-models" / "Study-Planner"
os.makedirs(MODEL_PATH, exist_ok=True)

class PriorityModelTrainer:
    """
    Complete model training pipeline with class weights
    """
    
    def __init__(self, class_weights=None):
        self.class_weights = class_weights
        self.models = {}
        self.trained_models = {}
        self.results = {}
        self.best_model = None
        self.best_model_name = None
        
    def initialize_models(self):
        """Initialize all models with class weights"""
        print("\n" + "="*60)
        print("INITIALIZING MODELS")
        print("="*60)
        
        # 1. Random Forest (Primary)
        self.models['Random Forest'] = RandomForestClassifier(
            n_estimators=200,
            max_depth=12,
            min_samples_split=5,
            min_samples_leaf=2,
            class_weight=self.class_weights,
            random_state=42,
            n_jobs=-1
        )
        print("✓ Random Forest initialized")
        
        # 2. XGBoost (Secondary)
        # Convert class weights to sample weights for XGBoost
        self.models['XGBoost'] = XGBClassifier(
            n_estimators=200,
            max_depth=8,
            learning_rate=0.1,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            use_label_encoder=False,
            eval_metric='mlogloss'
        )
        print("✓ XGBoost initialized")
        
        # 3. Gradient Boosting
        self.models['Gradient Boosting'] = GradientBoostingClassifier(
            n_estimators=200,
            max_depth=6,
            learning_rate=0.1,
            subsample=0.8,
            random_state=42
        )
        print("✓ Gradient Boosting initialized")
        
        # 4. Logistic Regression (Baseline)
        self.models['Logistic Regression'] = LogisticRegression(
            max_iter=1000,
            class_weight=self.class_weights,
            random_state=42
        )
        print("✓ Logistic Regression initialized")
        
        # 5. SVM (Optional - slower but can be good)
        # self.models['SVM'] = SVC(
        #     kernel='rbf',
        #     class_weight=self.class_weights,
        #     probability=True,
        #     random_state=42
        # )
        # print("✓ SVM initialized")
        
        print(f"\nTotal models: {len(self.models)}")
        
        return self.models
    
    def train_with_class_weights(self, X_train, y_train):
        """Train models with class weights"""
        print("\n" + "="*60)
        print("TRAINING MODELS")
        print("="*60)
        
        for name, model in self.models.items():
            print(f"\n▶ Training {name}...")
            
            # Special handling for XGBoost (uses sample weights)
            if name == 'XGBoost':
                # Convert class weights to sample weights
                sample_weights = np.array([self.class_weights[y] for y in y_train])
                model.fit(X_train, y_train, sample_weight=sample_weights)
            else:
                model.fit(X_train, y_train)
            
            self.trained_models[name] = model
            print(f"  ✓ {name} training completed")
        
        return self.trained_models
    
    def evaluate_models(self, X_test, y_test):
        """Evaluate all trained models comprehensively"""
        print("\n" + "="*60)
        print("MODEL EVALUATION")
        print("="*60)
        
        for name, model in self.trained_models.items():
            print(f"\n{'='*40}")
            print(f"Model: {name}")
            print(f"{'='*40}")
            
            # Predictions
            y_pred = model.predict(X_test)
            y_pred_proba = model.predict_proba(X_test) if hasattr(model, 'predict_proba') else None
            
            # Calculate metrics
            accuracy = accuracy_score(y_test, y_pred)
            weighted_f1 = f1_score(y_test, y_pred, average='weighted')
            macro_f1 = f1_score(y_test, y_pred, average='macro')
            
            # Per-class metrics
            precision_per_class = precision_score(y_test, y_pred, average=None)
            recall_per_class = recall_score(y_test, y_pred, average=None)
            f1_per_class = f1_score(y_test, y_pred, average=None)
            
            # Store results
            self.results[name] = {
                'accuracy': accuracy,
                'weighted_f1': weighted_f1,
                'macro_f1': macro_f1,
                'precision_per_class': precision_per_class.tolist(),
                'recall_per_class': recall_per_class.tolist(),
                'f1_per_class': f1_per_class.tolist(),
                'predictions': y_pred,
                'probabilities': y_pred_proba
            }
            
            # Print results
            print(f"\n📊 Overall Metrics:")
            print(f"  Accuracy:    {accuracy:.4f}")
            print(f"  Weighted F1: {weighted_f1:.4f}")
            print(f"  Macro F1:    {macro_f1:.4f}")
            
            print(f"\n📈 Per-Class Metrics:")
            print(f"  {'Class':<10} {'Precision':<12} {'Recall':<12} {'F1-Score':<12}")
            print(f"  {'-'*46}")
            class_names = ['Low (0)', 'Medium (1)', 'High (2)']
            for i, name_class in enumerate(class_names):
                print(f"  {name_class:<10} {precision_per_class[i]:<12.4f} {recall_per_class[i]:<12.4f} {f1_per_class[i]:<12.4f}")
            
            # Critical: High priority recall
            high_recall = recall_per_class[2]
            print(f"\n⚠️  CRITICAL METRIC - High Priority Recall: {high_recall:.4f}")
            if high_recall < 0.60:
                print(f"  ⚠️  Warning: High priority recall is low ({high_recall:.2%})")
                print(f"     Consider adjusting class weights or using SMOTE")
            
            # Classification report
            print(f"\n📋 Detailed Classification Report:")
            print(classification_report(y_test, y_pred, target_names=class_names))
        
        return self.results
    
    def select_best_model(self, metric='weighted_f1'):
        """Select best model based on specified metric"""
        print("\n" + "="*60)
        print("BEST MODEL SELECTION")
        print("="*60)
        
        # Compare models
        best_score = -1
        best_name = None
        
        for name, results in self.results.items():
            score = results[metric]
            print(f"  {name}: {metric} = {score:.4f}")
            
            if score > best_score:
                best_score = score
                best_name = name
        
        self.best_model = self.trained_models[best_name]
        self.best_model_name = best_name
        
        print(f"\n🏆 Best Model: {best_name}")
        print(f"   {metric}: {best_score:.4f}")
        
        # Show best model's performance on critical metrics
        best_results = self.results[best_name]
        print(f"\n📊 Best Model Performance:")
        print(f"  Accuracy:    {best_results['accuracy']:.4f}")
        print(f"  Weighted F1: {best_results['weighted_f1']:.4f}")
        print(f"  High Recall: {best_results['recall_per_class'][2]:.4f}")
        
        return self.best_model
    
    def hyperparameter_tuning(self, X_train, y_train, model_name='Random Forest'):
        """Perform hyperparameter tuning for the best model"""
        print("\n" + "="*60)
        print(f"HYPERPARAMETER TUNING - {model_name}")
        print("="*60)
        
        if model_name == 'Random Forest':
            param_grid = {
                'n_estimators': [100, 200, 300],
                'max_depth': [10, 12, 15, None],
                'min_samples_split': [2, 5, 10],
                'min_samples_leaf': [1, 2, 4],
                'max_features': ['sqrt', 'log2']
            }
            
            base_model = RandomForestClassifier(
                class_weight=self.class_weights,
                random_state=42,
                n_jobs=-1
            )
            
        elif model_name == 'XGBoost':
            param_grid = {
                'n_estimators': [100, 200, 300],
                'max_depth': [6, 8, 10],
                'learning_rate': [0.05, 0.1, 0.2],
                'subsample': [0.7, 0.8, 0.9],
                'colsample_bytree': [0.7, 0.8, 0.9]
            }
            
            base_model = XGBClassifier(
                random_state=42,
                use_label_encoder=False,
                eval_metric='mlogloss'
            )
        else:
            print(f"  No tuning defined for {model_name}")
            return None
        
        # Perform grid search with cross-validation
        cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        
        grid_search = GridSearchCV(
            base_model, 
            param_grid, 
            cv=cv,
            scoring='f1_weighted',
            n_jobs=-1,
            verbose=1
        )
        
        print(f"\n  Searching {len(param_grid)} parameter combinations...")
        grid_search.fit(X_train, y_train)
        
        print(f"\n✅ Best Parameters:")
        for param, value in grid_search.best_params_.items():
            print(f"  {param}: {value}")
        
        print(f"\n  Best CV Score: {grid_search.best_score_:.4f}")
        
        # Update best model
        self.best_model = grid_search.best_estimator_
        
        return self.best_model
    
    def cross_validate_best_model(self, X, y, cv=5):
        """Perform cross-validation on the best model"""
        print("\n" + "="*60)
        print("CROSS-VALIDATION")
        print("="*60)
        
        cv_strategy = StratifiedKFold(n_splits=cv, shuffle=True, random_state=42)
        
        # Calculate multiple metrics
        accuracy_scores = []
        f1_scores = []
        high_recall_scores = []
        
        for train_idx, val_idx in cv_strategy.split(X, y):
            X_train_fold, X_val_fold = X[train_idx], X[val_idx]
            y_train_fold, y_val_fold = y[train_idx], y[val_idx]
            
            # Train model
            model_copy = self._clone_model(self.best_model)
            
            if self.best_model_name == 'XGBoost':
                sample_weights = np.array([self.class_weights[y] for y in y_train_fold])
                model_copy.fit(X_train_fold, y_train_fold, sample_weight=sample_weights)
            else:
                model_copy.fit(X_train_fold, y_train_fold)
            
            # Predict
            y_pred = model_copy.predict(X_val_fold)
            
            # Calculate metrics
            accuracy_scores.append(accuracy_score(y_val_fold, y_pred))
            f1_scores.append(f1_score(y_val_fold, y_pred, average='weighted'))
            
            # High priority recall
            cm = confusion_matrix(y_val_fold, y_pred)
            if cm.shape == (3, 3):
                high_recall = cm[2, 2] / (cm[2, :].sum()) if cm[2, :].sum() > 0 else 0
                high_recall_scores.append(high_recall)
        
        print(f"\n📊 Cross-Validation Results ({cv}-fold):")
        print(f"  Accuracy:    {np.mean(accuracy_scores):.4f} (+/- {np.std(accuracy_scores):.4f})")
        print(f"  Weighted F1: {np.mean(f1_scores):.4f} (+/- {np.std(f1_scores):.4f})")
        if high_recall_scores:
            print(f"  High Recall: {np.mean(high_recall_scores):.4f} (+/- {np.std(high_recall_scores):.4f})")
        
        return {
            'accuracy_mean': np.mean(accuracy_scores),
            'accuracy_std': np.std(accuracy_scores),
            'f1_mean': np.mean(f1_scores),
            'f1_std': np.std(f1_scores),
            'high_recall_mean': np.mean(high_recall_scores) if high_recall_scores else None,
            'high_recall_std': np.std(high_recall_scores) if high_recall_scores else None
        }
    
    def _clone_model(self, model):
        """Clone model for cross-validation"""
        from sklearn.base import clone
        return clone(model)
    
    def plot_confusion_matrix(self, y_test, y_pred, model_name):
        """Plot confusion matrix"""
        cm = confusion_matrix(y_test, y_pred)
        
        plt.figure(figsize=(8, 6))
        sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
                    xticklabels=['Low', 'Medium', 'High'],
                    yticklabels=['Low', 'Medium', 'High'])
        plt.title(f'Confusion Matrix - {model_name}', fontsize=14, fontweight='bold')
        plt.ylabel('Actual Label', fontsize=12)
        plt.xlabel('Predicted Label', fontsize=12)
        
        # Add annotations
        for i in range(3):
            for j in range(3):
                if i == j:
                    plt.text(j+0.5, i+0.5, f'{cm[i, j]}', 
                            ha='center', va='center', color='white', fontweight='bold')
        
        plt.tight_layout()
        
        # Save plot
        plot_path = MODEL_PATH / f"{model_name.replace(' ', '_')}_confusion_matrix.png"
        plt.savefig(plot_path, dpi=300, bbox_inches='tight')
        plt.show()
        print(f"✓ Confusion matrix saved: {plot_path}")
        
        return cm
    
    def plot_feature_importance(self, feature_names, model_name, top_n=20):
        """Plot feature importance for tree-based models"""
        if hasattr(self.best_model, 'feature_importances_'):
            importances = self.best_model.feature_importances_
            
            # Create dataframe
            feature_importance_df = pd.DataFrame({
                'feature': feature_names,
                'importance': importances
            }).sort_values('importance', ascending=False)
            
            # Plot top N features
            plt.figure(figsize=(12, 8))
            colors = plt.cm.Blues(np.linspace(0.3, 0.9, top_n))
            bars = plt.barh(range(top_n), feature_importance_df.head(top_n)['importance'].values, color=colors)
            plt.yticks(range(top_n), feature_importance_df.head(top_n)['feature'].values)
            plt.xlabel('Importance', fontsize=12)
            plt.title(f'Top {top_n} Feature Importances - {model_name}', fontsize=14, fontweight='bold')
            plt.gca().invert_yaxis()
            
            # Add value labels
            for i, bar in enumerate(bars):
                width = bar.get_width()
                plt.text(width + 0.002, bar.get_y() + bar.get_height()/2, 
                        f'{width:.3f}', ha='left', va='center', fontsize=9)
            
            plt.tight_layout()
            
            # Save plot
            plot_path = MODEL_PATH / f"{model_name.replace(' ', '_')}_feature_importance.png"
            plt.savefig(plot_path, dpi=300, bbox_inches='tight')
            plt.show()
            print(f"✓ Feature importance plot saved: {plot_path}")
            
            # Save feature importance to CSV
            feature_importance_df.to_csv(MODEL_PATH / "feature_importance.csv", index=False)
            print(f"✓ Feature importance saved: {MODEL_PATH / 'feature_importance.csv'}")
            
            return feature_importance_df
        else:
            print("  Model does not have feature_importances_ attribute")
            return None
    
    def plot_roc_curves(self, X_test, y_test, model_name):
        """Plot ROC curves for multi-class"""
        if hasattr(self.best_model, 'predict_proba'):
            y_pred_proba = self.best_model.predict_proba(X_test)
            
            # Binarize the output
            y_test_bin = label_binarize(y_test, classes=[0, 1, 2])
            n_classes = 3
            
            # Compute ROC curve and ROC area for each class
            fpr = dict()
            tpr = dict()
            roc_auc = dict()
            
            for i in range(n_classes):
                fpr[i], tpr[i], _ = roc_curve(y_test_bin[:, i], y_pred_proba[:, i])
                roc_auc[i] = roc_auc_score(y_test_bin[:, i], y_pred_proba[:, i])
            
            # Plot all ROC curves
            plt.figure(figsize=(10, 8))
            colors = ['blue', 'green', 'red']
            class_names = ['Low Priority', 'Medium Priority', 'High Priority']
            
            for i, color, name in zip(range(n_classes), colors, class_names):
                plt.plot(fpr[i], tpr[i], color=color, lw=2,
                        label=f'{name} (AUC = {roc_auc[i]:.2f})')
            
            plt.plot([0, 1], [0, 1], 'k--', lw=2)
            plt.xlim([0.0, 1.0])
            plt.ylim([0.0, 1.05])
            plt.xlabel('False Positive Rate', fontsize=12)
            plt.ylabel('True Positive Rate', fontsize=12)
            plt.title(f'ROC Curves - {model_name}', fontsize=14, fontweight='bold')
            plt.legend(loc="lower right")
            plt.grid(True, alpha=0.3)
            
            # Save plot
            plot_path = MODEL_PATH / f"{model_name.replace(' ', '_')}_roc_curves.png"
            plt.savefig(plot_path, dpi=300, bbox_inches='tight')
            plt.show()
            print(f"✓ ROC curves saved: {plot_path}")
            
            return roc_auc
        else:
            print("  Model does not have predict_proba method")
            return None
    
    def save_best_model(self):
        """Save the best model and its metadata"""
        print("\n" + "="*60)
        print("SAVING BEST MODEL")
        print("="*60)
        
        # Save model
        model_file = MODEL_PATH / "academic_priority_model.pkl"
        joblib.dump(self.best_model, model_file)
        print(f"✓ Model saved: {model_file}")
        
        # Save model metadata
        metadata = {
            'model_name': self.best_model_name,
            'class_weights': self.class_weights,
            'performance': self.results[self.best_model_name],
            'training_date': pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        # Convert numpy arrays to lists for JSON serialization
        for key, value in metadata['performance'].items():
            if isinstance(value, np.ndarray):
                metadata['performance'][key] = value.tolist()
            elif isinstance(value, np.generic):
                metadata['performance'][key] = value.item()
        
        metadata_file = MODEL_PATH / "model_metadata.json"
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=4, default=str)
        print(f"✓ Model metadata saved: {metadata_file}")
        
        # Save model summary
        summary = f"""
{'='*60}
MODEL SUMMARY
{'='*60}

Model: {self.best_model_name}
Training Date: {metadata['training_date']}

Performance Metrics:
- Accuracy: {self.results[self.best_model_name]['accuracy']:.4f}
- Weighted F1: {self.results[self.best_model_name]['weighted_f1']:.4f}
- Macro F1: {self.results[self.best_model_name]['macro_f1']:.4f}

Per-Class Performance:
- Low (0):    Precision={self.results[self.best_model_name]['precision_per_class'][0]:.4f}, 
              Recall={self.results[self.best_model_name]['recall_per_class'][0]:.4f}
- Medium (1): Precision={self.results[self.best_model_name]['precision_per_class'][1]:.4f}, 
              Recall={self.results[self.best_model_name]['recall_per_class'][1]:.4f}
- High (2):   Precision={self.results[self.best_model_name]['precision_per_class'][2]:.4f}, 
              Recall={self.results[self.best_model_name]['recall_per_class'][2]:.4f}

Class Weights Used:
- Low: {self.class_weights[0]:.3f}
- Medium: {self.class_weights[1]:.3f}
- High: {self.class_weights[2]:.3f}

{'='*60}
"""
        
        summary_file = MODEL_PATH / "model_summary.txt"
        with open(summary_file, 'w') as f:
            f.write(summary)
        print(f"✓ Model summary saved: {summary_file}")
    
    def run_training_pipeline(self, X_train, X_test, y_train, y_test, feature_names, perform_tuning=False):
        """Run complete training pipeline"""
        print("\n" + "="*60)
        print("COMPLETE MODEL TRAINING PIPELINE")
        print("="*60)
        
        # Step 1: Initialize models
        self.initialize_models()
        
        # Step 2: Train models
        self.train_with_class_weights(X_train, y_train)
        
        # Step 3: Evaluate models
        self.evaluate_models(X_test, y_test)
        
        # Step 4: Select best model
        self.select_best_model(metric='weighted_f1')
        
        # Step 5: Hyperparameter tuning (optional)
        if perform_tuning:
            self.hyperparameter_tuning(X_train, y_train, self.best_model_name)
            # Re-evaluate tuned model
            y_pred_tuned = self.best_model.predict(X_test)
            print(f"\n📊 Tuned Model Performance:")
            print(f"  Accuracy: {accuracy_score(y_test, y_pred_tuned):.4f}")
            print(f"  Weighted F1: {f1_score(y_test, y_pred_tuned, average='weighted'):.4f}")
        
        # Step 6: Cross-validation
        X_combined = np.vstack([X_train, X_test])
        y_combined = np.hstack([y_train, y_test])
        cv_results = self.cross_validate_best_model(X_combined, y_combined, cv=5)
        
        # Step 7: Visualizations
        y_pred = self.results[self.best_model_name]['predictions']
        
        # Confusion matrix
        self.plot_confusion_matrix(y_test, y_pred, self.best_model_name)
        
        # Feature importance
        self.plot_feature_importance(feature_names, self.best_model_name, top_n=20)
        
        # ROC curves
        self.plot_roc_curves(X_test, y_test, self.best_model_name)
        
        # Step 8: Save model
        self.save_best_model()
        
        print("\n" + "="*60)
        print("✅ TRAINING PIPELINE COMPLETED SUCCESSFULLY!")
        print("="*60)
        
        return self.best_model


def main():
    """Main execution function"""
    print("="*60)
    print("ACADEMIC PRIORITY PREDICTION SYSTEM")
    print("="*60)
    print("\n🚀 Starting complete training pipeline...")
    
    # Step 1: Preprocess data
    print("\n[Phase 1] Data Preprocessing")
    print("-" * 40)
    preprocessor = AcademicDataPreprocessor()
    X_train, X_test, y_train, y_test, class_weights = preprocessor.run_preprocessing(
        use_smote=False,
        use_scaling=False
    )
    
    # Step 2: Train models
    print("\n[Phase 2] Model Training")
    print("-" * 40)
    trainer = PriorityModelTrainer(class_weights=class_weights)
    
    # Step 3: Run training pipeline
    best_model = trainer.run_training_pipeline(
        X_train, X_test, y_train, y_test,
        feature_names=preprocessor.feature_columns,
        perform_tuning=True  # Set to True for hyperparameter tuning
    )
    
    print("\n🎉 Training complete! Model ready for deployment.")
    
    return trainer, best_model



if __name__ == "__main__":
    trainer, best_model = main()