from pathlib import Path

import cv2
import pandas as pd

from feature_extractor import FaceFeatureExtractor

SCRIPT_DIR = Path(__file__).parent.resolve()
BACKEND_DIR = SCRIPT_DIR.parent.parent.resolve()
DATA_PATH = BACKEND_DIR / "datasets" / "focus" / "dataset_facial"
OUTPUT_PATH = BACKEND_DIR / "datasets" / "focus" / "processed" / "facial_features.csv"


EMOTION_TO_STATE = {
    "happy": 0,
    "neutral": 0,
    "surprise": 0,
    "angry": 2,
    "disgust": 2,
    "fear": 2,
    "sad": 2,
}


def _iter_images(base_path: Path):
    for ext in ("*.jpg", "*.jpeg", "*.png", "*.bmp", "*.JPG", "*.PNG"):
        yield from base_path.glob(f"**/{ext}")


def convert_facial_dataset():
    extractor = FaceFeatureExtractor()
    records = []
    state_counts = {0: 0, 2: 0}
    max_per_state = 500

    for idx, img_path in enumerate(_iter_images(DATA_PATH), start=1):
        emotion = img_path.parent.name.lower()
        if emotion not in EMOTION_TO_STATE:
            continue

        state = EMOTION_TO_STATE[emotion]
        if state_counts[state] >= max_per_state:
            continue

        img = cv2.imread(str(img_path))
        features = extractor.extract_all_features(img)
        if not features:
            continue

        features["state"] = state
        features["emotion"] = emotion
        features["source"] = "facial"
        records.append(features)
        state_counts[state] += 1

        if idx % 1000 == 0:
            print(f"  Processed {idx} images...")

    if not records:
        raise RuntimeError(f"No facial images processed from {DATA_PATH}")

    df = pd.DataFrame(records)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"✅ Saved {len(df)} samples to {OUTPUT_PATH}")
    print(f"   Focused: {state_counts[0]}, Anxiety: {state_counts[2]}")


if __name__ == "__main__":
    convert_facial_dataset()