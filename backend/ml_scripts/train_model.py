# train_model.py

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import joblib
import os

print("=" * 50)
print("STEP 3: Training ML Model")
print("=" * 50)

# ============================================
# 1. Load CSV Files
# ============================================

def load_all_datasets():
    print("\n📂 Loading CSV files...")
    
    # Load Eye Dataset
    eye_path = 'backend/datasets/eye_dataset.csv'
    if os.path.exists(eye_path):
        df_eye = pd.read_csv(eye_path)
        print(f"   ✅ Loaded eye_dataset.csv: {len(df_eye)} rows")
    else:
        print(f"   ❌ eye_dataset.csv not found! Run convert_to_csv.py first.")
        return None, None
    
    # Load Emotion Dataset
    emo_path = 'backend/datasets/emotion_dataset.csv'
    if os.path.exists(emo_path):
        df_emo = pd.read_csv(emo_path)
        print(f"   ✅ Loaded emotion_dataset.csv: {len(df_emo)} rows")
    else:
        print(f"   ❌ emotion_dataset.csv not found!")
        return None, None
    
    # Load Engagement Dataset
    eng_path = 'backend/datasets/engagement_dataset.csv'
    if os.path.exists(eng_path):
        df_eng = pd.read_csv(eng_path)
        print(f"   ✅ Loaded engagement_dataset.csv: {len(df_eng)} rows")
    else:
        print(f"   ⚠️ engagement_dataset.csv not found - continuing without it")
        df_eng = None
    
    return df_eye, df_emo, df_eng

# ============================================
# 2. Combine Datasets
# ============================================

def combine_datasets(df_eye, df_emo, df_eng):
    print("\n🔄 Combining datasets...")
    
    # Extract features and labels from eye dataset
    X_eye = df_eye.drop('label', axis=1).values
    y_eye = df_eye['label'].values
    
    # Extract from emotion dataset
    X_emo = df_emo.drop('label', axis=1).values
    y_emo = df_emo['label'].values
    
    # Combine
    X_combined = np.vstack([X_eye, X_emo])
    y_combined = np.hstack([y_eye, y_emo])
    
    print(f"   📊 Combined {len(X_combined)} samples")
    print(f"   📊 Class distribution: {dict(zip(*np.unique(y_combined, return_counts=True)))}")
    
    return X_combined, y_combined

# ============================================
# 3. Train Model
# ============================================

def train_model(X, y):
    print("\n🎯 Training Random Forest Classifier...")
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    print(f"   📊 Training samples: {len(X_train)}")
    print(f"   📊 Testing samples: {len(X_test)}")
    
    # Train model
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
    
    print(f"\n   📈 Model Accuracy: {accuracy * 100:.2f}%")
    print("\n   📋 Classification Report:")
    print(classification_report(y_test, y_pred, 
          target_names=['FOCUSED', 'FATIGUE', 'ANXIETY', 'BOREDOM']))
    
    return model

# ============================================
# 4. Save Model
# ============================================

def save_model(model):
    print("\n💾 Saving model...")
    
    model_path = 'backend/trained-models/focus_rescue_model.pkl'
    joblib.dump(model, model_path)
    print(f"   ✅ Model saved to: {model_path}")
    
    # Save label mapping
    label_names = {0: "FOCUSED", 1: "FATIGUE", 2: "ANXIETY", 3: "BOREDOM"}
    import json
    with open('backend/trained-models/label_names.json', 'w') as f:
        json.dump(label_names, f)
    print(f"   ✅ Label mapping saved")

# ============================================
# 5. Main Function
# ============================================

def main():
    # Load datasets
    df_eye, df_emo, df_eng = load_all_datasets()
    
    if df_eye is None or df_emo is None:
        print("\n❌ Please run convert_to_csv.py first!")
        return
    
    # Combine
    X, y = combine_datasets(df_eye, df_emo, df_eng)
    
    # Train
    model = train_model(X, y)
    
    # Save
    save_model(model)
    
    print("\n" + "=" * 50)
    print("✅ MODEL TRAINING COMPLETE!")
    print("=" * 50)

if __name__ == "__main__":
    main()