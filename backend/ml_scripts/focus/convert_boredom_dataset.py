import cv2
import pandas as pd
import numpy as np
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).parent))
from face_utils import FaceFeatureExtractor

# Use script-relative paths so script works from its folder and repo root
SCRIPT_DIR = Path(__file__).parent
DATA_PATH = SCRIPT_DIR / "../../datasets/focus/dataset_boredom"
OUTPUT_PATH = SCRIPT_DIR / "../../datasets/focus/processed/boredom_features.csv"

print(f"Data path: {DATA_PATH}")
print(f"Data path exists: {DATA_PATH.exists()}")

def load_daisee_labels_from_csv():
    """Load DAiSEE labels from CSV files with proper parsing"""
    labels_map = {}
    
    # Find all CSV files
    csv_files = list(DATA_PATH.glob("**/*.csv"))
    print(f"Found {len(csv_files)} CSV files")
    
    for csv_file in csv_files:
        print(f"\n  Reading: {csv_file.name}")
        
        try:
            df = pd.read_csv(csv_file)
            print(f"    Shape: {df.shape}")
            print(f"    Columns: {df.columns.tolist()}")
            
            # Try different column name patterns
            filename_col = None
            boredom_col = None
            
            for col in df.columns:
                col_lower = col.lower()
                if 'filename' in col_lower or 'video' in col_lower or 'name' in col_lower or 'clip' in col_lower:
                    filename_col = col
                if 'boredom' in col_lower:
                    boredom_col = col
            
            # If standard columns found
            if filename_col and boredom_col:
                for idx, row in df.iterrows():
                    video_name = str(row[filename_col])
                    # Remove extension if present
                    video_name = video_name.replace('.mp4', '').replace('.avi', '').replace('.mov', '')
                    try:
                        boredom = int(row[boredom_col])
                        labels_map[video_name] = boredom
                    except:
                        pass
                
                print(f"    Loaded {len(labels_map)} labels from {csv_file.name}")
            
            # If no standard columns, try to infer from first rows
            else:
                print(f"    Unknown format. Trying to infer...")
                for idx, row in df.iterrows():
                    first_val = str(row.iloc[0])
                    if '.mp4' in first_val or first_val.isdigit() == False:
                        video_name = first_val.replace('.mp4', '').replace('.avi', '')
                        if len(row) > 1:
                            try:
                                boredom = int(row.iloc[1])
                                labels_map[video_name] = boredom
                            except:
                                pass
                
                print(f"    Loaded {len(labels_map)} labels from {csv_file.name}")
                
        except Exception as e:
            print(f"    Error reading {csv_file.name}: {e}")
    
    return labels_map

def load_daisee_labels_from_txt():
    """Load DAiSEE labels from TXT files"""
    labels_map = {}
    
    txt_files = list(DATA_PATH.glob("**/*.txt"))
    print(f"\nFound {len(txt_files)} TXT files")
    
    for txt_file in txt_files:
        print(f"\n  Reading: {txt_file.name}")
        
        try:
            with open(txt_file, 'r') as f:
                for line_num, line in enumerate(f):
                    line = line.strip()
                    if not line:
                        continue
                    
                    parts = line.split()
                    
                    # DAiSEE format: filename boredom_level confusion_level engagement_level frustration_level
                    if len(parts) >= 5:
                        video_name = parts[0].replace('.mp4', '').replace('.avi', '')
                        try:
                            boredom = int(parts[1])
                            labels_map[video_name] = boredom
                        except:
                            pass
                    elif len(parts) >= 2:
                        video_name = parts[0].replace('.mp4', '').replace('.avi', '')
                        try:
                            boredom = int(parts[1])
                            labels_map[video_name] = boredom
                        except:
                            pass
            
            print(f"    Loaded {len(labels_map)} labels from {txt_file.name}")
            
        except Exception as e:
            print(f"    Error reading {txt_file.name}: {e}")
    
    return labels_map

def convert_boredom_dataset():
    extractor = FaceFeatureExtractor()
    all_records = []
    
    # Load labels from both CSV and TXT
    labels_map = {}
    labels_map.update(load_daisee_labels_from_csv())
    labels_map.update(load_daisee_labels_from_txt())
    
    print(f"\n📊 Total labels loaded: {len(labels_map)}")
    
    if len(labels_map) == 0:
        print("\n❌ No labels loaded! Please check the label files.")
        print("\nLabel files found:")
        for f in DATA_PATH.glob("**/*.csv"):
            print(f"  - {f.relative_to(DATA_PATH)}")
        for f in DATA_PATH.glob("**/*.txt"):
            print(f"  - {f.relative_to(DATA_PATH)}")
        return
    
    # Show sample labels
    print("\n📋 Sample labels:")
    for i, (name, label) in enumerate(list(labels_map.items())[:10]):
        print(f"   {name}: boredom_level={label}")
    
    # Find all video files
    video_extensions = ['*.mp4', '*.avi', '*.mov', '*.MP4']
    all_videos = []
    for ext in video_extensions:
        all_videos.extend(DATA_PATH.glob(f"**/{ext}"))
    
    print(f"\n🎬 Found {len(all_videos)} videos")
    
    # Process all videos (or limit for testing)
    videos_to_process = all_videos[:200]  # Limit to 200 for testing
    print(f"Processing {len(videos_to_process)} videos")
    
    for video_path in videos_to_process:
        video_name = video_path.stem
        
        # Get boredom level from labels
        boredom_level = labels_map.get(video_name)
        
        # If not found, try without any suffix
        if boredom_level is None:
            # Try removing trailing numbers
            base_name = ''.join([c for c in video_name if not c.isdigit()]).rstrip('_')
            if base_name:
                boredom_level = labels_map.get(base_name)
        
        if boredom_level is None:
            print(f"  ⚠️ No label for: {video_name} - skipping")
            continue
        
        # Map DAiSEE boredom levels (0-3) to Focus Rescue states
        # DAiSEE: 0=very low, 1=low, 2=high, 3=very high
        if boredom_level >= 2:
            state = 3  # Boredom
        else:
            state = 0  # Focused
        
        print(f"  ✅ Processing: {video_path.name} (boredom={boredom_level} -> state={state})")
        
        cap = cv2.VideoCapture(str(video_path))
        frame_count = 0
        frames_extracted = 0
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            # Extract every 30th frame (about 1 fps at 30fps)
            if frame_count % 30 == 0 and frames_extracted < 20:  # Max 20 frames per video
                frame = cv2.resize(frame, (320, 240))
                
                features = extractor.extract_all_features(frame)
                if features:
                    features['state'] = state
                    features['boredom_level'] = boredom_level
                    features['source'] = 'boredom_dataset'
                    features['video_name'] = video_path.name
                    features['frame_num'] = frame_count
                    all_records.append(features)
                    frames_extracted += 1
            
            frame_count += 1
            if frame_count > 600:  # Limit to ~20 seconds
                break
        
        cap.release()
        print(f"      Extracted {frames_extracted} frames")
    
    if len(all_records) == 0:
        print("\n❌ No samples extracted!")
        return
    
    df = pd.DataFrame(all_records)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_PATH, index=False)
    
    print(f"\n✅ Saved {len(df)} samples to {OUTPUT_PATH}")
    print(f"\n📊 State distribution:")
    print(f"   Focused (0): {len(df[df['state']==0])}")
    print(f"   Boredom (3): {len(df[df['state']==3])}")
    
    # Show sample data
    print(f"\n📋 Sample data:")
    print(df[['state', 'boredom_level', 'video_name']].head(10))

if __name__ == "__main__":
    convert_boredom_dataset()