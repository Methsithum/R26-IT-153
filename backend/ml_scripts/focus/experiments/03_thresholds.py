"""
STEP 8 -- threshold optimisation, done honestly.

The sweep is scored on VALIDATION only. The 1,515-sample test set is touched
exactly once at the end, to report the chosen setting. Optimising thresholds
directly on test would leak and inflate every number.

Usage:  03_thresholds.py <registry-key>
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np
from collections import Counter
from sklearn.linear_model import LogisticRegression
from sklearn.neural_network import MLPClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler, LabelEncoder
from imblearn.over_sampling import SMOTE
import xgboost as xgb

from common import (CLASSES, SEED, load_cache, evaluate, print_report,
                    apply_thresholds, score_pred, save, RESULTS)

P = lambda *a: print(*a, flush=True)
key = sys.argv[1] if len(sys.argv) > 1 else "L2"

cache = load_cache()
X_tr, y_tr, _ = cache["train"]; X_va, y_va, _ = cache["val"]; X_te, y_te, _ = cache["test"]
le = LabelEncoder().fit(CLASSES); i_tr = le.transform(y_tr)
scaler = StandardScaler().fit(X_tr)
S_tr, S_va, S_te = scaler.transform(X_tr), scaler.transform(X_va), scaler.transform(X_te)
n = len(i_tr); cnt = Counter(i_tr)
BAL    = {c: n / (4 * cnt[c]) for c in range(4)}
CUSTOM = {c: (n / (4 * cnt[c])) ** 0.5 for c in range(4)}

def _lr(cw):  return LogisticRegression(max_iter=3000, C=1.0, class_weight=cw, n_jobs=-1, random_state=SEED)
def _xgb():   return xgb.XGBClassifier(n_estimators=400, max_depth=8, learning_rate=0.05,
                                       subsample=0.8, colsample_bytree=0.8,
                                       eval_metric="mlogloss", random_state=SEED, n_jobs=-1)
def _mlp():   return MLPClassifier(hidden_layer_sizes=(512,128), alpha=1e-3, batch_size=256,
                                   learning_rate_init=1e-3, max_iter=60, early_stopping=True,
                                   n_iter_no_change=6, random_state=SEED)
def _rf(cw):  return RandomForestClassifier(n_estimators=300, max_depth=24, min_samples_leaf=2,
                                            class_weight=cw, n_jobs=-1, random_state=SEED)

# key -> (model, scaled, smote, weight-mode)
REGISTRY = {
    "L1": (_lr(None), True, False, "none"),   "L2": (_lr("balanced"), True, False, "none"),
    "L3": (_lr(CUSTOM), True, False, "none"), "L4": (_lr(None), True, True, "none"),
    "L5": (_lr("balanced"), True, True, "none"),
    "M1": (_mlp(), True, False, "none"),      "M2": (_mlp(), True, True, "none"),
    "X1": (_xgb(), False, False, "none"),     "X2": (_xgb(), False, False, "balanced"),
    "X3": (_xgb(), False, False, "custom"),   "X4": (_xgb(), False, True, "none"),
    "X5": (_xgb(), False, True, "balanced"),
    "R1": (_rf("balanced"), False, False, "none"),
    "R2": (_rf("balanced_subsample"), False, False, "none"),
    "R3": (_rf(None), False, False, "none"),
}
model, scaled, smote, wmode = REGISTRY[key]
P(f"refitting {key} ...")
Xt, yt = (S_tr, i_tr) if scaled else (X_tr, i_tr)
if smote:
    Xt, yt = SMOTE(random_state=SEED).fit_resample(Xt, yt)
kw = {}
if wmode != "none":
    w = BAL if wmode == "balanced" else CUSTOM
    kw["sample_weight"] = np.array([w[c] for c in yt])
model.fit(Xt, yt, **kw)

Pva = model.predict_proba(S_va if scaled else X_va)
Pte = model.predict_proba(S_te if scaled else X_te)
np.savez_compressed(RESULTS / f"probs_{key}.npz", val=Pva, test=Pte,
                    y_val=y_va, y_test=y_te)

# ---- sweep on VALIDATION only ------------------------------------------------
CONFS = [None, 0.50, 0.55, 0.60, 0.65, 0.70]
FATS  = [None, 0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80]
rows = []
for cth in CONFS:
    for fth in FATS:
        s = score_pred(y_va, apply_thresholds(Pva, cth, fth))
        rows.append({"conf": cth, "fat": fth, **s})
rows.sort(key=lambda r: -r["macro_f1"])

P(f"\nSTEP 8  threshold sweep on VALIDATION ({len(y_va)} samples), model {key}")
P(f"  {'CONF':>6}{'FATIGUE':>9}{'macroF1':>10}{'acc':>8}{'gap':>7}   per-class recall")
for r in rows[:10] + [x for x in rows if x["conf"] == 0.60 and x["fat"] == 0.80]:
    tag = "  <- SHIPPED" if (r["conf"] == 0.60 and r["fat"] == 0.80) else ""
    P(f"  {str(r['conf']):>6}{str(r['fat']):>9}{r['macro_f1']*100:>10.2f}{r['accuracy']*100:>8.2f}"
      f"{r['recall_gap']:>7.2f}   " + " ".join(f"{c[:3]} {r['recall'][c]:.2f}" for c in CLASSES) + tag)

best = rows[0]
P(f"\n  best on VAL: CONF={best['conf']}  FATIGUE={best['fat']}  macro-F1 {best['macro_f1']*100:.2f}")

# ---- final, single look at TEST ---------------------------------------------
P(f"\n{'='*72}\nFINAL TEST EVALUATION (1,515 held-out subject-disjoint samples)")
raw = evaluate(y_te, Pte, f"{key} -- raw argmax(predict_proba), NO thresholds")
print_report(raw)
for cth, fth, name in [(best["conf"], best["fat"], "val-optimal thresholds"),
                       (0.60, 0.80, "SHIPPED thresholds (0.60 / 0.80)")]:
    s = score_pred(y_te, apply_thresholds(Pte, cth, fth))
    P(f"\n  {name}: CONF={cth} FAT={fth} -> acc {s['accuracy']*100:.1f}%  "
      f"macro-F1 {s['macro_f1']*100:.1f}%  gap {s['recall_gap']:.2f}  "
      + " ".join(f"{c[:3]} {s['recall'][c]:.2f}" for c in CLASSES))
save({"key": key, "sweep_val": rows, "best_val": best, "test_raw": raw},
     f"step8_thresholds_{key}.json")
