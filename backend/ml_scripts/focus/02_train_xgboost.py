# 02_train_xgboost.py - XGBoost Training for 95% Accuracy

import pandas as pd
import numpy as np
import os
import joblib
import json
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.preprocessing import StandardScaler
from imblearn.over_sampling import SMOTE
from xgboost import XGBClassifier
import warnings
warnings.filterwarnings('ignore')

print("="*60)
print("XGBOOST TRAINING - TARGET: 95% ACCURACY")
print("="*60)

# ============================================
# STEP 1: Load Data
# ============================================
DATA_PATH = "trained-models/focus/processed/dataset_3class.csv"

if not os.path.exists(DATA_PATH):
    print(f"❌ Data not found at: {DATA_PATH}")
    print("   Please run 01_convert_to_csv.py first!")
    exit()

df = pd.read_csv(DATA_PATH)
X = df.drop('label', axis=1).values
y = df['label'].values

print(f"\n📊 Dataset: {len(X)} samples, {X.shape[1]} features")
print("\n   Original Class Distribution:")
for label, name in {0:"FOCUSED",1:"FATIGUE",2:"ANXIETY"}.items():
    print(f"      {name}: {(y==label).sum()}")

# ============================================
# STEP 2: SMOTE - Balance Classes
# ============================================
print("\n⚖️ Applying SMOTE to balance classes...")
smote = SMOTE(random_state=42)
X_balanced, y_balanced = smote.fit_resample(X, y)

print("   After SMOTE:")
for label, name in {0:"FOCUSED",1:"FATIGUE",2:"ANXIETY"}.items():
    print(f"      {name}: {(y_balanced==label).sum()}")

# ============================================
# STEP 3: Scale Features
# ============================================
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X_balanced)

# ============================================
# STEP 4: Train/Test Split
# ============================================
X_train, X_test, y_train, y_test = train_test_split(
    X_scaled, y_balanced, test_size=0.2, random_state=42, stratify=y_balanced
)

print(f"\n📊 Training: {len(X_train)} samples")
print(f"📊 Testing: {len(X_test)} samples")

# ============================================
# STEP 5: XGBoost Model (Optimized for 95% Accuracy)
# ============================================
print("\n🎯 Training XGBoost Classifier...")

model = XGBClassifier(
    n_estimators=500,
    max_depth=10,
    learning_rate=0.05,
    reg_alpha=0.1,
    reg_lambda=1.0,
    subsample=0.8,
    colsample_bytree=0.8,
    n_jobs=-1,
    random_state=42,
    eval_metric='mlogloss',
    use_label_encoder=False
)

model.fit(X_train, y_train)

# ============================================
# STEP 6: Evaluate
# ============================================
y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)

print(f"\n{'='*60}")
print(f"📈 XGBOOST ACCURACY: {accuracy*100:.2f}%")
print(f"{'='*60}")

print("\n📋 CLASSIFICATION REPORT:")
print(classification_report(y_test, y_pred, target_names=['FOCUSED', 'FATIGUE', 'ANXIETY']))

print("\n📊 CONFUSION MATRIX:")
cm = confusion_matrix(y_test, y_pred)
print(pd.DataFrame(cm, index=['FOCUSED','FATIGUE','ANXIETY'], 
                   columns=['Pred_FOCUSED','Pred_FATIGUE','Pred_ANXIETY']))

# ============================================
# STEP 7: Save Model
# ============================================
os.makedirs('trained-models/focus', exist_ok=True)

joblib.dump(model, 'trained-models/focus/focus_rescue_xgboost.pkl')
joblib.dump(scaler, 'trained-models/focus/scaler_xgboost.pkl')

label_map = {0: "FOCUSED", 1: "FATIGUE", 2: "ANXIETY"}
with open('trained-models/focus/labels_xgboost.json', 'w') as f:
    json.dump(label_map, f)

print("\n💾 Model saved: trained-models/focus/focus_rescue_xgboost.pkl")
print("="*60)
print("✅ XGBOOST MODEL READY FOR WEBCAM DEMO!")
print("="*60)