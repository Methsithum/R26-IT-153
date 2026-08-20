"""
STEP 5 -- does the pipeline's image augmentation help?

Fair comparison: both caches come from the SAME subject-disjoint split of the
SAME 7,057 training images. The only difference is that the augmented one
oversamples the minority classes up to 3,942 each using augment() (flip, +-15
rotation, brightness, zoom). Val and test are identical, unaugmented, and are
the same 1,515 test samples used everywhere else.

Note this split excludes the 'facial' source present in the production cache
(train_model.py does not scan it), so absolute numbers sit below the main grid.
Only the plain-vs-augmented DELTA is meaningful here.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np
from collections import Counter
from sklearn.linear_model import LogisticRegression
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler, LabelEncoder
import xgboost as xgb
from common import CLASSES, SEED, load_cache, evaluate, save, RESULTS

P = lambda *a: print(*a, flush=True)
CACHES = {"plain (no augmentation)": RESULTS / "features_cache_plain.npz",
          "augmented (balanced)":    RESULTS / "features_cache_augmented.npz"}

def models():
    return [
        ("LR  cw=None",     LogisticRegression(max_iter=3000, n_jobs=-1, random_state=SEED), True),
        ("LR  cw=balanced", LogisticRegression(max_iter=3000, class_weight="balanced",
                                               n_jobs=-1, random_state=SEED), True),
        ("MLP",             MLPClassifier(hidden_layer_sizes=(512,128), alpha=1e-3,
                                          batch_size=256, learning_rate_init=1e-3,
                                          max_iter=60, early_stopping=True,
                                          n_iter_no_change=6, random_state=SEED), True),
        ("XGB",             xgb.XGBClassifier(n_estimators=400, max_depth=8, learning_rate=0.05,
                                              subsample=0.8, colsample_bytree=0.8,
                                              eval_metric="mlogloss", random_state=SEED,
                                              n_jobs=-1), False),
    ]

out = []
P(f"{'cache':<26}{'model':<18}{'train n':>9}{'TESTmF1':>9}{'acc':>7}{'gap':>7}   per-class recall")
for cname, path in CACHES.items():
    d  = load_cache(path)
    Xtr, ytr, _ = d["train"]; Xte, yte, _ = d["test"]
    le = LabelEncoder().fit(CLASSES); itr = le.transform(ytr)
    sc = StandardScaler().fit(Xtr)
    for mname, m, scaled in models():
        Xt = sc.transform(Xtr) if scaled else Xtr
        Xs = sc.transform(Xte) if scaled else Xte
        m.fit(Xt, itr)
        r = evaluate(yte, m.predict_proba(Xs), f"{cname} | {mname}")
        out.append({"cache": cname, "model": mname, "n_train": int(len(itr)), **r})
        P(f"{cname:<26}{mname:<18}{len(itr):>9}{r['macro_f1']*100:>9.1f}"
          f"{r['accuracy']*100:>7.1f}{r['recall_gap']:>7.2f}   "
          + " ".join(f"{c[:3]} {r['per_class'][c]['recall']:.2f}" for c in CLASSES))
        save(out, "step5_augmentation.json")

P("\nDELTA (augmented - plain), same split, same test set:")
half = len(out)//2
for a, b in zip(out[:half], out[half:]):
    P(f"  {a['model']:<18} macro-F1 {a['macro_f1']*100:>5.1f} -> {b['macro_f1']*100:>5.1f}"
      f"  ({(b['macro_f1']-a['macro_f1'])*100:+.1f})   gap {a['recall_gap']:.2f} -> {b['recall_gap']:.2f}")
