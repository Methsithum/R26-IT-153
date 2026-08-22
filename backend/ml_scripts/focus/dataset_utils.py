"""
Shared paths, constants, and helper functions for the Student Focus Monitor
dataset-building scripts (build_unified_dataset.py, extract_daisee_boredom.py,
report_class_balance.py).
"""
from pathlib import Path
import csv
import shutil

# --- Paths ---------------------------------------------------------------
# Resolved relative to this file (not cwd) so the scripts work no matter
# where they're launched from.
BACKEND_ROOT = Path(__file__).resolve().parents[2]                  # .../backend
SOURCE_ROOT = BACKEND_ROOT / "datasets" / "focusmonitor"             # raw source datasets
OUTPUT_ROOT = BACKEND_ROOT / "datasets" / "focus_dataset_unified"    # built dataset
MAPPING_LOG_PATH = OUTPUT_ROOT / "mapping_log.csv"

DAISEE_ROOT = SOURCE_ROOT / "DAiSEE"
FER_ROOT = SOURCE_ROOT / "facial" / "processed_data"
FATIGUE_ROOT = SOURCE_ROOT / "fatigue"

CLASSES = ["focused", "fatigue", "anxiety", "boredom"]
SPLITS = ["train", "val", "test"]

CAP_PER_SOURCE = 1500                   # max images pulled from any single source folder
RANDOM_SEED = 42
FER_SPLIT_RATIOS = (0.70, 0.15, 0.15)   # train, val, test -- used only for FER sources

IMAGE_EXTS = {".jpg", ".jpeg", ".png"}


def list_images(folder: Path):
    """Sorted list of image files directly inside `folder` (non-recursive)."""
    if not folder.exists():
        return []
    return sorted(p for p in folder.iterdir() if p.suffix.lower() in IMAGE_EXTS)


def evenly_spaced_sample(items, cap):
    """Deterministically down-sample `items` to at most `cap` entries, spread
    evenly across the original order -- avoids biasing toward whatever
    happens to sort first (e.g. one person's frames) when a source folder
    exceeds the cap."""
    n = len(items)
    if n <= cap:
        return list(items)
    step = n / cap
    indices = sorted({int(i * step) for i in range(cap)})
    return [items[i] for i in indices]


def ensure_dir(path: Path):
    path.mkdir(parents=True, exist_ok=True)
    return path


def copy_images(files, dest_dir: Path, source_label: str, target_class: str, split: str, log_rows: list):
    """Copy `files` into dest_dir, prefixing filenames with source_label to
    keep provenance visible in the filename itself and to avoid name
    collisions across sources that feed the same target class (e.g. FER
    "happy" and UTA "alert" both landing in focused/). Appends one row per
    copied file to `log_rows` for the methodology-section CSV."""
    ensure_dir(dest_dir)
    for f in files:
        new_name = f"{source_label}__{f.name}"
        dest = dest_dir / new_name
        shutil.copy2(f, dest)
        log_rows.append([target_class, split, source_label, str(f), str(dest)])
    return len(files)


def write_mapping_log(log_rows, path: Path = MAPPING_LOG_PATH, mode="w"):
    """mode='w' starts a fresh log (build_unified_dataset.py); mode='a'
    appends to an existing one (extract_daisee_boredom.py runs second)."""
    ensure_dir(path.parent)
    write_header = mode == "w" or not path.exists()
    with open(path, mode, newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        if write_header:
            writer.writerow(["target_class", "split", "source_folder", "original_file", "new_file"])
        writer.writerows(log_rows)
