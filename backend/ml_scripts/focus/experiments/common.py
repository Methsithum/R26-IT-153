"""
Shared evaluation harness for the focus-model experiments.

Every experiment in this folder is scored the SAME way, and specifically the way
production scores: argmax over predict_proba(). train_model.py used model.predict()
(SVC one-vs-one voting), which disagrees with predict_proba on 10.8% of the test
set -- that mismatch is why the shipped report says 73.2% while the served model
gets 69.8% on identical data.

Nothing here writes to trained-models/focus/. Production stays untouched.
"""
import json
from pathlib import Path

import numpy as np
from sklearn.metrics import (accuracy_score, confusion_matrix, f1_score,
                             precision_recall_fscore_support)

BASE_DIR   = Path(__file__).resolve().parents[3]
MODELS     = BASE_DIR / "trained-models" / "focus"
CACHE      = MODELS / "features_cache.npz"
RESULTS    = Path(__file__).resolve().parent / "results"
RESULTS.mkdir(exist_ok=True)

# LabelEncoder order == predict_proba column order. Verified against
# model.classes_ ([0 1 2 3]) -- do not reorder.
CLASSES = ["Anxiety", "Boredom", "Fatigue", "Focused"]
SEED    = 42


def load_cache(path=CACHE):
    c = np.load(path, allow_pickle=True)
    return {s: (c[f"X_{s}"], c[f"y_{s}"], c[f"s_{s}"]) for s in ("train", "val", "test")}


def evaluate(y_true, probs, name=""):
    """Raw argmax over predict_proba -- NO thresholds, NO post-processing."""
    pred = np.array(CLASSES)[probs.argmax(1)]
    p, r, f, sup = precision_recall_fscore_support(
        y_true, pred, labels=CLASSES, zero_division=0)
    return {
        "name": name,
        "accuracy":  accuracy_score(y_true, pred),
        "macro_p":   float(p.mean()),
        "macro_r":   float(r.mean()),
        "macro_f1":  f1_score(y_true, pred, average="macro", zero_division=0),
        "weighted_f1": f1_score(y_true, pred, average="weighted", zero_division=0),
        "per_class": {c: {"precision": float(p[i]), "recall": float(r[i]),
                          "f1": float(f[i]), "support": int(sup[i])}
                      for i, c in enumerate(CLASSES)},
        # Spread of per-class recall: the headline number for "does Focused
        # absorb everything". Lower is more balanced.
        "recall_gap": float(r.max() - r.min()),
        "recall_std": float(r.std()),
        "confusion": confusion_matrix(y_true, pred, labels=CLASSES).tolist(),
        "pred_share": {c: float((pred == c).mean()) for c in CLASSES},
    }


def apply_thresholds(probs, conf_threshold=None, fatigue_threshold=None):
    """Replicates inference.predict_state's post-processing on a probability
    matrix. Used ONLY for the threshold sweep -- experiments are otherwise raw."""
    idx  = probs.argmax(1)
    pred = np.array(CLASSES)[idx].copy()
    conf = probs.max(1)

    if conf_threshold is not None:
        pred[conf < conf_threshold] = "Focused"

    if fatigue_threshold is not None:
        fi = CLASSES.index("Fatigue")
        hit = (idx == fi) & (conf < fatigue_threshold)
        if conf_threshold is not None:          # CONF rule already claimed these
            hit &= conf >= conf_threshold
        if hit.any():
            order = np.argsort(probs[hit], axis=1)[:, ::-1]
            runner = np.array([next(j for j in row if j != fi) for row in order])
            pred[hit] = np.array(CLASSES)[runner]
    return pred


def score_pred(y_true, pred):
    p, r, f, _ = precision_recall_fscore_support(
        y_true, pred, labels=CLASSES, zero_division=0)
    return {"accuracy": accuracy_score(y_true, pred),
            "macro_f1": f1_score(y_true, pred, average="macro", zero_division=0),
            "recall": {c: float(r[i]) for i, c in enumerate(CLASSES)},
            "recall_gap": float(r.max() - r.min())}


def print_report(m):
    print(f"\n{'='*72}\n{m['name']}")
    print(f"  accuracy {m['accuracy']*100:.1f}%   macro-P {m['macro_p']*100:.1f}%   "
          f"macro-R {m['macro_r']*100:.1f}%   macro-F1 {m['macro_f1']*100:.1f}%   "
          f"weighted-F1 {m['weighted_f1']*100:.1f}%")
    print(f"  {'class':<9}{'prec':>8}{'recall':>8}{'f1':>8}{'support':>9}{'pred share':>12}")
    for c in CLASSES:
        d = m["per_class"][c]
        print(f"  {c:<9}{d['precision']:>8.3f}{d['recall']:>8.3f}{d['f1']:>8.3f}"
              f"{d['support']:>9}{m['pred_share'][c]*100:>11.1f}%")
    print(f"  recall gap (max-min): {m['recall_gap']:.3f}")
    print(f"  confusion (rows=true, cols=pred){'':<8}" + "".join(f"{c[:4]:>8}" for c in CLASSES))
    for c, row in zip(CLASSES, m["confusion"]):
        print(f"    {c:<38}" + "".join(f"{v:>8}" for v in row))


def save(obj, name):
    with open(RESULTS / name, "w") as f:
        json.dump(obj, f, indent=2, default=float)
