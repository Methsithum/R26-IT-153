"""
STEP 5 -- build a feature cache whose TRAIN split is oversampled with the
pipeline's own image augmentation (flip / +-15 rotation / brightness / zoom),
so the augmented configuration can be compared against the plain one.

Reuses train_model.py's scan / dedup / subject-disjoint split verbatim, so the
split is identical -- only the train features differ. Val and test are extracted
WITHOUT augmentation, as required.

Writes ONLY to experiments/results/. trained-models/focus/ is never touched.
"""
import sys, json
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))          # ml_scripts/focus
sys.path.insert(0, str(HERE))

import numpy as np
import train_model as T
from common import RESULTS

OUT = RESULTS / "features_cache_augmented.npz"

print("1. scanning datasets...", flush=True)
records  = T.scan(T.SBD_PATH,     T.SBD_MAP,     T.sbd_group,     "sbd",
                  ("train", "valid", "test"))
records += T.scan(T.FATIGUE_PATH, T.FATIGUE_MAP, T.fatigue_group, "fatigue",
                  ("train", "val", "test"))
print(f"   {len(records)} images", flush=True)

print("2. deduplicating...", flush=True)
unique = T.deduplicate(records)

print("3. subject-disjoint split...", flush=True)
splits = T.build_splits(unique)
T.report_splits(splits, unique)

print("\n4. balancing TRAIN ONLY via image augmentation...", flush=True)
train_items = T.build_items(splits["train"], balance=True)
print(f"   val/test built WITHOUT augmentation", flush=True)

print("\n5. MobileNetV2 feature extraction (slow, CPU)...", flush=True)
mob = T.MobileNetV2(weights="imagenet", include_top=False, pooling="avg",
                    input_shape=(T.IMG_SIZE, T.IMG_SIZE, 3))
mob.trainable = False

X_train, y_train, s_train = T.extract(mob, train_items, "train")
X_val,   y_val,   s_val   = T.extract(mob, T.build_items(splits["val"]),  "val  ")
X_test,  y_test,  s_test  = T.extract(mob, T.build_items(splits["test"]), "test ")

np.savez_compressed(OUT,
                    X_train=X_train, y_train=y_train, s_train=s_train,
                    X_val=X_val,     y_val=y_val,     s_val=s_val,
                    X_test=X_test,   y_test=y_test,   s_test=s_test)
print(f"\nwrote {OUT}", flush=True)
for s, y in (("train", y_train), ("val", y_val), ("test", y_test)):
    print(f"   {s:<6} {dict(sorted(Counter(y).items()))}", flush=True)
