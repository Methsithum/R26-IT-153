# train_model.py - 100% Working

import pandas as pd
import numpy as np
import os
import json
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

print("=" * 60)
print("STEP 2: Training ML Model")
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
print(f"📊 Labels: {np.unique(y)}")

# Split data
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

print(f"\n📊 Training samples: {len(X_train)}")
print(f"📊 Testing samples: {len(X_test)}")

# Train Random Forest
model = RandomForestClassifier(
    n_estimators=100,
    max_depth=15,
    random_state=42,
    n_jobs=-1
)

model.fit(X_train, y_train)

# Evaluate
y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)

print(f"\n📈 MODEL ACCURACY: {accuracy * 100:.2f}%")

# Classification Report
target_names = ['FOCUSED', 'FATIGUE', 'ANXIETY', 'BOREDOM']
print("\n📋 CLASSIFICATION REPORT:")
print(classification_report(y_test, y_pred, target_names=target_names))

# Save model
model_path = os.path.join(MODELS_DIR, 'focus_rescue_model.pkl')
joblib.dump(model, model_path)
print(f"\n💾 Model saved: {model_path}")

# Save label mapping
label_names = {0: "FOCUSED", 1: "FATIGUE", 2: "ANXIETY", 3: "BOREDOM"}
with open(os.path.join(MODELS_DIR, 'label_names.json'), 'w') as f:
    json.dump(label_names, f)

print("💾 Label mapping saved")

print("\n" + "=" * 60)
print("✅ MODEL TRAINING COMPLETE!")
print("=" * 60)