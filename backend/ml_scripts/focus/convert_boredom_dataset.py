import pandas as pd
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent.resolve()
BACKEND_DIR = SCRIPT_DIR.parent.parent.resolve()
DATA_PATH = BACKEND_DIR / "datasets" / "focus" / "dataset_boredom" / "boredom_dataset.csv"
OUTPUT_PATH = BACKEND_DIR / "datasets" / "focus" / "processed" / "boredom_features.csv"


def convert_boredom_dataset():
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Boredom dataset not found: {DATA_PATH}")

    df = pd.read_csv(DATA_PATH)

    # Keep the original boredom features and add the unified training label.
    df = df.copy()
    df["state"] = df["is_bored"].fillna(0).astype(int).clip(0, 1).replace({1: 3})
    df["source"] = "boredom"
    df = df.drop(columns=["is_bored"])

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_PATH, index=False)

    print(f"✅ Saved {len(df)} samples to {OUTPUT_PATH}")
    print("   State distribution:")
    print(f"   - Focused (0): {len(df[df['state'] == 0])}")
    print(f"   - Fatigue (1): {len(df[df['state'] == 1])}")
    print(f"   - Anxiety (2): {len(df[df['state'] == 2])}")
    print(f"   - Boredom (3): {len(df[df['state'] == 3])}")


if __name__ == "__main__":
    convert_boredom_dataset()