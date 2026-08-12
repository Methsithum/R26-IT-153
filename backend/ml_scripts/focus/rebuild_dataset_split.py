"""
Rebuilds Final_dataset into a leakage-free Final_dataset_clean.

Problem: the original train/val/test folders contain byte-identical duplicate
images across splits (Roboflow's filename hash reveals exact content matches),
so the model was being evaluated on images it had already been trained on.

Fix: pool all unique images per class (dedup by filename across the whole
dataset, and drop any file whose name collides across two different classes),
then carve a fresh stratified 70/15/15 train/val/test split with zero overlap.
Files are copied (not moved) into Final_dataset_clean so the original data is
untouched.
"""
import shutil
import random
from pathlib import Path
from collections import defaultdict

SEED = 42
random.seed(SEED)

BASE_DIR = Path(__file__).resolve().parents[2]
SRC = BASE_DIR / "datasets" / "focus" / "Final_dataset_RAW_leaky_do_not_use"
DST = BASE_DIR / "datasets" / "focus" / "Final_dataset_clean"

CLASSES = ["Focused", "Fatigue", "Anxiety", "Boredom"]
SPLIT_RATIOS = {"train": 0.70, "val": 0.15, "test": 0.15}

IMG_EXTS = (".jpg", ".jpeg", ".png", ".bmp")


def collect_unique_per_class():
    # filename -> (class, path), first occurrence wins; track cross-class collisions
    by_class = defaultdict(dict)  # class -> {filename: path}
    filename_classes = defaultdict(set)  # filename -> set of classes seen in

    for cls in CLASSES:
        cls_root = SRC / "train" / cls
        for split in ("train", "val", "test"):
            split_cls = SRC / split / cls
            if not split_cls.is_dir():
                continue
            for p in split_cls.rglob("*"):
                if p.suffix.lower() not in IMG_EXTS:
                    continue
                by_class[cls].setdefault(p.name, p)
                filename_classes[p.name].add(cls)

    # Drop filenames that appear under more than one class label (ambiguous)
    conflicted = {name for name, classes in filename_classes.items() if len(classes) > 1}
    for cls in CLASSES:
        for name in conflicted:
            by_class[cls].pop(name, None)

    return by_class, conflicted


def stratified_split(paths):
    paths = list(paths)
    random.shuffle(paths)
    n = len(paths)
    n_train = int(n * SPLIT_RATIOS["train"])
    n_val = int(n * SPLIT_RATIOS["val"])
    return {
        "train": paths[:n_train],
        "val": paths[n_train:n_train + n_val],
        "test": paths[n_train + n_val:],
    }


def main():
    print("Collecting unique images per class...")
    by_class, conflicted = collect_unique_per_class()
    if conflicted:
        print(f"  Dropped {len(conflicted)} filename(s) with conflicting class labels: {conflicted}")

    if DST.exists():
        print(f"Removing existing {DST}...")
        shutil.rmtree(DST)

    summary = {}
    for cls in CLASSES:
        paths = list(by_class[cls].values())
        splits = stratified_split(paths)
        summary[cls] = {k: len(v) for k, v in splits.items()}

        for split_name, split_paths in splits.items():
            out_dir = DST / split_name / cls
            out_dir.mkdir(parents=True, exist_ok=True)
            for p in split_paths:
                shutil.copy2(p, out_dir / p.name)

    print("\nClean dataset built:", DST)
    print(f"{'Class':<10} {'Train':>8} {'Val':>8} {'Test':>8} {'Total':>8}")
    for cls in CLASSES:
        s = summary[cls]
        total = s["train"] + s["val"] + s["test"]
        print(f"{cls:<10} {s['train']:>8} {s['val']:>8} {s['test']:>8} {total:>8}")


if __name__ == "__main__":
    main()
