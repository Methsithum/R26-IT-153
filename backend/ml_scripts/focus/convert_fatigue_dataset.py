from pathlib import Path

import cv2
import pandas as pd

from feature_extractor import FaceFeatureExtractor

SCRIPT_DIR = Path(__file__).parent.resolve()
BACKEND_DIR = SCRIPT_DIR.parent.parent.resolve()
DATA_PATH = BACKEND_DIR / "datasets" / "focus" / "dataset_fatigue"
OUTPUT_PATH = BACKEND_DIR / "datasets" / "focus" / "processed" / "fatigue_features.csv"


def _iter_images(base_path: Path):
    for ext in ("*.jpg", "*.jpeg", "*.png", "*.bmp", "*.JPG", "*.PNG"):
        yield from base_path.glob(f"**/{ext}")


def convert_fatigue_dataset():
    extractor = FaceFeatureExtractor()
    records = []
    state_counts = {0: 0, 1: 0}
    max_per_state = 500

    for idx, img_path in enumerate(_iter_images(DATA_PATH), start=1):
        path_str = str(img_path).lower()
        if any(token in path_str for token in ["alert", "awake", "non_fatigue"]):
            state = 0
        elif any(token in path_str for token in ["non_vigilant", "tired", "fatigue", "drowsy"]):
            state = 1
        else:
            continue

        if state_counts[state] >= max_per_state:
            continue

        img = cv2.imread(str(img_path))
        features = extractor.extract_all_features(img)
        if not features:
            continue

        features["state"] = state
        features["source"] = "fatigue"
        records.append(features)
        state_counts[state] += 1

        if idx % 1000 == 0:
            print(f"  Processed {idx} images...")

    if not records:
        raise RuntimeError(f"No fatigue images processed from {DATA_PATH}")

    df = pd.DataFrame(records)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"✅ Saved {len(df)} samples to {OUTPUT_PATH}")
    print(f"   Focused: {state_counts[0]}, Fatigue: {state_counts[1]}")


if __name__ == "__main__":
    convert_fatigue_dataset()

if __name__ == "__main__":
    convert_fatigue_dataset()