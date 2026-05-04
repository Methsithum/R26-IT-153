# 02_train_model.py

import pandas as pd
import numpy as np
import os
import joblib
import json
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
from sklearn.preprocessing import StandardScaler
from sklearn.utils.class_weight import compute_class_weight

print("="*60)
print("STEP 2: Training ML Model with Class Weights")
print("="*60)

# Paths
DATA_PATH = "ml_data/focus/processed/dataset_3class.csv"
MODEL_PATH = "ml_data/focus/models/focus_rescue_pp1.pkl"
SCALER_PATH = "ml_data/focus/models/scaler_pp1.pkl"
LABELS_PATH = "ml_data/focus/models/labels_pp1.json"

# Load data
df = pd.read_csv(DATA_PATH)
X = df.drop('label', axis=1).values
y = df['label'].values

print(f"\n📊 Total samples: {len(X)}")
print(f"   Features: {X.shape[1]}")

print("\n   Class Distribution:")
for label, name in {0:"FOCUSED",1:"FATIGUE",2:"ANXIETY"}.items():
    print(f"      {name}: {(y==label).sum()}")

# Calculate class weights
classes = np.unique(y)
weights = compute_class_weight('balanced', classes=classes, y=y)
class_weight_dict = {cls: weight for cls, weight in zip(classes, weights)}

print("\n⚖️ Class Weights:")
for label, name in {0:"FOCUSED",1:"FATIGUE",2:"ANXIETY"}.items():
    print(f"   {name}: {class_weight_dict[label]:.3f}")

# Scale features
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# Split data
X_train, X_test, y_train, y_test = train_test_split(
    X_scaled, y, test_size=0.2, random_state=42, stratify=y
)

# Train model
model = RandomForestClassifier(
    n_estimators=200,
    max_depth=15,
    min_samples_split=5,
    min_samples_leaf=2,
    class_weight=class_weight_dict,
    random_state=42,
    n_jobs=-1
)
model.fit(X_train, y_train)

# Evaluate
y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)

print(f"\n📈 MODEL ACCURACY: {accuracy*100:.2f}%")
print("\n📋 CLASSIFICATION REPORT:")
print(classification_report(y_test, y_pred, target_names=['FOCUSED', 'FATIGUE', 'ANXIETY']))

# Save model
os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
joblib.dump(model, MODEL_PATH)
joblib.dump(scaler, SCALER_PATH)

label_map = {0: "FOCUSED", 1: "FATIGUE", 2: "ANXIETY"}
with open(LABELS_PATH, 'w') as f:
    json.dump(label_map, f)

print(f"\n💾 Model saved: {MODEL_PATH}")
print("="*60)
print("✅ MODEL READY!")