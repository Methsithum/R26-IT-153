# convert_to_csv.py

import os
import cv2
import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder

print("=" * 50)
print("STEP 1: Converting Images to CSV Format")
print("=" * 50)

# ============================================
# 1. MRL Eye Dataset Convert
# ============================================

def convert_eye_dataset():
    print("\n📂 Converting MRL Eye Dataset...")
    
    X = []  # Features
    y = []  # Labels
    
    eye_path = "backend/datasets/dataset_3_eye/data/train"
    
    # Load Awake images (Focused = label 0)
    awake_path = os.path.join(eye_path, "awake")
    if os.path.exists(awake_path):
        count = 0
        for img_file in os.listdir(awake_path):
            if count >= 500:
                break
            img_path = os.path.join(awake_path, img_file)
            img = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
            if img is not None:
                img_resized = cv2.resize(img, (50, 50))
                X.append(img_resized.flatten())
                y.append(0)  # 0 = Focused
                count += 1
        print(f"   ✅ Loaded {count} Awake (Focused) images")
    
    # Load Sleepy images (Fatigue = label 1)
    sleepy_path = os.path.join(eye_path, "sleepy")
    if os.path.exists(sleepy_path):
        count = 0
        for img_file in os.listdir(sleepy_path):
            if count >= 500:
                break
            img_path = os.path.join(sleepy_path, img_file)
            img = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
            if img is not None:
                img_resized = cv2.resize(img, (50, 50))
                X.append(img_resized.flatten())
                y.append(1)  # 1 = Fatigue
                count += 1
        print(f"   ✅ Loaded {count} Sleepy (Fatigue) images")
    
    return np.array(X), np.array(y)

# ============================================
# 2. Facial Emotion Dataset Convert
# ============================================

def convert_emotion_dataset():
    print("\n📂 Converting Facial Emotion Dataset...")
    
    X = []
    y = []
    
    emotion_path = "backend/datasets/dataset_2_emotion/processed_data"
    
    # Map emotions to distraction types
    emotion_map = {
        'angry': 2,      # 2 = Anxiety
        'disgust': 2,    # 2 = Anxiety
        'fear': 2,       # 2 = Anxiety
        'sad': 2,        # 2 = Anxiety
        'neutral': 0,    # 0 = Focused
        'happy': 0,      # 0 = Focused
        'surprise': 3    # 3 = Boredom
    }
    
    for emotion, label in emotion_map.items():
        folder_path = os.path.join(emotion_path, emotion)
        if os.path.exists(folder_path):
            count = 0
            for img_file in os.listdir(folder_path):
                if count >= 200:
                    break
                img_path = os.path.join(folder_path, img_file)
                img = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
                if img is not None:
                    img_resized = cv2.resize(img, (50, 50))
                    X.append(img_resized.flatten())
                    y.append(label)
                    count += 1
            print(f"   ✅ Loaded {count} {emotion} images (label: {label})")
    
    return np.array(X), np.array(y)

# ============================================
# 3. Engagement CSV Dataset Load
# ============================================

def load_engagement_dataset():
    print("\n📂 Loading Online Learning Engagement CSV...")
    
    csv_path = "backend/datasets/dataset_4_engagement/online_learning_engagement_dataset.csv"
    
    if os.path.exists(csv_path):
        df = pd.read_csv(csv_path)
        print(f"   ✅ Loaded {len(df)} records")
        print(f"   📊 Columns: {df.columns.tolist()}")
        return df
    else:
        print(f"   ❌ CSV file not found at: {csv_path}")
        return None

# ============================================
# 4. Save to CSV Files
# ============================================

def save_to_csv():
    print("\n" + "=" * 50)
    print("STEP 2: Saving to CSV Files")
    print("=" * 50)
    
    # Convert eye dataset
    X_eye, y_eye = convert_eye_dataset()
    df_eye = pd.DataFrame(X_eye)
    df_eye['label'] = y_eye
    df_eye.to_csv('backend/datasets/eye_dataset.csv', index=False)
    print(f"\n💾 Saved eye_dataset.csv ({len(df_eye)} rows, 2501 columns)")
    
    # Convert emotion dataset
    X_emo, y_emo = convert_emotion_dataset()
    df_emo = pd.DataFrame(X_emo)
    df_emo['label'] = y_emo
    df_emo.to_csv('backend/datasets/emotion_dataset.csv', index=False)
    print(f"💾 Saved emotion_dataset.csv ({len(df_emo)} rows, 2501 columns)")
    
    # Load engagement dataset
    df_engage = load_engagement_dataset()
    if df_engage is not None:
        df_engage.to_csv('backend/datasets/engagement_dataset.csv', index=False)
        print(f"💾 Saved engagement_dataset.csv ({len(df_engage)} rows)")
    
    print("\n✅ All datasets converted to CSV successfully!")

if __name__ == "__main__":
    save_to_csv()