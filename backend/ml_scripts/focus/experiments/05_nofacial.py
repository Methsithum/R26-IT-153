"""
Follow-up: the production cache adds a third source ('facial', 5,744 train rows,
absent from val/test) that train_model.py does not even scan. Step 5 showed every
model scoring 1-2 macro-F1 higher WITHOUT it. This crosses the best balancing
strategies with that cleaner split.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np, time
from collections import Counter
from sklearn.linear_model import LogisticRegression
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler, LabelEncoder
from imblearn.over_sampling import SMOTE
import xgboost as xgb
from common import CLASSES, SEED, load_cache, evaluate, save, RESULTS

P = lambda *a: print(*a, flush=True)
PLAIN = RESULTS / "features_cache_plain.npz"
d = load_cache(PLAIN)
Xtr, ytr, _ = d["train"]; Xva, yva, _ = d["val"]; Xte, yte, _ = d["test"]
le = LabelEncoder().fit(CLASSES); itr = le.transform(ytr)
sc = StandardScaler().fit(Xtr)
Str, Sva, Ste = sc.transform(Xtr), sc.transform(Xva), sc.transform(Xte)
n = len(itr); cnt = Counter(itr); BAL = {c: n/(4*cnt[c]) for c in range(4)}
Ssm, ism = SMOTE(random_state=SEED).fit_resample(Str, itr)
Xsm, _   = SMOTE(random_state=SEED).fit_resample(Xtr, itr)
P(f"no-facial split: train {dict(sorted(Counter(ytr).items()))}")
P(f"after SMOTE    : {dict(sorted(Counter(le.inverse_transform(ism)).items()))}\n")

def mlp(): return MLPClassifier(hidden_layer_sizes=(512,128), alpha=1e-3, batch_size=256,
                                learning_rate_init=1e-3, max_iter=60, early_stopping=True,
                                n_iter_no_change=6, random_state=SEED)
def xg():  return xgb.XGBClassifier(n_estimators=400, max_depth=8, learning_rate=0.05,
                                    subsample=0.8, colsample_bytree=0.8, eval_metric="mlogloss",
                                    random_state=SEED, n_jobs=-1)
EXP = [
    ("N1 MLP  SMOTE",            mlp(), True,  True,  False),
    ("N2 MLP  plain",            mlp(), True,  False, False),
    ("N3 LR   SMOTE",            LogisticRegression(max_iter=3000, random_state=SEED), True, True, False),
    ("N4 XGB  SMOTE",            xg(),  False, True,  False),
    ("N5 XGB  sw=balanced",      xg(),  False, False, True),
]
out = []
P(f"{'experiment':<24}{'secs':>6}{'VALmF1':>8}{'TESTmF1':>9}{'acc':>7}{'gap':>7}   per-class recall")
for label, m, scaled, smote, sw in EXP:
    t0 = time.time()
    if smote: Xt, yt = (Ssm, ism) if scaled else (Xsm, ism)
    else:     Xt, yt = (Str, itr) if scaled else (Xtr, itr)
    Xv, Xs = (Sva, Ste) if scaled else (Xva, Xte)
    kw = {"sample_weight": np.array([BAL[c] for c in yt])} if sw else {}
    m.fit(Xt, yt, **kw)
    rv = evaluate(yva, m.predict_proba(Xv), label+" [VAL]")
    rt = evaluate(yte, m.predict_proba(Xs), label+" [TEST]")
    out.append({"label": label, "val": rv, "test": rt}); save(out, "step5b_nofacial.json")
    P(f"{label:<24}{time.time()-t0:>6.0f}{rv['macro_f1']*100:>8.1f}{rt['macro_f1']*100:>9.1f}"
      f"{rt['accuracy']*100:>7.1f}{rt['recall_gap']:>7.2f}   "
      + " ".join(f"{c[:3]} {rt['per_class'][c]['recall']:.2f}" for c in CLASSES))
