"""
Student Focus Monitoring -- training pipeline.

Builds the 4-class focus-state model consumed by
backend/app/services/focus/inference.py:

    Focused | Fatigue | Anxiety | Boredom

Sources
    datasets/focus/Student Behavior Detection  -> Focused, Boredom, Anxiety
    datasets/focus/fatigue                     -> Fatigue (+ some Focused)

Pipeline
    1. scan      - walk both datasets, map their labels onto the 4 classes
    2. clean     - drop byte-identical duplicates and label-conflicting images
    3. split     - subject-disjoint 70/15/15 (see note below)
    4. balance   - augment minority classes up to the majority count (train only)
    5. features  - frozen MobileNetV2, 1280-d, cached to disk
    6. train     - Random Forest, XGBoost, SVM
    7. evaluate  - macro-F1 picks the winner; charts + per-source audit
    8. save      - artifacts under the exact names inference.py loads

Why the shipped split is rebuilt: the Student Behavior Detection folders carry
DAiSEE clip ids in their filenames, and 28 of the 29 subjects in its test folder
also appear in its train folder. Frames of one person are near-identical, so the
original split scores the model on faces it already memorised.

Usage
    python train_model.py                  # uses cached features when present
    python train_model.py --rebuild-cache  # re-extract features from images
"""
import argparse
import hashlib
import json
import random
import re
import warnings
from collections import Counter, defaultdict
from pathlib import Path

import cv2
import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
import xgboost as xgb
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (accuracy_score, classification_report,
                             confusion_matrix, f1_score)
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.svm import SVC
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

warnings.filterwarnings("ignore")
sns.set_style("whitegrid")

# ══════════════════════════════════════════════════════
# SETTINGS
# ══════════════════════════════════════════════════════

SEED = 42
random.seed(SEED)
np.random.seed(SEED)

BASE_DIR     = Path(__file__).resolve().parents[2]
DATASETS     = BASE_DIR / "datasets" / "focus"
SBD_PATH     = DATASETS / "Student Behavior Detection"
FATIGUE_PATH = DATASETS / "fatigue"
OUTPUT_PATH  = BASE_DIR / "trained-models" / "focus"
OUTPUT_PATH.mkdir(parents=True, exist_ok=True)

CLASSES      = ["Focused", "Fatigue", "Anxiety", "Boredom"]
IMG_SIZE     = 224
BATCH_SIZE   = 32
IMG_EXTS     = (".jpg", ".jpeg", ".png", ".bmp")
SPLIT_RATIOS = {"train": 0.70, "val": 0.15, "test": 0.15}
CACHE_FILE   = OUTPUT_PATH / "features_cache.npz"

# Source vocabularies folded onto the 4 backend classes.
# Confusion joins Frustration under Anxiety: both are negative-arousal affect in
# DAiSEE terms, and merging lifts the otherwise very thin Anxiety class.
SBD_MAP = {
    "Engagement":  "Focused",
    "Boredom":     "Boredom",
    "Frustration": "Anxiety",
    "Confusion":   "Anxiety",
}
# non_vigilant is drowsy-but-not-asleep, which still reads as fatigue at
# inference time, so it joins tired rather than forming its own class.
FATIGUE_MAP = {
    "alert":        "Focused",
    "tired":        "Fatigue",
    "non_vigilant": "Fatigue",
}

# Subject/session id embedded in the filename, used to keep one person's frames
# inside a single split.
#   SBD     : cropped_face_0_1100021015_frame_105-Copie_jpg.rf.<hash>.jpg
#   fatigue : 1001_frame1.jpg
SBD_ID_RE     = re.compile(r"_(\d+)_frame")
FATIGUE_ID_RE = re.compile(r"^(\d+)_frame")


def sbd_group(name):
    """DAiSEE clip ids are 10 digits whose first 6 identify the person, so group
    on those. Other id lengths come from a different capture session and are
    grouped whole. None when the filename carries no usable id."""
    m = SBD_ID_RE.search(name)
    if not m:
        return None
    cid = m.group(1)
    if len(cid) < 4:            # 'cropped_face_0_frame_112...' -> no real id
        return None
    return f"sbd:{cid[:6]}" if len(cid) == 10 else f"sbd:{cid}"


def fatigue_group(name):
    m = FATIGUE_ID_RE.match(name)
    return f"fat:{m.group(1)}" if m else None


# ══════════════════════════════════════════════════════
# 1. SCAN
# ══════════════════════════════════════════════════════

def scan(root, label_map, group_fn, source, split_names):
    """-> list of {path, label, group, source} for one dataset."""
    records = []
    if not root.is_dir():
        print(f"   !! missing {root}")
        return records
    for split in split_names:
        for src_label, target in label_map.items():
            d = root / split / src_label
            if not d.is_dir():
                continue
            for p in sorted(d.rglob("*")):
                if p.suffix.lower() in IMG_EXTS:
                    records.append({"path":   p,
                                    "label":  target,
                                    "group":  group_fn(p.name),
                                    "source": source})
    return records


# ══════════════════════════════════════════════════════
# 2. CLEAN
# ══════════════════════════════════════════════════════

def file_hash(path, chunk=1 << 20):
    h = hashlib.md5()
    with open(path, "rb") as f:
        while blk := f.read(chunk):
            h.update(blk)
    return h.hexdigest()


def deduplicate(records):
    """Collapse byte-identical images; drop any whose copies disagree on label."""
    seen, unique, dups, conflicts = {}, [], 0, 0

    for i, r in enumerate(records, 1):
        if i % 2000 == 0:
            print(f"   hashing {i}/{len(records)}", end="\r")
        h    = file_hash(r["path"])
        prev = seen.get(h)
        if prev is None:
            seen[h] = r
            unique.append(r)
        else:
            dups += 1
            if prev["label"] != r["label"]:
                prev["_conflict"] = True
                conflicts += 1

    before = len(unique)
    unique = [r for r in unique if not r.get("_conflict")]
    print(f"   hashing {len(records)}/{len(records)} done      ")
    print(f"   duplicates removed       : {dups}")
    print(f"   label-conflicting images : {conflicts} "
          f"(dropped {before - len(unique)} records)")
    print(f"   unique images kept       : {len(unique)}")
    return unique


# ══════════════════════════════════════════════════════
# 3. SUBJECT-DISJOINT SPLIT
# ══════════════════════════════════════════════════════

def build_splits(unique):
    """A subject shows several states, so their frames appear under multiple
    classes. Groups are therefore assigned ONCE, globally -- assigning them per
    class would put the same person in train for one label and test for
    another."""
    grouped   = defaultdict(list)   # group -> [rec] across all classes
    ungrouped = defaultdict(list)   # label -> [rec]

    for r in unique:
        if r["group"]:
            grouped[r["group"]].append(r)
        else:
            ungrouped[r["label"]].append(r)

    split_of     = {}
    class_totals = Counter(r["label"] for r in unique)
    quota  = {s: {c: SPLIT_RATIOS[s] * class_totals[c] for c in CLASSES}
              for s in SPLIT_RATIOS}
    filled = {s: {c: 0.0 for c in CLASSES} for s in SPLIT_RATIOS}

    def cost(split, counts):
        """Worst-case proportional fill if `split` takes a group with `counts`.
        Measuring fill as a fraction of quota (not raw overflow) preserves the
        70/15/15 shape: the relatively emptiest split wins the next group."""
        return max((filled[split][c] + n) / max(quota[split][c], 1.0)
                   for c, n in counts.items())

    groups = list(grouped.values())
    random.Random(SEED).shuffle(groups)
    groups.sort(key=len, reverse=True)   # largest groups constrain the most

    for recs in groups:
        counts = Counter(r["label"] for r in recs)
        pick   = min(SPLIT_RATIOS, key=lambda s: cost(s, counts))
        for r in recs:
            split_of[id(r)] = pick
            filled[pick][r["label"]] += 1

    # Id-less files cannot be grouped; split them per class at the plain ratios.
    for cls in CLASSES:
        loose = ungrouped[cls][:]
        random.Random(SEED).shuffle(loose)
        n_tr = int(len(loose) * SPLIT_RATIOS["train"])
        n_va = int(len(loose) * SPLIT_RATIOS["val"])
        for r in loose[:n_tr]:
            split_of[id(r)] = "train"
        for r in loose[n_tr:n_tr + n_va]:
            split_of[id(r)] = "val"
        for r in loose[n_tr + n_va:]:
            split_of[id(r)] = "test"

    splits = {"train": [], "val": [], "test": []}
    for r in unique:
        splits[split_of[id(r)]].append(r)
    return splits


def report_splits(splits, unique):
    print(f"\n   {'Class':<9}{'Train':>8}{'Val':>7}{'Test':>7}{'Total':>8}")
    print("   " + "-" * 39)
    for cls in CLASSES:
        c = {s: sum(1 for r in splits[s] if r["label"] == cls) for s in splits}
        print(f"   {cls:<9}{c['train']:>8}{c['val']:>7}{c['test']:>7}{sum(c.values()):>8}")
    print("   " + "-" * 39)
    print(f"   {'TOTAL':<9}{len(splits['train']):>8}{len(splits['val']):>7}"
          f"{len(splits['test']):>7}{len(unique):>8}")

    gs = {s: {r["group"] for r in splits[s] if r["group"]} for s in splits}
    print("\n   subject-group overlap (must all be 0):")
    print(f"     train vs val : {len(gs['train'] & gs['val'])}")
    print(f"     train vs test: {len(gs['train'] & gs['test'])}")
    print(f"     val   vs test: {len(gs['val']   & gs['test'])}")


# ══════════════════════════════════════════════════════
# 4. BALANCE + AUGMENT
# ══════════════════════════════════════════════════════

def augment(img):
    """flip / rotation / brightness / zoom"""
    if np.random.rand() > 0.5:
        img = cv2.flip(img, 1)

    h, w = img.shape[:2]
    M    = cv2.getRotationMatrix2D((w / 2, h / 2), np.random.uniform(-15, 15), 1.0)
    img  = cv2.warpAffine(img, M, (w, h), borderMode=cv2.BORDER_REFLECT)

    img = np.clip(img.astype(np.float32) * np.random.uniform(0.7, 1.3),
                  0, 255).astype(np.uint8)

    if np.random.rand() > 0.5:
        z      = np.random.uniform(0.85, 1.0)
        ch, cw = int(h * z), int(w * z)
        y1     = np.random.randint(0, h - ch + 1)
        x1     = np.random.randint(0, w - cw + 1)
        img    = cv2.resize(img[y1:y1 + ch, x1:x1 + cw], (w, h))

    return img


def build_items(recs, balance=False):
    """-> [(path, label, source, do_augment)], images never held in RAM."""
    items = [(r["path"], r["label"], r["source"], False) for r in recs]

    if balance:
        by_cls = defaultdict(list)
        for r in recs:
            by_cls[r["label"]].append(r)
        target = max(len(v) for v in by_cls.values())
        for cls in CLASSES:
            rs = by_cls.get(cls)
            if not rs:
                continue
            need = target - len(rs)
            for i in range(need):
                r = rs[i % len(rs)]
                items.append((r["path"], r["label"], r["source"], True))
            print(f"     {cls:<9} {len(rs):>6} -> {target} (aug +{need})")
        print(f"     balanced total: {len(items)}")

    random.Random(SEED).shuffle(items)
    return items


# ══════════════════════════════════════════════════════
# 5. FEATURES
# ══════════════════════════════════════════════════════

def extract(mobilenet, items, tag):
    feats, labels, sources = [], [], []
    total = len(items)

    for i in range(0, total, BATCH_SIZE):
        batch, imgs, keep = items[i:i + BATCH_SIZE], [], []
        for path, label, source, do_aug in batch:
            img = cv2.imread(str(path))
            if img is None:
                continue
            img = cv2.resize(cv2.cvtColor(img, cv2.COLOR_BGR2RGB),
                             (IMG_SIZE, IMG_SIZE))
            if do_aug:
                img = augment(img)
            imgs.append(preprocess_input(img.astype(np.float32)))
            keep.append((label, source))

        if not imgs:
            continue

        feats.extend(mobilenet.predict(np.array(imgs), verbose=0))
        labels.extend(l for l, _ in keep)
        sources.extend(s for _, s in keep)
        print(f"   {tag}: {min(i + BATCH_SIZE, total)}/{total}", end="\r")

    print(f"   {tag}: {total}/{total} done      ")
    return np.array(feats), np.array(labels), np.array(sources)


# ══════════════════════════════════════════════════════
# 7. CHARTS
# ══════════════════════════════════════════════════════

def plot_accuracy(results, best_name):
    names     = list(results)
    val_accs  = [results[n]["val_acc"] * 100 for n in names]
    test_accs = [results[n]["test_acc"] * 100 for n in names]
    colors    = ["#4CAF50" if n == best_name else "#2196F3" for n in names]

    fig, axes = plt.subplots(1, 2, figsize=(13, 5))
    fig.suptitle("Algorithm Comparison - Student Focus Monitoring",
                 fontsize=13, fontweight="bold")
    for ax, accs, title in zip(axes, [val_accs, test_accs],
                               ["Validation Accuracy", "Test Accuracy"]):
        bars = ax.bar(names, accs, color=colors, edgecolor="white", width=0.5)
        ax.set_title(title)
        ax.set_ylabel("Accuracy (%)")
        ax.set_ylim(0, 105)
        for b, v in zip(bars, accs):
            ax.text(b.get_x() + b.get_width() / 2, v + 1, f"{v:.1f}%",
                    ha="center", fontweight="bold", fontsize=10)
    plt.tight_layout()
    plt.savefig(OUTPUT_PATH / "accuracy_comparison.png", dpi=150)
    plt.close()


def plot_confusion(y_te, y_pred, classes, best_name):
    cm   = confusion_matrix(y_te, y_pred)
    cm_n = cm.astype(float) / cm.sum(axis=1, keepdims=True).clip(min=1)

    fig, axes = plt.subplots(1, 2, figsize=(15, 6))
    for ax, data, fmt, title in [
        (axes[0], cm,   "d",   f"Confusion Matrix - {best_name}"),
        (axes[1], cm_n, ".2f", "Row-normalised (recall per class)"),
    ]:
        sns.heatmap(data, annot=True, fmt=fmt, cmap="Blues", cbar=False,
                    xticklabels=classes, yticklabels=classes, ax=ax)
        ax.set_title(title, fontweight="bold")
        ax.set_xlabel("Predicted")
        ax.set_ylabel("Actual")
    plt.tight_layout()
    plt.savefig(OUTPUT_PATH / "confusion_matrix.png", dpi=150)
    plt.close()


def plot_f1(results, y_te, classes):
    f1_by_alg = {}
    for name, r in results.items():
        rep = classification_report(y_te, r["test_pred"], target_names=classes,
                                    output_dict=True, zero_division=0)
        f1_by_alg[name] = {c: rep[c]["f1-score"] for c in classes}

    fig, ax = plt.subplots(figsize=(10, 5))
    x, w = np.arange(len(classes)), 0.25
    for i, (alg, clr) in enumerate(zip(results, ["#4CAF50", "#2196F3", "#FF9800"])):
        vals = [f1_by_alg[alg][c] * 100 for c in classes]
        bars = ax.bar(x + i * w, vals, w, label=alg, color=clr, edgecolor="white")
        for b, v in zip(bars, vals):
            ax.text(b.get_x() + b.get_width() / 2, v + 0.5, f"{v:.0f}",
                    ha="center", fontsize=8, fontweight="bold")
    ax.set_xticks(x + w)
    ax.set_xticklabels(classes)
    ax.set_ylabel("F1 Score (%)")
    ax.set_ylim(0, 110)
    ax.set_title("Per-Class F1 Score Comparison", fontsize=13, fontweight="bold")
    ax.axhline(75, color="red", linestyle="--", alpha=0.5)
    ax.legend()
    plt.tight_layout()
    plt.savefig(OUTPUT_PATH / "f1_comparison.png", dpi=150)
    plt.close()


# ══════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--rebuild-cache", action="store_true",
                    help="re-extract MobileNetV2 features instead of loading the cache")
    args = ap.parse_args()

    print("=" * 60)
    print("  Student Focus Monitoring - Model Training")
    print("=" * 60)
    print(f"  Datasets : {DATASETS}")
    print(f"  Output   : {OUTPUT_PATH}")
    print(f"  Classes  : {', '.join(CLASSES)}")
    print("=" * 60)

    # -- 1. scan ------------------------------------------------------
    print("\n1. Scanning datasets...")
    sbd = scan(SBD_PATH, SBD_MAP, sbd_group, "sbd", ("train", "valid", "test"))
    fat = scan(FATIGUE_PATH, FATIGUE_MAP, fatigue_group, "fatigue",
               ("train", "val", "test"))
    records = sbd + fat
    if not records:
        raise SystemExit("No images found -- check the dataset paths above.")
    print(f"   sbd={len(sbd)}  fatigue={len(fat)}  total={len(records)}")
    for cls, n in Counter(r["label"] for r in records).most_common():
        print(f"     {cls:<9} {n:>6}")

    # -- 2. clean -----------------------------------------------------
    print("\n2. Cleaning (dedup + label conflicts)...")
    unique = deduplicate(records)
    for cls, n in Counter(r["label"] for r in unique).most_common():
        print(f"     {cls:<9} {n:>6}")

    # -- 3. split -----------------------------------------------------
    print("\n3. Subject-disjoint split (70/15/15)...")
    splits = build_splits(unique)
    report_splits(splits, unique)

    # -- 4/5. balance + features --------------------------------------
    # A cache is only reusable if it was built from this exact split; otherwise
    # it silently trains on someone else's data (or is missing keys entirely).
    signature = json.dumps({"classes": CLASSES,
                            "splits": {s: dict(Counter(r["label"] for r in v))
                                       for s, v in splits.items()}},
                           sort_keys=True)
    cached = None
    if CACHE_FILE.exists() and not args.rebuild_cache:
        c = np.load(CACHE_FILE, allow_pickle=True)
        needed = {"X_train", "y_train", "s_train", "X_val", "y_val", "s_val",
                  "X_test", "y_test", "s_test", "signature"}
        if not needed.issubset(set(c.files)):
            print(f"\n4/5. Cache {CACHE_FILE.name} predates this pipeline "
                  f"-- re-extracting.")
        elif str(c["signature"]) != signature:
            print(f"\n4/5. Cache {CACHE_FILE.name} was built from a different "
                  f"split -- re-extracting.")
        else:
            cached = c

    if cached is not None:
        c = cached
        print(f"\n4/5. Loading cached features: {CACHE_FILE.name}")
        X_train, y_train, s_train = c["X_train"], c["y_train"], c["s_train"]
        X_val,   y_val,   s_val   = c["X_val"],   c["y_val"],   c["s_val"]
        X_test,  y_test,  s_test  = c["X_test"],  c["y_test"],  c["s_test"]
    else:
        print("\n4/5. Loading MobileNetV2...")
        mobilenet = MobileNetV2(weights="imagenet", include_top=False,
                                pooling="avg",
                                input_shape=(IMG_SIZE, IMG_SIZE, 3))
        mobilenet.trainable = False
        print("   ready (1280-d output)")

        print("\n   Balancing train split...")
        train_items = build_items(splits["train"], balance=True)

        print("\n   Extracting features...")
        X_train, y_train, s_train = extract(mobilenet, train_items, "train")
        X_val,   y_val,   s_val   = extract(mobilenet, build_items(splits["val"]),  "val  ")
        X_test,  y_test,  s_test  = extract(mobilenet, build_items(splits["test"]), "test ")

        np.savez_compressed(CACHE_FILE,
                            X_train=X_train, y_train=y_train, s_train=s_train,
                            X_val=X_val,     y_val=y_val,     s_val=s_val,
                            X_test=X_test,   y_test=y_test,   s_test=s_test,
                            signature=signature)
        print(f"   cache written -> {CACHE_FILE.name}")

    print(f"\n   train {X_train.shape} | val {X_val.shape} | test {X_test.shape}")

    # Encode + scale (SVM needs the scaled features)
    le = LabelEncoder().fit(CLASSES)   # alphabetical: Anxiety, Boredom, Fatigue, Focused
    y_tr, y_v, y_te = (le.transform(y_train), le.transform(y_val),
                       le.transform(y_test))

    scaler  = StandardScaler().fit(X_train)
    X_tr_sc = scaler.transform(X_train)
    X_v_sc  = scaler.transform(X_val)
    X_te_sc = scaler.transform(X_test)
    print(f"   label order: {list(le.classes_)}")

    # -- 6. train -----------------------------------------------------
    print("\n6. Training...")
    results = {}

    print("   [1/3] Random Forest...")
    rf = RandomForestClassifier(n_estimators=300, max_depth=24, min_samples_leaf=2,
                                class_weight="balanced", n_jobs=-1,
                                random_state=SEED)
    rf.fit(X_train, y_tr)
    results["Random Forest"] = {"model": rf, "scaled": False}

    print("   [2/3] XGBoost...")
    xgb_m = xgb.XGBClassifier(n_estimators=400, max_depth=8, learning_rate=0.05,
                              subsample=0.8, colsample_bytree=0.8,
                              eval_metric="mlogloss", random_state=SEED, n_jobs=-1)
    xgb_m.fit(X_train, y_tr, eval_set=[(X_val, y_v)], verbose=False)
    results["XGBoost"] = {"model": xgb_m, "scaled": False}

    print("   [3/3] SVM...")
    n_svm = min(15000, len(X_tr_sc))
    idx   = np.random.RandomState(SEED).choice(len(X_tr_sc), n_svm, replace=False)
    svm   = SVC(kernel="rbf", C=10, gamma="scale", class_weight="balanced",
                probability=True, random_state=SEED)
    svm.fit(X_tr_sc[idx], y_tr[idx])
    results["SVM"] = {"model": svm, "scaled": True}

    for name, r in results.items():
        Xv = X_v_sc  if r["scaled"] else X_val
        Xt = X_te_sc if r["scaled"] else X_test
        pv, pt = r["model"].predict(Xv), r["model"].predict(Xt)
        r["val_acc"]   = accuracy_score(y_v, pv)
        r["test_acc"]  = accuracy_score(y_te, pt)
        r["test_f1"]   = f1_score(y_te, pt, average="macro")
        r["test_pred"] = pt

    # Macro-F1 picks the winner, not accuracy: Focused dominates the data, so a
    # model that always answered "Focused" would still post a decent accuracy.
    best_name = max(results, key=lambda n: results[n]["test_f1"])
    best      = results[best_name]

    # -- 7. evaluate --------------------------------------------------
    print("\n7. Results")
    print("=" * 52)
    print(f"   {'Algorithm':<15}{'Val acc':>10}{'Test acc':>10}{'Test F1':>10}")
    print("   " + "-" * 45)
    for name, r in results.items():
        mark = "  <- BEST" if name == best_name else ""
        print(f"   {name:<15}{r['val_acc']*100:>9.2f}%{r['test_acc']*100:>9.2f}%"
              f"{r['test_f1']*100:>9.2f}%{mark}")
    print("=" * 52)

    print(f"\n   Classification report - {best_name}\n")
    print(classification_report(y_te, best["test_pred"],
                               target_names=list(le.classes_), digits=3))

    # Per-source accuracy: Fatigue comes only from the fatigue dataset, so the
    # model could learn "which camera" instead of "which state". A large gap
    # between the two sources is the tell.
    print("   per-source test accuracy:")
    for src in np.unique(s_test):
        m = s_test == src
        print(f"     {src:<8} n={int(m.sum()):<6} "
              f"acc={accuracy_score(y_te[m], best['test_pred'][m])*100:.2f}%")

    plot_accuracy(results, best_name)
    plot_confusion(y_te, best["test_pred"], list(le.classes_), best_name)
    plot_f1(results, y_te, list(le.classes_))
    print(f"\n   charts saved -> {OUTPUT_PATH}")

    # -- 8. save ------------------------------------------------------
    print("\n8. Saving artifacts...")
    joblib.dump(best["model"], OUTPUT_PATH / "best_model.pkl")
    joblib.dump(scaler,        OUTPUT_PATH / "scaler.pkl")
    joblib.dump(le,            OUTPUT_PATH / "label_encoder.pkl")

    # inference.py loads the extractor from disk, so it must exist even on a
    # cached-feature run.
    if not (OUTPUT_PATH / "feature_extractor.keras").exists() or args.rebuild_cache:
        extractor = MobileNetV2(weights="imagenet", include_top=False,
                                pooling="avg",
                                input_shape=(IMG_SIZE, IMG_SIZE, 3))
        extractor.trainable = False
        extractor.save(str(OUTPUT_PATH / "feature_extractor.keras"))

    report = {
        "best_algorithm": best_name,
        "test_accuracy":  round(best["test_acc"] * 100, 2),
        "test_macro_f1":  round(best["test_f1"] * 100, 2),
        "classes":        CLASSES,
        "needs_scaling":  best["scaled"],
        "img_size":       IMG_SIZE,
        "datasets":       ["Student Behavior Detection", "fatigue"],
        "split":          "subject-disjoint 70/15/15, byte-duplicates removed",
        "counts":         {s: len(v) for s, v in splits.items()},
        "all_results": {
            n: {"val":  round(r["val_acc"] * 100, 2),
                "test": round(r["test_acc"] * 100, 2),
                "f1":   round(r["test_f1"] * 100, 2)}
            for n, r in results.items()
        },
    }
    with open(OUTPUT_PATH / "model_report.json", "w") as f:
        json.dump(report, f, indent=2)

    for name in ("best_model.pkl", "scaler.pkl", "label_encoder.pkl",
                 "feature_extractor.keras", "model_report.json",
                 "accuracy_comparison.png", "confusion_matrix.png",
                 "f1_comparison.png"):
        p = OUTPUT_PATH / name
        tag = f"{p.stat().st_size / 1e6:.1f} MB" if p.exists() else "MISSING"
        print(f"   {'ok ' if p.exists() else '!! '}{name:<28}{tag}")

    print("\n" + "=" * 60)
    print(f"  Done. Best: {best_name} "
          f"(acc {best['test_acc']*100:.2f}% / macro-F1 {best['test_f1']*100:.2f}%)")
    print("=" * 60)


if __name__ == "__main__":
    main()
