"""STEP 2 (clean baseline) + STEP 6 (probability analysis) for the SHIPPED model."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))

import joblib, json, numpy as np
from common import CLASSES, MODELS, load_cache, evaluate, print_report, save

d = load_cache()
X_te, y_te, _ = d["test"]
model  = joblib.load(MODELS / "best_model.pkl")
scaler = joblib.load(MODELS / "scaler.pkl")
rep    = json.load(open(MODELS / "model_report.json"))

probs = model.predict_proba(scaler.transform(X_te) if rep["needs_scaling"] else X_te)

m = evaluate(y_te, probs, "STEP 2 BASELINE - shipped SVM, raw argmax(predict_proba), NO thresholds")
print_report(m)
save(m, "step2_baseline.json")

# ---- STEP 6: probability analysis -------------------------------------------
print(f"\n{'='*72}\nSTEP 6  mean probability assigned to each class, by true class")
print(f"  {'true class':<12}" + "".join(f"{'P('+c+')':>12}" for c in CLASSES) + f"{'n':>7}")
for t in CLASSES:
    mask = y_te == t
    mean = probs[mask].mean(0)
    star = lambda i: "*" if CLASSES[i] == t else " "
    print(f"  {t:<12}" + "".join(f"{mean[i]:>11.3f}{star(i)}" for i in range(4))
          + f"{int(mask.sum()):>7}")

print(f"\n  (* = the correct class. A row whose starred value is not the largest")
print(f"   means the model genuinely does not separate that class.)")

order = np.argsort(probs, axis=1)[:, ::-1]
top1  = np.array(CLASSES)[order[:, 0]]
top2  = np.array(CLASSES)[order[:, 1]]
print(f"\n  {'class':<10}{'is top-1':>10}{'true=top1':>11}{'true=top2':>11}"
      f"{'true in top2':>14}{'avg P(true)':>13}")
for t in CLASSES:
    mask = y_te == t
    n    = int(mask.sum())
    t1   = int((top1[mask] == t).sum())
    t2   = int((top2[mask] == t).sum())
    pt   = probs[mask][:, CLASSES.index(t)].mean()
    print(f"  {t:<10}{int((top1 == t).sum()):>10}{t1:>11}{t2:>11}"
          f"{(t1+t2)/n*100:>13.1f}%{pt:>13.3f}")

cm = np.array(m["confusion"], dtype=float)
cmn = cm / cm.sum(1, keepdims=True)
print(f"\n  normalised confusion (row=true){'':<10}" + "".join(f"{c[:4]:>9}" for c in CLASSES))
for c, row in zip(CLASSES, cmn):
    print(f"    {c:<38}" + "".join(f"{v:>9.3f}" for v in row))
save({"mean_prob_by_true_class":
      {t: {c: float(probs[y_te == t].mean(0)[i]) for i, c in enumerate(CLASSES)}
       for t in CLASSES}}, "step6_probability_analysis.json")
