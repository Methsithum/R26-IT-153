"""
STEPS 3, 4, 7, 9 -- experiment grid.

Scoring is identical everywhere: argmax(predict_proba), NO thresholds (step 7).
Selection uses VAL; TEST is reported but must not drive the choice (step 8 rule).
SMOTE is fitted on TRAIN ONLY, after the subject-disjoint split (step 4).

SVC note: fit time measured at 9s (n=2000) and 78s (n=4000) -- ~45min at the full
12,801 and ~3.4h once SMOTE expands to 21,512. SVM configs are therefore fitted on
a fixed 4,000-sample subsample as a *search proxy* only; the winner is refitted at
full practical scale afterwards. Every non-SVM model uses the full training set.
"""
import sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np
from collections import Counter
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.svm import SVC
from imblearn.over_sampling import SMOTE
import xgboost as xgb

from common import CLASSES, SEED, load_cache, evaluate, save

P = lambda *a: print(*a, flush=True)

cache = load_cache()
X_tr, y_tr, _ = cache["train"]
X_va, y_va, _ = cache["val"]
X_te, y_te, _ = cache["test"]

le = LabelEncoder().fit(CLASSES)
i_tr = le.transform(y_tr)
scaler = StandardScaler().fit(X_tr)
S_tr, S_va, S_te = scaler.transform(X_tr), scaler.transform(X_va), scaler.transform(X_te)

P("STEP 4 -- class distribution, TRAIN ONLY (split already happened)")
P(f"  before SMOTE : {dict(sorted(Counter(y_tr).items()))}")
S_tr_sm, i_sm = SMOTE(random_state=SEED).fit_resample(S_tr, i_tr)
X_tr_sm, _    = SMOTE(random_state=SEED).fit_resample(X_tr, i_tr)
P(f"  after  SMOTE : {dict(sorted(Counter(le.inverse_transform(i_sm)).items()))}")
P(f"  val  untouched: {dict(sorted(Counter(y_va).items()))}")
P(f"  test untouched: {dict(sorted(Counter(y_te).items()))}")

n = len(i_tr); cnt = Counter(i_tr)
BAL    = {c: n / (4 * cnt[c]) for c in range(4)}
CUSTOM = {c: (n / (4 * cnt[c])) ** 0.5 for c in range(4)}   # sqrt-inverse-frequency
P(f"\n  balanced weights   : { {CLASSES[c]: round(v,2) for c,v in BAL.items()} }")
P(f"  custom sqrt weights: { {CLASSES[c]: round(v,2) for c,v in CUSTOM.items()} }\n")

SVM_CAP = 4000
sub = np.random.RandomState(SEED).choice(len(S_tr), SVM_CAP, replace=False)

def xgbm(): return xgb.XGBClassifier(n_estimators=400, max_depth=8, learning_rate=0.05,
                                     subsample=0.8, colsample_bytree=0.8,
                                     eval_metric="mlogloss", random_state=SEED, n_jobs=-1)
def rf(cw): return RandomForestClassifier(n_estimators=300, max_depth=24, min_samples_leaf=2,
                                          class_weight=cw, n_jobs=-1, random_state=SEED)
def lr(cw): return LogisticRegression(max_iter=3000, C=1.0, class_weight=cw, n_jobs=-1,
                                      random_state=SEED)
def mlp():  return MLPClassifier(hidden_layer_sizes=(512, 128), alpha=1e-3, batch_size=256,
                                 learning_rate_init=1e-3, max_iter=60, early_stopping=True,
                                 n_iter_no_change=6, random_state=SEED)
def svc(cw): return SVC(kernel="rbf", C=10, gamma="scale", class_weight=cw,
                        probability=True, random_state=SEED)

# label, builder, scaled, smote, weight-mode ("none"|"balanced"|"custom")
EXPERIMENTS = [
    ("L1 LR   cw=None",                lr(None),              True,  False, "none"),
    ("L2 LR   cw=balanced",            lr("balanced"),        True,  False, "none"),
    ("L3 LR   cw=custom",              lr(CUSTOM),            True,  False, "none"),
    ("L4 LR   SMOTE cw=None",          lr(None),              True,  True,  "none"),
    ("L5 LR   SMOTE + cw=balanced",    lr("balanced"),        True,  True,  "none"),
    ("M1 MLP  no weighting",           mlp(),                 True,  False, "none"),
    ("M2 MLP  SMOTE",                  mlp(),                 True,  True,  "none"),
    ("X1 XGB  no weighting",           xgbm(),                False, False, "none"),
    ("X2 XGB  sample_weight=balanced", xgbm(),                False, False, "balanced"),
    ("X3 XGB  sample_weight=custom",   xgbm(),                False, False, "custom"),
    ("X4 XGB  SMOTE",                  xgbm(),                False, True,  "none"),
    ("X5 XGB  SMOTE + sw=balanced",    xgbm(),                False, True,  "balanced"),
    ("R1 RF   cw=balanced",            rf("balanced"),        False, False, "none"),
    ("R2 RF   cw=balanced_subsample",  rf("balanced_subsample"), False, False, "none"),
    ("R3 RF   cw=None",                rf(None),              False, False, "none"),
    (f"S1 SVM  cw=None       (n={SVM_CAP})",     svc(None),       True, False, "none"),
    (f"S2 SVM  cw=balanced   (n={SVM_CAP}) [SHIPPED]", svc("balanced"), True, False, "none"),
    (f"S3 SVM  cw=custom     (n={SVM_CAP})",     svc(CUSTOM),     True, False, "none"),
    (f"S4 SVM  SMOTE cw=None (n={SVM_CAP})",     svc(None),       True, True,  "none"),
    (f"S5 SVM  SMOTE+cw=bal  (n={SVM_CAP})",     svc("balanced"), True, True,  "none"),
]

P(f"{'experiment':<40}{'secs':>6}   {'VAL mF1':>8}{'VALacc':>8}   {'TESTmF1':>8}{'TESTacc':>8}{'gap':>7}")
out = []
for label, model, scaled, smote, wmode in EXPERIMENTS:
    t0 = time.time()
    if smote:
        Xt, yt = (S_tr_sm, i_sm) if scaled else (X_tr_sm, i_sm)
    else:
        Xt, yt = (S_tr, i_tr) if scaled else (X_tr, i_tr)
    Xv, Xs = (S_va, S_te) if scaled else (X_va, X_te)

    if label.startswith("S"):                      # SVM search proxy
        k = np.random.RandomState(SEED).choice(len(Xt), min(SVM_CAP, len(Xt)), replace=False)
        Xt, yt = Xt[k], yt[k]

    kw = {}
    if wmode != "none":
        w = BAL if wmode == "balanced" else CUSTOM
        kw["sample_weight"] = np.array([w[c] for c in yt])
    model.fit(Xt, yt, **kw)

    rv = evaluate(y_va, model.predict_proba(Xv), label + " [VAL]")
    rt = evaluate(y_te, model.predict_proba(Xs), label + " [TEST]")
    out.append({"label": label, "seconds": round(time.time()-t0, 1),
                "n_train": int(len(yt)), "val": rv, "test": rt})
    save(out, "step9_grid.json")
    P(f"{label:<40}{out[-1]['seconds']:>6.0f}   {rv['macro_f1']*100:>8.1f}{rv['accuracy']*100:>8.1f}   "
      f"{rt['macro_f1']*100:>8.1f}{rt['accuracy']*100:>8.1f}{rt['recall_gap']:>7.2f}")

P("\nDone -> results/step9_grid.json")
