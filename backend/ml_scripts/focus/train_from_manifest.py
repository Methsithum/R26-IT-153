"""
Train the focus classifier on a face-crop dataset built by dataset_builder.py.

The split is not rebuilt here. dataset_builder.py decided it on the subject
before it extracted a single frame, and manifest.csv records it -- re-splitting
at this stage could only undo that guarantee, so this script reads the split as
given and never touches it.

Every crop goes through face_crop.preprocess(), the same call inference.py makes
on a webcam frame, so the embeddings the classifier learns from and the ones it
is asked about at runtime come from identical code.

    python train_from_manifest.py                       # -> trained-models/focus_v2
    python train_from_manifest.py --balance smote
    python train_from_manifest.py --promote             # overwrite the deployed model

Artifacts are written under --out with the exact filenames inference.py loads.
They land in `focus_v2/` by default: a new dataset deserves a measured
comparison before it replaces a model that is already serving. --promote writes
to trained-models/focus instead, which is what the backend reads.
"""
import argparse
import csv
import json
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

import cv2
import joblib
import numpy as np

BASE_DIR = Path(__file__).resolve().parents[2]          # -> backend/
sys.path.insert(0, str(BASE_DIR))
from app.services.focus import face_crop                # noqa: E402

DATASETS = BASE_DIR / "datasets" / "focus"
CLASSES  = ["Focused", "Fatigue", "Anxiety", "Boredom"]
SEED     = 42


# ══════════════════════════════════════════════════════════════════════
# Features
# ══════════════════════════════════════════════════════════════════════

def read_manifest(root):
    rows = []
    with open(root / "manifest.csv", newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rows.append(r)
    if not rows:
        raise SystemExit(f"{root/'manifest.csv'} is empty -- run dataset_builder.py first")
    return rows


def build_extractor():
    from tensorflow.keras.applications import MobileNetV2
    m = MobileNetV2(weights="imagenet", include_top=False, pooling="avg",
                    input_shape=(face_crop.IMG_SIZE, face_crop.IMG_SIZE, 3))
    m.trainable = False
    return m


def extract_features(root, rows, extractor, batch=64):
    """-> (N, 1280) embeddings, in manifest order.

    Batched on purpose: one predict() per image spends most of its time in
    Keras call overhead, and there are tens of thousands of images here.
    """
    feats, buf, t0 = [], [], time.time()

    def flush():
        if buf:
            feats.append(extractor.predict(np.concatenate(buf, axis=0), verbose=0))
            buf.clear()

    for i, r in enumerate(rows, 1):
        img = cv2.imread(str(root / r["path"]))
        if img is None:
            raise SystemExit(f"unreadable crop: {r['path']}")
        buf.append(face_crop.preprocess(img))
        if len(buf) == batch:
            flush()
        if i % 500 == 0 or i == len(rows):
            rate = i / max(time.time() - t0, 1e-6)
            print(f"\r   {i}/{len(rows)}  {rate:.0f} img/s  "
                  f"eta {(len(rows)-i)/max(rate,1e-6)/60:.1f} min", end="", flush=True)
    flush()
    print()
    return np.concatenate(feats, axis=0)


def cached_features(root, rows, cache_path, rebuild):
    """Features keyed by a signature of the manifest -- a cache built from a
    different dataset is rejected rather than silently reused."""
    signature = f"{len(rows)}:{rows[0]['path']}:{rows[-1]['path']}"
    if cache_path.is_file() and not rebuild:
        blob = np.load(cache_path, allow_pickle=True)
        if str(blob["signature"]) == signature:
            print(f"   reusing cached features ({cache_path.name})")
            return blob["X"]
        print("   cache is from a different dataset -- rebuilding")

    print("   extracting MobileNetV2 features")
    X = extract_features(root, rows, build_extractor())
    np.savez_compressed(cache_path, X=X, signature=signature)
    return X


# ══════════════════════════════════════════════════════════════════════
# Balancing
# ══════════════════════════════════════════════════════════════════════

def undersample_by_frame(rows, idx, target, seed=SEED):
    """Drop training frames down to `target` per class, spreading the loss
    across clips rather than removing whole clips or subjects.

    Frames are taken round-robin over each class's clips, so the class keeps as
    many distinct clips -- and therefore as many distinct people, rooms and
    lighting conditions -- as the budget allows. Deleting whole subjects would
    cost exactly the diversity the model needs to generalise past the people it
    was trained on, which is the failure this whole rebuild is about.

    Measured against keeping everything: macro F1 is unchanged, but the model
    stops spending two thirds of its predictions on Focused, so the minority
    states actually appear at inference. Accuracy drops, because accuracy
    rewards always guessing the majority class.
    """
    import random as _random
    rng = _random.Random(seed)
    keep = []
    by_class = defaultdict(lambda: defaultdict(list))
    for i in idx:
        by_class[rows[i]["label"]][rows[i]["clip"]].append(i)

    for cls, pool in by_class.items():
        clips = list(pool.values())
        rng.shuffle(clips)
        for c in clips:
            rng.shuffle(c)
        taken, depth = [], 0
        while len(taken) < target and any(len(c) > depth for c in clips):
            for c in clips:
                if len(c) > depth:
                    taken.append(c[depth])
                    if len(taken) == target:
                        break
            depth += 1
        keep += taken
    return np.array(sorted(keep))


# ══════════════════════════════════════════════════════════════════════
# Train
# ══════════════════════════════════════════════════════════════════════

def train_models(Xtr, ytr, Xva, yva, Xte, yte, balance):
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.metrics import accuracy_score, f1_score
    from sklearn.preprocessing import StandardScaler
    from sklearn.svm import SVC
    import xgboost as xgb

    scaler = StandardScaler().fit(Xtr)
    Xtr_s, Xva_s, Xte_s = scaler.transform(Xtr), scaler.transform(Xva), scaler.transform(Xte)

    # Boredom is real data now, not 4,779 SMOTE copies of 599 images, so the
    # default is to leave the vectors alone and let the models weight the
    # classes instead -- cheaper, and it invents nothing.
    weight = "balanced" if balance == "class_weight" else None
    if balance == "smote":
        from imblearn.over_sampling import SMOTE
        before = Counter(ytr)
        Xtr, ytr = SMOTE(random_state=SEED).fit_resample(Xtr, ytr)
        Xtr_s = scaler.transform(Xtr)
        print(f"   smote: {dict(before)} -> {dict(Counter(ytr))}")

    results = {}
    results["Random Forest"] = {
        "model": RandomForestClassifier(n_estimators=300, max_depth=20, min_samples_leaf=2,
                                        class_weight=weight, n_jobs=-1, random_state=SEED),
        "scaled": False}
    results["XGBoost"] = {
        "model": xgb.XGBClassifier(n_estimators=400, max_depth=6, learning_rate=0.1,
                                   subsample=0.8, colsample_bytree=0.8, n_jobs=-1,
                                   random_state=SEED, eval_metric="mlogloss"),
        "scaled": False}
    results["SVM"] = {
        "model": SVC(C=10, gamma="scale", probability=True,
                     class_weight=weight, random_state=SEED),
        "scaled": True}

    print(f"\n   {'Model':<16}{'Val acc':>10}{'Val F1':>9}{'Test acc':>10}{'Test F1':>9}")
    print("   " + "-" * 54)
    for name, r in results.items():
        A_tr, A_va, A_te = ((Xtr_s, Xva_s, Xte_s) if r["scaled"] else (Xtr, Xva, Xte))
        r["model"].fit(A_tr, ytr)
        pv, pt = r["model"].predict(A_va), r["model"].predict(A_te)
        r["val_acc"]  = accuracy_score(yva, pv)
        r["val_f1"]   = f1_score(yva, pv, average="macro")
        r["test_acc"] = accuracy_score(yte, pt)
        r["test_f1"]  = f1_score(yte, pt, average="macro")
        r["test_pred"] = pt
        print(f"   {name:<16}{r['val_acc']*100:>9.2f}%{r['val_f1']*100:>8.2f}%"
              f"{r['test_acc']*100:>9.2f}%{r['test_f1']*100:>8.2f}%")

    # Selected on validation, never on test -- test is reported, not optimised.
    best_name = max(results, key=lambda n: results[n]["val_f1"])
    print(f"\n   best (by val macro F1): {best_name}")
    return best_name, results, scaler


def plot_confusion(yte, pred, classes, out_png, title):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import seaborn as sns
    from sklearn.metrics import confusion_matrix

    cm = confusion_matrix(yte, pred, labels=list(range(len(classes))))
    norm = cm.astype(float) / cm.sum(axis=1, keepdims=True).clip(min=1)
    fig, ax = plt.subplots(figsize=(6.5, 5.5))
    sns.heatmap(norm, annot=True, fmt=".2f", cmap="Blues", cbar=False,
                xticklabels=classes, yticklabels=classes, ax=ax)
    ax.set_title(title, fontweight="bold")
    ax.set_xlabel("Predicted")
    ax.set_ylabel("Actual")
    plt.tight_layout()
    plt.savefig(out_png, dpi=150)
    plt.close(fig)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("    python")[0],
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", default=str(DATASETS / "faces_224"),
                    help="dataset root built by dataset_builder.py")
    ap.add_argument("--out", default=None,
                    help="artifact dir (default trained-models/focus_v2)")
    ap.add_argument("--promote", action="store_true",
                    help="write to trained-models/focus, the dir the backend loads")
    ap.add_argument("--balance", choices=("undersample", "class_weight", "smote", "none"),
                    default="undersample",
                    help="undersample (default): drop training frames to --target per "
                         "class, keeping every clip and subject. Measured against "
                         "class_weight it holds macro F1 and roughly triples how often "
                         "the minority states are predicted")
    ap.add_argument("--target", type=int, default=None,
                    help="frames per class for --balance undersample "
                         "(default: the smallest class, i.e. fully balanced)")
    ap.add_argument("--rebuild-cache", action="store_true")
    args = ap.parse_args()

    from sklearn.metrics import classification_report
    from sklearn.preprocessing import LabelEncoder

    root = Path(args.data)
    out  = Path(args.out) if args.out else (
        BASE_DIR / "trained-models" / ("focus" if args.promote else "focus_v2"))
    out.mkdir(parents=True, exist_ok=True)

    print("=" * 62)
    print("  Focus classifier - training on built face crops")
    print("=" * 62)
    print(f"\n  data : {root}")
    print(f"  out  : {out}\n")

    rows = read_manifest(root)
    print(f"  {len(rows)} crops")
    for split in ("train", "val", "test"):
        c = Counter(r["label"] for r in rows if r["split"] == split)
        print(f"   {split:<6}{sum(c.values()):>7}   " +
              "  ".join(f"{k}={v}" for k, v in sorted(c.items())))

    X = cached_features(root, rows, out / "features_cache.npz", args.rebuild_cache)

    y_all  = np.array([r["label"] for r in rows])
    splits = np.array([r["split"] for r in rows])
    src    = np.array([r["source"] for r in rows])
    le = LabelEncoder().fit(sorted(set(y_all)))
    y  = le.transform(y_all)

    tr, va, te = (splits == "train"), (splits == "val"), (splits == "test")

    # Only the train split is ever rebalanced. val and test keep their natural
    # distribution, so the reported scores describe the world the model will
    # actually meet rather than the one it was fed.
    tr_idx = np.where(tr)[0]
    if args.balance == "undersample":
        target = args.target or min(Counter(y_all[tr]).values())
        before = Counter(y_all[tr_idx])
        tr_idx = undersample_by_frame(rows, tr_idx, target)
        after  = Counter(y_all[tr_idx])
        print(f"\n  Undersampling train to {target}/class (frames dropped, clips kept)")
        for c in sorted(before):
            clips = len({rows[i]["clip"] for i in tr_idx if rows[i]["label"] == c})
            print(f"   {c:<9}{before[c]:>6} -> {after[c]:>5} crops, "
                  f"still {clips} distinct clips")

    print(f"\n  Training on {len(tr_idx)} / validating on {va.sum()} / testing on {te.sum()}")
    best_name, results, scaler = train_models(X[tr_idx], y[tr_idx], X[va], y[va],
                                              X[te], y[te], args.balance)
    best = results[best_name]

    print(f"\n  Test report - {best_name}\n")
    print(classification_report(y[te], best["test_pred"],
                                labels=list(range(len(le.classes_))),
                                target_names=list(le.classes_),
                                digits=3, zero_division=0))

    print("  Per-class recall by source")
    from sklearn.metrics import recall_score
    for s in sorted(set(src[te])):
        m = src[te] == s
        line = f"   {s:<10}"
        for i, cls in enumerate(le.classes_):
            has = (y[te][m] == i).sum()
            line += (f"{cls}={recall_score(y[te][m], best['test_pred'][m], labels=[i], average='macro', zero_division=0)*100:5.1f}%  "
                     if has else f"{cls}=    -  ")
        print(line)

    plot_confusion(y[te], best["test_pred"], list(le.classes_),
                   out / "confusion_matrix.png", f"{best_name} - test recall")

    # Filenames are exactly what inference.py loads -- do not rename them.
    joblib.dump(best["model"], out / "best_model.pkl")
    joblib.dump(scaler,        out / "scaler.pkl")
    joblib.dump(le,            out / "label_encoder.pkl")
    build_extractor().save(str(out / "feature_extractor.keras"))

    build_report = {}
    if (root / "build_report.json").is_file():
        build_report = json.loads((root / "build_report.json").read_text())

    with open(out / "model_report.json", "w") as f:
        json.dump({
            "best_algorithm": best_name,
            "test_accuracy":  round(best["test_acc"] * 100, 2),
            "test_macro_f1":  round(best["test_f1"] * 100, 2),
            "classes":        list(le.classes_),
            "needs_scaling":  best["scaled"],
            "img_size":       face_crop.IMG_SIZE,
            "balance":        args.balance,
            "dataset":        str(root),
            "datasets":       build_report.get("sources", []),
            "split":          build_report.get("split", "from manifest.csv"),
            "preprocessing":  "face_crop.py -- Haar face + 15% margin, 224x224, "
                              "MobileNetV2 preprocess_input (identical at inference)",
            "counts":         {"train": int(len(tr_idx)), "val": int(va.sum()),
                               "test": int(te.sum())},
            "train_class_counts": {c: int((y_all[tr_idx] == c).sum()) for c in le.classes_},
            "all_results": {n: {"val":  round(r["val_acc"] * 100, 2),
                                "val_f1": round(r["val_f1"] * 100, 2),
                                "test": round(r["test_acc"] * 100, 2),
                                "f1":   round(r["test_f1"] * 100, 2)}
                            for n, r in results.items()},
        }, f, indent=2)

    print(f"\n  Wrote model artifacts to {out}")
    if not args.promote:
        print("  The backend still loads trained-models/focus. Compare, then rerun "
              "with --promote when this model wins.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
