# train_model_improved.py - අධික accuracy එකක් සඳහා

import pandas as pd
import numpy as np
import os
import json
import joblib
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.preprocessing import StandardScaler
from imblearn.over_sampling import SMOTE
import warnings
warnings.filterwarnings('ignore')

print("=" * 60)
print("STEP 2: Training ML Model (IMPROVED VERSION)")
print("=" * 60)

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATASETS_DIR = os.path.join(BACKEND_DIR, 'datasets')
MODELS_DIR = os.path.join(BACKEND_DIR, 'trained-models')
os.makedirs(MODELS_DIR, exist_ok=True)

# Load combined dataset
combined_path = os.path.join(DATASETS_DIR, 'combined_dataset.csv')

if not os.path.exists(combined_path):
    print("❌ combined_dataset.csv not found!")
    print("   Please run convert_to_csv.py first.")
    exit()

df = pd.read_csv(combined_path)
print(f"✅ Loaded {len(df)} samples from combined_dataset.csv")

# Separate features and labels
X = df.drop('label', axis=1).values
y = df['label'].values

print(f"📊 Feature dimension: {X.shape[1]}")
print(f"📊 Original labels: {dict(zip(*np.unique(y, return_counts=True)))}")

# ============================================
# IMPROVEMENT 1: Scale features
# ============================================
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)
print(f"\n✅ Features scaled (mean=0, std=1)")

# ============================================
# IMPROVEMENT 2: Handle class imbalance with SMOTE
# ============================================
smote = SMOTE(random_state=42)
X_resampled, y_resampled = smote.fit_resample(X_scaled, y)
print(f"✅ SMOTE applied - New samples: {len(X_resampled)}")
print(f"📊 Balanced labels: {dict(zip(*np.unique(y_resampled, return_counts=True)))}")

# ============================================
# IMPROVEMENT 3: Better split with more data
# ============================================
X_train, X_test, y_train, y_test = train_test_split(
    X_resampled, y_resampled, test_size=0.2, random_state=42, stratify=y_resampled
)

print(f"\n📊 Training samples: {len(X_train)}")
print(f"📊 Testing samples: {len(X_test)}")

# ============================================
# IMPROVEMENT 4: Try different models + Hyperparameter tuning
# ============================================

print("\n🎯 Training models with hyperparameter tuning...")

# Model 1: Random Forest with best parameters
rf_params = {
    'n_estimators': [100, 200, 300],
    'max_depth': [10, 15, 20, None],
    'min_samples_split': [2, 5, 10],
    'min_samples_leaf': [1, 2, 4]
}

print("   🔍 Finding best Random Forest parameters...")
rf_grid = GridSearchCV(
    RandomForestClassifier(random_state=42, n_jobs=-1),
    rf_params,
    cv=3,
    scoring='accuracy',
    n_jobs=-1,
    verbose=0
)
rf_grid.fit(X_train, y_train)
best_rf = rf_grid.best_estimator_
print(f"   ✅ Best RF params: {rf_grid.best_params_}")
print(f"   ✅ Best RF CV accuracy: {rf_grid.best_score_*100:.2f}%")

# Model 2: Gradient Boosting (often better for this type of data)
gb_params = {
    'n_estimators': [100, 200],
    'learning_rate': [0.05, 0.1, 0.2],
    'max_depth': [3, 5, 7]
}

print("   🔍 Finding best Gradient Boosting parameters...")
gb_grid = GridSearchCV(
    GradientBoostingClassifier(random_state=42),
    gb_params,
    cv=3,
    scoring='accuracy',
    n_jobs=-1,
    verbose=0
)
gb_grid.fit(X_train, y_train)
best_gb = gb_grid.best_estimator_
print(f"   ✅ Best GB params: {gb_grid.best_params_}")
print(f"   ✅ Best GB CV accuracy: {gb_grid.best_score_*100:.2f}%")

# ============================================
# IMPROVEMENT 5: Cross-validation on both models
# ============================================

print("\n📊 Cross-validation scores (5-fold):")
rf_cv_scores = cross_val_score(best_rf, X_train, y_train, cv=5)
gb_cv_scores = cross_val_score(best_gb, X_train, y_train, cv=5)
print(f"   Random Forest CV: {rf_cv_scores.mean()*100:.2f}% (+/- {rf_cv_scores.std()*100:.2f}%)")
print(f"   Gradient Boosting CV: {gb_cv_scores.mean()*100:.2f}% (+/- {gb_cv_scores.std()*100:.2f}%)")

# ============================================
# IMPROVEMENT 6: Select best model and evaluate on test set
# ============================================

# Choose the better model
if rf_cv_scores.mean() > gb_cv_scores.mean():
    best_model = best_rf
    model_name = "Random Forest"
else:
    best_model = best_gb
    model_name = "Gradient Boosting"

print(f"\n🏆 Best model: {model_name}")

# Evaluate on test set
y_pred = best_model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)

print(f"\n📈 TEST SET ACCURACY: {accuracy * 100:.2f}%")

# Classification Report
target_names = ['FOCUSED', 'FATIGUE', 'ANXIETY', 'BOREDOM']
print("\n📋 CLASSIFICATION REPORT:")
print(classification_report(y_test, y_pred, target_names=target_names))

# Confusion Matrix
print("\n📊 CONFUSION MATRIX:")
cm = confusion_matrix(y_test, y_pred)
print(pd.DataFrame(cm, index=target_names, columns=target_names))

# ============================================
# Save everything
# ============================================

# Save model
model_path = os.path.join(MODELS_DIR, 'focus_rescue_model_improved.pkl')
joblib.dump(best_model, model_path)
print(f"\n💾 Model saved: {model_path}")

# Save scaler as well
scaler_path = os.path.join(MODELS_DIR, 'scaler.pkl')
joblib.dump(scaler, scaler_path)
print(f"💾 Scaler saved: {scaler_path}")

# Save label mapping
label_names = {0: "FOCUSED", 1: "FATIGUE", 2: "ANXIETY", 3: "BOREDOM"}
with open(os.path.join(MODELS_DIR, 'label_names.json'), 'w') as f:
    json.dump(label_names, f)

print("💾 Label mapping saved")

print("\n" + "=" * 60)
print("✅ MODEL TRAINING COMPLETE!")
print(f"🎯 Final Accuracy: {accuracy * 100:.2f}%")
print("=" * 60)