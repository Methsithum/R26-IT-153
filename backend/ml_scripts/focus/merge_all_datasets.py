import pandas as pd
from pathlib import Path
from sklearn.preprocessing import StandardScaler
import joblib

SCRIPT_DIR = Path(__file__).parent.resolve()
BACKEND_DIR = SCRIPT_DIR.parent.parent.resolve()
PROCESSED_PATH = BACKEND_DIR / "datasets" / "focus" / "processed"
OUTPUT_PATH = PROCESSED_PATH / "training_data.csv"

META_COLS = {"state", "source", "label", "image_name", "image_path", "video_name", "frame_num", "emotion", "state_name", "is_bored"}

def load_dataset(path, name):
    if not path.exists():
        print(f"⚠️ {name} dataset not found")
        return None
    df = pd.read_csv(path)
    print(f"✅ {name} dataset: {len(df)} samples")
    return df


def merge_and_clean():
    all_dfs = []
    
    # ========== 1. Load Eye Dataset ==========
    eye_path = PROCESSED_PATH / "eye_features.csv"
    df_eye = load_dataset(eye_path, "Eye")
    if df_eye is not None:
        if 'label' in df_eye.columns:
            df_eye['state'] = df_eye['label'].astype(int)
        df_eye['source'] = 'eye'
        all_dfs.append(df_eye)
    
    # ========== 2. Load Facial Dataset ==========
    facial_path = PROCESSED_PATH / "facial_features.csv"
    df_facial = load_dataset(facial_path, "Facial")
    if df_facial is not None:
        df_facial['source'] = 'facial'
        all_dfs.append(df_facial)
    
    # ========== 3. Load Fatigue Dataset ==========
    fatigue_path = PROCESSED_PATH / "fatigue_features.csv"
    df_fatigue = load_dataset(fatigue_path, "Fatigue")
    if df_fatigue is not None:
        if 'state' not in df_fatigue.columns and 'label' in df_fatigue.columns:
            df_fatigue['state'] = df_fatigue['label'].astype(int)
        df_fatigue['source'] = 'fatigue'
        all_dfs.append(df_fatigue)
    
    # ========== 4. Load Boredom Dataset ==========
    boredom_path = PROCESSED_PATH / "boredom_features.csv"
    df_boredom = load_dataset(boredom_path, "Boredom")
    if df_boredom is not None:
        if 'state' not in df_boredom.columns and 'is_bored' in df_boredom.columns:
            df_boredom['state'] = df_boredom['is_bored'].fillna(0).astype(int).replace({1: 3})
        df_boredom['source'] = 'boredom'
        all_dfs.append(df_boredom)
    
    # ========== 5. Load Engagement Dataset ==========
    engagement_path = PROCESSED_PATH / "engagement_features.csv"
    df_engagement = load_dataset(engagement_path, "Engagement")
    if df_engagement is not None:
        df_engagement['source'] = 'engagement'
        all_dfs.append(df_engagement)
    
    if len(all_dfs) == 0:
        print("\n❌ No datasets found!")
        return
    
    # ========== 5. Merge ==========
    combined = pd.concat(all_dfs, ignore_index=True, sort=False)
    print(f"\n📊 Merged dataset: {len(combined)} total samples")
    
    # ========== 6. Clean ==========
    print("\n--- Cleaning ---")
    
    # Collect all non-metadata feature columns across datasets
    feature_cols = [c for c in combined.columns if c not in META_COLS]

    # Fill missing values with per-column median; fallback to 0.0 when median is unavailable
    for col in feature_cols:
        if combined[col].isnull().any():
            median_value = combined[col].median()
            if pd.isna(median_value):
                median_value = 0.0
            combined[col] = combined[col].fillna(median_value)
    
    # Ensure state is within 0-3
    if 'state' in combined.columns:
        combined['state'] = combined['state'].fillna(0).clip(0, 3).astype(int)
    
    # ========== 7. Class Distribution ==========
    print("\n--- Class Distribution ---")
    for state in range(4):
        state_name = ['Focused', 'Fatigue', 'Anxiety', 'Boredom'][state]
        count = len(combined[combined['state'] == state]) if 'state' in combined.columns else 0
        print(f"   {state_name}: {count}")
    
    # ========== 8. Normalize ==========
    print("\n--- Normalizing ---")
    scaler = StandardScaler()
    combined[feature_cols] = scaler.fit_transform(combined[feature_cols])
    
    scaler_path = BACKEND_DIR / "trained-models" / "focus" / "scaler.pkl"
    scaler_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(scaler, scaler_path)
    
    # ========== 9. Save ==========
    output_cols = feature_cols + ['state']
    combined[output_cols].to_csv(OUTPUT_PATH, index=False)
    
    print(f"\n✅ Saved to {OUTPUT_PATH}")
    print(f"   Shape: {combined[output_cols].shape}")

if __name__ == "__main__":
    merge_and_clean()