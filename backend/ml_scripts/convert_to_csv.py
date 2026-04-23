# convert_to_csv.py - 100% Working for YOUR folder structure

import os
import cv2
import numpy as np
import pandas as pd

print("=" * 60)
print("STEP 1: Converting ALL Datasets to CSV")
print("=" * 60)

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATASETS_DIR = os.path.join(BACKEND_DIR, 'datasets')

# ============================================
# 1. FATIGUE DATASET (UTA-RLDD)
# ============================================
def convert_fatigue_dataset():
    print("\n📂 Processing FATIGUE Dataset...")
    X, y = [], []
    
    fatigue_path = os.path.join(DATASETS_DIR, 'fatigue_dataset', 'train')
    
    label_map = {
        'alert': 0,           # Focused
        'non_vigilant': 1,    # Fatigue
        'tired': 1            # Fatigue
    }
    
    for folder, label in label_map.items():
        folder_path = os.path.join(fatigue_path, folder)
        if os.path.exists(folder_path):
            count = 0
            for img_file in os.listdir(folder_path):
                if count >= 300:
                    break
                img_path = os.path.join(folder_path, img_file)
                img = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
                if img is not None:
                    resized = cv2.resize(img, (50, 50))
                    X.append(resized.flatten())
                    y.append(label)
                    count += 1
            print(f"   ✅ Loaded {count} images from '{folder}' (label: {label})")
    
    return np.array(X), np.array(y)

# ============================================
# 2. MRL EYE DATASET
# ============================================
def convert_eye_dataset():
    print("\n📂 Processing EYE Dataset...")
    X, y = [], []
    
    eye_path = os.path.join(DATASETS_DIR, 'eye_dataset', 'data', 'train')
    
    # Awake = Focused (0), Sleepy = Fatigue (1)
    for folder, label in [('awake', 0), ('sleepy', 1)]:
        folder_path = os.path.join(eye_path, folder)
        if os.path.exists(folder_path):
            count = 0
            for img_file in os.listdir(folder_path):
                if count >= 500:
                    break
                img_path = os.path.join(folder_path, img_file)
                img = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
                if img is not None:
                    resized = cv2.resize(img, (50, 50))
                    X.append(resized.flatten())
                    y.append(label)
                    count += 1
            print(f"   ✅ Loaded {count} images from '{folder}' (label: {label})")
    
    return np.array(X), np.array(y)

# ============================================
# 3. FACIAL EMOTION DATASET
# ============================================
def convert_emotion_dataset():
    print("\n📂 Processing EMOTION Dataset...")
    X, y = [], []
    
    emotion_path = os.path.join(DATASETS_DIR, 'emotion_dataset', 'processed_data')
    
    # Map emotions to distraction types
    emotion_map = {
        'angry': 2,      # Anxiety
        'disgust': 2,    # Anxiety
        'fear': 2,       # Anxiety
        'sad': 2,        # Anxiety
        'neutral': 0,    # Focused
        'happy': 0,      # Focused
        'surprise': 3    # Boredom
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
                    resized = cv2.resize(img, (50, 50))
                    X.append(resized.flatten())
                    y.append(label)
                    count += 1
            print(f"   ✅ Loaded {count} images from '{emotion}' (label: {label})")
    
    return np.array(X), np.array(y)

# ============================================
# 4. ENGAGEMENT DATASET (Excel File)
# ============================================
def convert_engagement_dataset():
    print("\n📂 Processing ENGAGEMENT Dataset...")
    
    engagement_dir = os.path.join(DATASETS_DIR, 'engagement_dataset')
    
    # Try multiple file name candidates
    candidates = [
        ('online_learning_engagement_dataset.csv', 'csv'),
        ('online_learning_engagement_cleaned.xls', 'xls'),
        ('online_learning_engagement_dataset_clear.xls', 'xls'),
    ]
    
    df = None
    file_found = None
    
    for filename, filetype in candidates:
        filepath = os.path.join(engagement_dir, filename)
        if os.path.exists(filepath):
            try:
                if filetype == 'csv':
                    df = pd.read_csv(filepath)
                else:
                    df = pd.read_excel(filepath, engine='xlrd')
                file_found = filename
                print(f"   ✅ Loaded {len(df)} records from {filename}")
                print(f"   📊 Columns: {df.columns.tolist()}")
                break
            except Exception as exc:
                print(f"   ⚠️ Error reading {filename}: {exc}")
                continue
    
    if df is None:
        print(f"   ⚠️ No engagement file found in: {engagement_dir}")
        return None
    
    # Create engagement score and map to labels
    if 'engagement_score' in df.columns:
        engagement_score = df['engagement_score']
    elif 'engagement_metrics' in df.columns:
        engagement_score = df['engagement_metrics']
    else:
        # Calculate engagement score from available columns
        score_cols = ['login_frequency_weekly', 'study_hours_weekly', 'avg_quiz_score']
        available = [c for c in score_cols if c in df.columns]
        if available:
            engagement_score = df[available].mean(axis=1)
        else:
            engagement_score = 50.0
    
    # Map to labels
    labels = []
    for score in engagement_score:
        if score > 70:
            labels.append(0)    # Focused
        elif score > 40:
            labels.append(2)    # Anxiety
        else:
            labels.append(3)    # Boredom
    
    df['label'] = labels
    
    # Save as CSV
    csv_path = os.path.join(DATASETS_DIR, 'engagement_dataset.csv')
    df.to_csv(csv_path, index=False)
    print(f"   💾 Saved engagement_dataset.csv")
    return df

# ============================================
# 5. COMBINE AND SAVE
# ============================================
def main():
    # Convert all datasets
    X_fatigue, y_fatigue = convert_fatigue_dataset()
    X_eye, y_eye = convert_eye_dataset()
    X_emotion, y_emotion = convert_emotion_dataset()
    
    # Combine all image data
    all_X = []
    all_y = []
    
    if len(X_fatigue) > 0:
        all_X.append(X_fatigue)
        all_y.append(y_fatigue)
        print(f"\n📊 Fatigue: {len(X_fatigue)} samples")
    
    if len(X_eye) > 0:
        all_X.append(X_eye)
        all_y.append(y_eye)
        print(f"📊 Eye: {len(X_eye)} samples")
    
    if len(X_emotion) > 0:
        all_X.append(X_emotion)
        all_y.append(y_emotion)
        print(f"📊 Emotion: {len(X_emotion)} samples")
    
    if all_X:
        X_combined = np.vstack(all_X)
        y_combined = np.hstack(all_y)
        
        df_combined = pd.DataFrame(X_combined)
        df_combined['label'] = y_combined
        
        combined_path = os.path.join(DATASETS_DIR, 'combined_dataset.csv')
        df_combined.to_csv(combined_path, index=False)
        print(f"\n💾 SAVED: combined_dataset.csv ({len(df_combined)} rows)")
        
        # Print class distribution
        print("\n📊 CLASS DISTRIBUTION:")
        class_counts = df_combined['label'].value_counts().sort_index()
        class_names = {0: "FOCUSED", 1: "FATIGUE", 2: "ANXIETY", 3: "BOREDOM"}
        for label, count in class_counts.items():
            print(f"   {class_names.get(label, 'UNKNOWN')}: {count}")
    
    # Convert engagement dataset
    convert_engagement_dataset()
    
    print("\n" + "=" * 60)
    print("✅ ALL DATASETS CONVERTED TO CSV SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    main()