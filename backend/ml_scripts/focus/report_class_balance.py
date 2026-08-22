"""
Step 4 of the Student Focus Monitor ML pipeline: prints an image-count report
for focus_dataset_unified/, split by class and by train/val/test, and flags
classes that look too small or too imbalanced across splits before we spend
time training on them.

Run this AFTER build_unified_dataset.py and extract_daisee_boredom.py.
"""
from dataset_utils import OUTPUT_ROOT, CLASSES, SPLITS, list_images

MIN_TOTAL_PER_CLASS = 300
# A class whose split proportions differ from the others by more than this
# many percentage points is a sign that one class is riding a very different
# split rule (e.g. a fixed person-level split) than the rest.
MAX_RATIO_SPREAD = 0.15


def count_images():
    return {
        cls: {split: len(list_images(OUTPUT_ROOT / split / cls)) for split in SPLITS}
        for cls in CLASSES
    }


def main():
    counts = count_images()

    header = f"{'class':<10}" + "".join(f"{s:>10}" for s in SPLITS) + f"{'total':>10}"
    print(header)
    print("-" * len(header))

    totals = {}
    for cls in CLASSES:
        row = counts[cls]
        total = sum(row.values())
        totals[cls] = total
        print(f"{cls:<10}" + "".join(f"{row[s]:>10}" for s in SPLITS) + f"{total:>10}")

    print()
    flagged = False

    for cls, total in totals.items():
        if total < MIN_TOTAL_PER_CLASS:
            print(f"WARNING: class '{cls}' has only {total} images total "
                  f"(< {MIN_TOTAL_PER_CLASS}) -- likely too few to train on reliably")
            flagged = True

    ratios = {
        cls: {s: counts[cls][s] / totals[cls] for s in SPLITS}
        for cls in CLASSES if totals[cls] > 0
    }
    for split in SPLITS:
        values = [ratios[cls][split] for cls in ratios]
        if values and (max(values) - min(values) > MAX_RATIO_SPREAD):
            print(f"WARNING: '{split}' split proportion varies by more than "
                  f"{MAX_RATIO_SPREAD:.0%} across classes:")
            for cls in ratios:
                print(f"  {cls}: {ratios[cls][split]:.1%}")
            flagged = True

    if not flagged:
        print("Class balance looks reasonable: no class under the minimum, "
              "and split ratios are consistent across classes.")


if __name__ == "__main__":
    main()
