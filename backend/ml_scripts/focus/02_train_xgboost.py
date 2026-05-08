# 02_train_xgboost.py - XGBoost Training for 95% Accuracy

import pandas as pd
import numpy as np
import os
import joblib
import json
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.preprocessing import StandardScaler
from sklearn.utils.class_weight import compute_class_weight
from xgboost import XGBClassifier
import warnings
warnings.filterwarnings('ignore')

print("="*60)
print("XGBOOST TRAINING - TARGET: 95% ACCURACY")
print("="*60)

# ============================================
# STEP 1: Load Data
# ============================================
# Use absolute paths relative to this script
BASE_DIR = os.path.dirname(__file__)
DATA_PATH = os.path.normpath(os.path.join(BASE_DIR, '..', '..', 'trained-models', 'focus', 'processed', 'dataset_3class.csv'))
MODEL_DIR = os.path.normpath(os.path.join(BASE_DIR, '..', '..', 'trained-models', 'focus'))
MODEL_PATH = os.path.join(MODEL_DIR, 'focus_rescue_xgboost.pkl')
SCALER_PATH = os.path.join(MODEL_DIR, 'scaler_xgboost.pkl')
LABELS_PATH = os.path.join(MODEL_DIR, 'labels_xgboost.json')

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
print("\n⚖️ Computing class weights to handle imbalance (no oversampling)...")

# We'll split first to avoid data leakage, then compute weights on training set
X_train_full, X_test_full, y_train_full, y_test_full = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

print("   Split dataset into train/test to compute class weights on training set")

# ============================================
# STEP 3: Scale Features (fit on train only to avoid leakage)
# ============================================
scaler = StandardScaler()

# Fit scaler on training data only
X_train = X_train_full
X_test = X_test_full
y_train = y_train_full
y_test = y_test_full

scaler.fit(X_train)
X_train_scaled = scaler.transform(X_train)
X_test_scaled = scaler.transform(X_test)

print(f"\n📊 Training: {len(X_train_scaled)} samples")
print(f"📊 Testing: {len(X_test_scaled)} samples")

# ============================================
# STEP 5: XGBoost Model (Optimized for 95% Accuracy)
# ============================================
print("\n🎯 Training XGBoost Classifier with class weights...")

# Compute class weights from the training labels
classes = np.unique(y_train)
cw = compute_class_weight(class_weight='balanced', classes=classes, y=y_train)
class_weight_dict = {int(c): float(w) for c, w in zip(classes, cw)}
print(f"   Class weights: {class_weight_dict}")

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

# Build sample weights for training set
sample_weights = np.array([class_weight_dict[int(lbl)] for lbl in y_train])

# Fit model with sample weights
model.fit(X_train_scaled, y_train, sample_weight=sample_weights)

# ============================================
# STEP 6: Evaluate
# ============================================
y_pred = model.predict(X_test_scaled)
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
os.makedirs(MODEL_DIR, exist_ok=True)

joblib.dump(model, MODEL_PATH)
joblib.dump(scaler, SCALER_PATH)

label_map = {0: "FOCUSED", 1: "FATIGUE", 2: "ANXIETY"}
with open(LABELS_PATH, 'w') as f:
    json.dump(label_map, f)

print(f"\n💾 Model saved: {MODEL_PATH}")
print("="*60)
print("✅ XGBOOST MODEL READY FOR WEBCAM DEMO!")
print("="*60)