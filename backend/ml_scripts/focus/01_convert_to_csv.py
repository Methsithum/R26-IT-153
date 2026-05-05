# 01_convert_to_csv.py - Convert all datasets to CSV

import os
import cv2
import numpy as np
import pandas as pd

print("="*60)
print("STEP 1: Converting Datasets to CSV")
print("="*60)

# Paths - ඔයාගේ folder structure එකට හරියටම
BASE_DATASET_PATH = "datasets/focus"
OUTPUT_PATH = "trained-models/focus/processed/dataset_3class.csv"

# ============================================
# 1. FATIGUE DATASET (UTA-RLDD)
# ============================================
def convert_fatigue():
    print("\n📂 Processing Fatigue Dataset...")
    X, y = [], []
    
    # Try different possible paths
    possible_paths = [
        f"{BASE_DATASET_PATH}/dataset_1_fatigue/output/train",
        f"{BASE_DATASET_PATH}/dataset_1_fatigue/train",
        f"{BASE_DATASET_PATH}/fatigue_detection/train"
    ]
    
    path = None
    for p in possible_paths:
        if os.path.exists(p):
            path = p
            break
    
    if path is None:
        print("   ⚠️ Fatigue dataset not found!")
        return np.array(X), np.array(y)
    
    for label_name, label in [('alert', 0), ('non_vigilant', 1), ('tired', 1)]:
        folder = os.path.join(path, label_name)
        if os.path.exists(folder):
            count = 0
            for img in os.listdir(folder):
                if count >= 200:
                    break
                img_path = os.path.join(folder, img)
                img_data = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
                if img_data is not None:
                    resized = cv2.resize(img_data, (50, 50))
                    X.append(resized.flatten())
                    y.append(label)
                    count += 1
            print(f"   ✅ {label_name}: {count} images")
        else:
            print(f"   ⚠️ {label_name} folder not found")
    
    return np.array(X), np.array(y)

# ============================================
# 2. EYE DATASET (MRL Eye)
# ============================================
def convert_eye():
    print("\n📂 Processing Eye Dataset...")
    X, y = [], []
    
    possible_paths = [
        f"{BASE_DATASET_PATH}/dataset_3_eye/data/train",
        f"{BASE_DATASET_PATH}/dataset_3_eye/train",
        f"{BASE_DATASET_PATH}/mrl_eye/train"
    ]
    
    path = None
    for p in possible_paths:
        if os.path.exists(p):
            path = p
            break
    
    if path is None:
        print("   ⚠️ Eye dataset not found!")
        return np.array(X), np.array(y)
    
    for folder, label in [('awake', 0), ('sleepy', 1)]:
        folder_path = os.path.join(path, folder)
        if os.path.exists(folder_path):
            count = 0
            for img in os.listdir(folder_path):
                if count >= 300:
                    break
                img_path = os.path.join(folder_path, img)
                img_data = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
                if img_data is not None:
                    resized = cv2.resize(img_data, (50, 50))
                    X.append(resized.flatten())
                    y.append(label)
                    count += 1
            print(f"   ✅ {folder}: {count} images")
    
    return np.array(X), np.array(y)

# ============================================
# 3. EMOTION DATASET
# ============================================
def convert_emotion():
    print("\n📂 Processing Emotion Dataset...")
    X, y = [], []
    
    emotion_map = {
        'happy': 0, 'neutral': 0,
        'angry': 2, 'disgust': 2, 'fear': 2, 'sad': 2
    }
    
    possible_paths = [
        f"{BASE_DATASET_PATH}/dataset_2_emotion/processed_data",
        f"{BASE_DATASET_PATH}/emotion_dataset/processed_data",
        f"{BASE_DATASET_PATH}/facial_emotion/processed_data"
    ]
    
    base_path = None
    for p in possible_paths:
        if os.path.exists(p):
            base_path = p
            break
    
    if base_path is None:
        print("   ⚠️ Emotion dataset not found!")
        return np.array(X), np.array(y)
    
    for emotion, label in emotion_map.items():
        folder = os.path.join(base_path, emotion)
        if os.path.exists(folder):
            count = 0
            for img in os.listdir(folder):
                if count >= 200:
                    break
                img_path = os.path.join(folder, img)
                img_data = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
                if img_data is not None:
                    resized = cv2.resize(img_data, (50, 50))
                    X.append(resized.flatten())
                    y.append(label)
                    count += 1
            print(f"   ✅ {emotion}: {count} images (label {label})")
    
    return np.array(X), np.array(y)

# ============================================
# 4. Save to CSV
# ============================================
def main():
    X_f, y_f = convert_fatigue()
    X_e, y_e = convert_eye()
    X_em, y_em = convert_emotion()
    
    all_X, all_y = [], []
    
    if len(X_f) > 0:
        all_X.append(X_f)
        all_y.append(y_f)
        print(f"\n📊 Fatigue dataset: {len(X_f)} samples")
    
    if len(X_e) > 0:
        all_X.append(X_e)
        all_y.append(y_e)
        print(f"📊 Eye dataset: {len(X_e)} samples")
    
    if len(X_em) > 0:
        all_X.append(X_em)
        all_y.append(y_em)
        print(f"📊 Emotion dataset: {len(X_em)} samples")
    
    if all_X:
        X_combined = np.vstack(all_X)
        y_combined = np.hstack(all_y)
        
        df = pd.DataFrame(X_combined)
        df['label'] = y_combined
        
        # Remove Boredom (label 3) for PP1
        df = df[df['label'] != 3]
        
        os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
        df.to_csv(OUTPUT_PATH, index=False)
        
        print(f"\n💾 Saved: {OUTPUT_PATH}")
        print(f"   Total samples: {len(df)}")
        print("\n📊 CLASS DISTRIBUTION:")
        for label, name in {0:"FOCUSED",1:"FATIGUE",2:"ANXIETY"}.items():
            print(f"   {name}: {(df['label']==label).sum()}")
    else:
        print("\n❌ No data converted! Check your dataset paths.")

if __name__ == "__main__":
    main()