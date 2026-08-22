"""
Step 2 of the Student Focus Monitor ML pipeline: builds `focus_dataset_unified/`
from the FER2013-style facial-expression images and the UTA-RLDD fatigue/alert
frames. DAiSEE boredom extraction is handled separately in
extract_daisee_boredom.py, since it requires decoding video files rather than
copying images.

Class mapping (finalized -- do not change without checking with the project
owner first):
    focused -> FER happy, FER neutral, UTA fatigue/{split}/alert
    fatigue -> UTA fatigue/{split}/tired
               (FER's own "tired" folder is EXCLUDED here: inspection showed
               it is a byte-identical copy of the UTA tired frames, not
               independent data. Including both would duplicate the same
               person's frames into this class AND scatter them across a
               fresh random split, undoing the person-level split UTA
               already gives us -- confirmed with the project owner.)
    anxiety -> FER fear, FER angry (accepted proxy; no dataset has a real
               "anxiety" label for this use case)
    boredom -> DAiSEE only, see extract_daisee_boredom.py

FER images are pooled and split by us (random 70/15/15) because FER has no
person-ID metadata -- confirmed with the project owner, since FER folders on
disk turned out to already have their own train/val/test subfolders, which we
deliberately re-pool and re-split rather than preserve.

UTA images are NOT re-split -- they arrive from disk already split by person
(fatigue/train, fatigue/val, fatigue/test), and we preserve that split
exactly so a person's face never appears in more than one of train/val/test.
"""
import random

from dataset_utils import (
    FER_ROOT, FATIGUE_ROOT, OUTPUT_ROOT, MAPPING_LOG_PATH,
    SPLITS, CAP_PER_SOURCE, RANDOM_SEED, FER_SPLIT_RATIOS,
    list_images, evenly_spaced_sample, copy_images, write_mapping_log, ensure_dir,
)

# source FER subfolder name -> target unified class
FER_SOURCES = {
    "happy": "focused",
    "neutral": "focused",
    "fear": "anxiety",
    "angry": "anxiety",
}

# source UTA fatigue subfolder name -> target unified class
# ("non_vigilant" is deliberately omitted -- ambiguous in-between state, see spec)
UTA_SOURCES = {
    "alert": "focused",
    "tired": "fatigue",
}


def pool_fer_images(class_name: str):
    """FER folders on disk each already have their own train/val/test
    subfolders (a surprise vs. the flat-folder assumption in the original
    spec). Since FER has no person-grouping info worth preserving, pool all
    three back together so we can do a fresh, clean random split below."""
    pooled = []
    for sub in ("train", "val", "test"):
        pooled.extend(list_images(FER_ROOT / class_name / sub))
    return pooled


def split_fer_pool(files):
    """Random 70/15/15 split with a fixed seed, so re-running this script
    reproduces the same split -- important for the methodology section:
    counts won't shift between runs."""
    rng = random.Random(RANDOM_SEED)
    shuffled = list(files)
    rng.shuffle(shuffled)
    n = len(shuffled)
    n_train = int(n * FER_SPLIT_RATIOS[0])
    n_val = int(n * FER_SPLIT_RATIOS[1])
    return {
        "train": shuffled[:n_train],
        "val": shuffled[n_train:n_train + n_val],
        "test": shuffled[n_train + n_val:],
    }


def build_fer_classes(log_rows):
    print("\n=== FER-sourced classes (random 70/15/15 split) ===")
    for fer_name, target_class in FER_SOURCES.items():
        pooled = pool_fer_images(fer_name)
        capped = evenly_spaced_sample(pooled, CAP_PER_SOURCE)
        print(f"FER/{fer_name}: {len(pooled)} images pooled, {len(capped)} kept after cap")
        splits = split_fer_pool(capped)
        for split_name, files in splits.items():
            dest_dir = OUTPUT_ROOT / split_name / target_class
            n = copy_images(files, dest_dir, f"FER_{fer_name}", target_class, split_name, log_rows)
            print(f"  -> {split_name}/{target_class}: +{n}")


def build_uta_classes(log_rows):
    print("\n=== UTA-RLDD fatigue-sourced classes (person-level split preserved) ===")
    for split_name in SPLITS:
        # UTA's on-disk split folders are already named train/val/test, so
        # this is a direct 1:1 map onto the unified dataset's split names.
        for uta_name, target_class in UTA_SOURCES.items():
            source_dir = FATIGUE_ROOT / split_name / uta_name
            files = list_images(source_dir)
            capped = evenly_spaced_sample(files, CAP_PER_SOURCE)
            dest_dir = OUTPUT_ROOT / split_name / target_class
            n = copy_images(capped, dest_dir, f"UTA_{uta_name}", target_class, split_name, log_rows)
            print(f"UTA/{split_name}/{uta_name}: {len(files)} available, {n} copied -> {split_name}/{target_class}")


def main():
    ensure_dir(OUTPUT_ROOT)
    log_rows = []
    build_fer_classes(log_rows)
    build_uta_classes(log_rows)
    write_mapping_log(log_rows, MAPPING_LOG_PATH, mode="w")
    print(f"\nWrote {len(log_rows)} rows to {MAPPING_LOG_PATH}")


if __name__ == "__main__":
    main()
