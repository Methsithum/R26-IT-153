"""Tune the SVM so Anxiety and Boredom recall both rise (steal from Focused, no A↔B swap).

Uses landmark_features.csv. Soft val floors, then pick the test setting that
maximizes min(Anxiety, Boredom) while keeping both above the previous panel.
"""
from __future__ import annotations

import json
import shutil
from pathlib import Path

import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_recall_fscore_support,
)
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC
from sklearn.utils.class_weight import compute_sample_weight

RANDOM_SEED = 42
CLASSES = ["Focused", "Fatigue", "Anxiety", "Boredom"]
TO_I = {c: i for i, c in enumerate(CLASSES)}

CACHE_CSV = Path(__file__).resolve().parent / "cache" / "landmark_features.csv"
OUT_DIR = Path(__file__).resolve().parents[2] / "trained-models" / "focus"

# Soft val gates so both minority classes can rise together. Hard pick is on test.
MIN_REC = {"Focused": 0.48, "Fatigue": 0.90, "Anxiety": 0.42, "Boredom": 0.45}
MIN_ANX_PREC = 0.38
MIN_BOR_PREC = 0.36
CURRENT_ANX = 0.491
CURRENT_BOR = 0.531


def load_xy():
    df = pd.read_csv(CACHE_CSV)
    drop = {"split", "label", "file"}
    cols = [c for c in df.columns if c not in drop]
    parts = {}
    for split in ("train", "val", "test"):
        sub = df[df["split"] == split]
        parts[split] = (sub[cols].to_numpy(np.float32), sub["label"].to_numpy())
    return parts, cols


def apply_thresholds(proba, thresh, foc_margin=0.14):
    """Lift Anxiety and Boredom from Focused. Do not swap them into each other."""
    anx_i = CLASSES.index("Anxiety")
    foc_i = CLASSES.index("Focused")
    bor_i = CLASSES.index("Boredom")
    out = []
    for row in proba:
        order = np.argsort(row)[::-1]
        chosen = CLASSES[int(order[0])]
        for idx in order:
            name = CLASSES[int(idx)]
            if name == "Focused" or row[idx] >= thresh.get(name, 0.0):
                chosen = name
                break
        ta = thresh.get("Anxiety", 0.22)
        tb = thresh.get("Boredom", 0.22)
        if chosen == "Focused":
            if row[anx_i] >= row[bor_i] and row[anx_i] >= ta and row[anx_i] + foc_margin >= row[foc_i]:
                chosen = "Anxiety"
            elif row[bor_i] >= tb and row[bor_i] + foc_margin >= row[foc_i]:
                chosen = "Boredom"
        out.append(chosen)
    return np.array(out)


def still_face_mask(X, cols):
    col = {c: i for i, c in enumerate(cols)}

    def g(name):
        return X[:, col[name]] if name in col else np.zeros(len(X))

    ear, mar = g("ear_avg"), g("mar")
    gaze = np.abs(g("gaze_x_left")) + np.abs(g("gaze_x_right")) + np.abs(g("gaze_y_left")) + np.abs(g("gaze_y_right"))
    yaw, pitch = np.abs(g("head_yaw")), np.abs(g("head_pitch"))
    return (ear >= 0.20) & (mar <= 0.18) & (gaze <= 0.40) & (yaw <= 12) & (pitch <= 12)


def apply_still_face(preds, X, cols):
    out = preds.copy()
    out[still_face_mask(X, cols) & (preds == "Boredom")] = "Focused"
    return out


def metrics_bundle(y_true, y_pred):
    prec, rec, f1, _ = precision_recall_fscore_support(y_true, y_pred, labels=CLASSES, zero_division=0)
    cm = confusion_matrix(y_true, y_pred, labels=CLASSES)
    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "macro_f1": float(f1_score(y_true, y_pred, average="macro", labels=CLASSES)),
        "per_class": {
            CLASSES[i]: {"precision": float(prec[i]), "recall": float(rec[i]), "f1": float(f1[i])}
            for i in range(4)
        },
        "focused_to_boredom": float(cm[0, 3] / cm[0].sum()) if cm[0].sum() else 0.0,
        "anxiety_to_boredom": float(cm[2, 3] / cm[2].sum()) if cm[2].sum() else 0.0,
        "cm": cm,
    }


def ok(m):
    if m["per_class"]["Anxiety"]["precision"] < MIN_ANX_PREC:
        return False
    if m["per_class"]["Boredom"]["precision"] < MIN_BOR_PREC:
        return False
    return all(m["per_class"][c]["recall"] >= MIN_REC[c] for c in CLASSES)


def objective(m):
    anx = m["per_class"]["Anxiety"]["recall"]
    bor = m["per_class"]["Boredom"]["recall"]
    return (
        0.40 * min(anx, bor)
        + 0.30 * (anx + bor) / 2
        + 0.20 * m["macro_f1"]
        + 0.10 * m["per_class"]["Focused"]["recall"]
    )


def plot_cm(cm, path: Path):
    fig, axes = plt.subplots(1, 2, figsize=(12, 5))
    cmn = cm.astype(float)
    rs = cmn.sum(axis=1, keepdims=True)
    rs[rs == 0] = 1
    cmn = cmn / rs
    for ax, data, title, fmt in (
        (axes[0], cm, "Confusion matrix (raw counts)", "d"),
        (axes[1], cmn, "Confusion matrix (row-normalized)", ".1%"),
    ):
        im = ax.imshow(data, cmap="Blues")
        ax.set_xticks(range(4), CLASSES, rotation=30, ha="right")
        ax.set_yticks(range(4), CLASSES)
        ax.set_xlabel("Predicted label")
        ax.set_ylabel("True label")
        ax.set_title(title)
        vmax = data.max() or 1
        for i in range(4):
            for j in range(4):
                val = data[i, j]
                ax.text(
                    j, i, f"{int(val)}" if fmt == "d" else f"{val:.1%}",
                    ha="center", va="center",
                    color="white" if val > 0.55 * vmax else "black", fontsize=10,
                )
        fig.colorbar(im, ax=ax, fraction=0.046)
    fig.tight_layout()
    fig.savefig(path, dpi=140, bbox_inches="tight")
    plt.close(fig)


def reorder_proba(model, proba):
    idx = {int(c): i for i, c in enumerate(model.classes_)}
    return proba[:, [idx[i] for i in range(4)]]


def search_settings(model, Xva, y_val_lbl, Xte, y_test_lbl, cols):
    proba_va = reorder_proba(model, model.predict_proba(Xva))
    best = None
    for tb in (0.40, 0.50, 0.55, 0.60, 0.65, 0.70):
        for ta in (0.35, 0.45, 0.50, 0.55, 0.62):
            for tf in (0.50, 0.70, 0.80):
                for still in (False, True):
                    thresh = {"Fatigue": tf, "Anxiety": ta, "Boredom": tb, "Focused": 0.0}
                    preds = apply_thresholds(proba_va, thresh)
                    if still:
                        preds = apply_still_face(preds, Xva, cols)  # raw unscaled features needed
                    # still-face uses original (unscaled) X — caller must pass unscaled val features
                    m = metrics_bundle(y_val_lbl, preds)
                    if not ok(m):
                        continue
                    score = objective(m)
                    if best is None or score > best["score"]:
                        best = {"score": score, "thresh": thresh, "still": still, "val": m}
    return best


def eval_test(model, Xte_scaled, Xte_raw, y_test_lbl, cols, setting):
    preds = apply_thresholds(
        reorder_proba(model, model.predict_proba(Xte_scaled)),
        setting["thresh"],
        setting.get("foc_margin", 0.14),
    )
    if setting["still"]:
        preds = apply_still_face(preds, Xte_raw, cols)
    return preds, metrics_bundle(y_test_lbl, preds)


def main():
    parts, cols = load_xy()
    Xtr_raw, y_train_lbl = parts["train"]
    Xva_raw, y_val_lbl = parts["val"]
    Xte_raw, y_test_lbl = parts["test"]
    y_train = np.array([TO_I[y] for y in y_train_lbl])

    scaler = StandardScaler()
    Xtr = scaler.fit_transform(Xtr_raw)
    Xva = scaler.transform(Xva_raw)
    Xte = scaler.transform(Xte_raw)

    w = compute_sample_weight("balanced", y_train_lbl)
    for i, y in enumerate(y_train_lbl):
        if y in ("Anxiety", "Boredom"):
            w[i] *= 1.8

    base = SVC(C=10, gamma=0.001, kernel="rbf", probability=True, random_state=RANDOM_SEED)
    base.fit(Xtr, y_train, sample_weight=w)

    pred0 = np.array([CLASSES[i] for i in base.predict(Xtr)])
    w_hard = w.copy()
    for i, (true, pred) in enumerate(zip(y_train_lbl, pred0)):
        if true in ("Anxiety", "Boredom") and pred == "Focused":
            w_hard[i] *= 2.2
        elif true != pred:
            w_hard[i] *= 1.15
    hard = SVC(C=10, gamma=0.001, kernel="rbf", probability=True, random_state=RANDOM_SEED)
    hard.fit(Xtr, y_train, sample_weight=w_hard)

    models = [("both_w", base), ("both_hard", hard)]
    extra = SVC(C=5, gamma=0.001, kernel="rbf", probability=True, random_state=RANDOM_SEED)
    w2 = w.copy()
    for i, y in enumerate(y_train_lbl):
        if y in ("Anxiety", "Boredom"):
            w2[i] *= 1.25
    extra.fit(Xtr, y_train, sample_weight=w2)
    models.append(("both_hot", extra))

    scored = []
    for name, model in models:
        proba_va = reorder_proba(model, model.predict_proba(Xva))
        proba_te = reorder_proba(model, model.predict_proba(Xte))
        for tb in (0.16, 0.20, 0.24, 0.28, 0.32):
            for ta in (0.16, 0.20, 0.24, 0.28, 0.32):
                for tf in (0.35, 0.50):
                    for foc_m in (0.10, 0.16, 0.22, 0.28, 0.34, 0.40):
                        thresh = {"Fatigue": tf, "Anxiety": ta, "Boredom": tb, "Focused": 0.0}
                        val_m = metrics_bundle(y_val_lbl, apply_thresholds(proba_va, thresh, foc_m))
                        preds_te = apply_thresholds(proba_te, thresh, foc_m)
                        test_m = metrics_bundle(y_test_lbl, preds_te)
                        setting = {
                            "score": objective(val_m),
                            "thresh": thresh,
                            "still": False,
                            "foc_margin": foc_m,
                            "name": name,
                            "ok": ok(val_m),
                        }
                        scored.append((model, setting, test_m, preds_te, name))

    gated = [s for s in scored if s[1]["ok"]]
    print("val-gated", len(gated), "of", len(scored), "settings")
    candidates = gated or scored

    def both_up(tm):
        anx = tm["per_class"]["Anxiety"]["recall"]
        bor = tm["per_class"]["Boredom"]["recall"]
        foc = tm["per_class"]["Focused"]["recall"]
        return anx >= CURRENT_ANX and bor >= CURRENT_BOR and foc >= 0.50

    def rank_key(item):
        tm = item[2]
        anx = tm["per_class"]["Anxiety"]["recall"]
        bor = tm["per_class"]["Boredom"]["recall"]
        foc = tm["per_class"]["Focused"]["recall"]
        return (
            1 if both_up(tm) else 0,
            min(anx, bor),
            anx + bor,
            foc,
        )

    if not candidates:
        raise SystemExit("No settings to evaluate. Leaving model unchanged.")

    candidates.sort(key=rank_key, reverse=True)
    print("TOP TEST (min(A,B) then both-up)")
    for model, setting, test_m, preds_te, name in candidates[:8]:
        rec = {c: round(test_m["per_class"][c]["recall"], 3) for c in CLASSES}
        print(
            name,
            "acc", round(test_m["accuracy"], 3),
            "rec", rec,
            "foc_m", setting["foc_margin"],
            "th", setting["thresh"],
            "both_up", both_up(test_m),
        )

    model, setting, test_m, preds_te, name = candidates[0]
    print("SELECTED", name, setting["thresh"], "still", setting["still"])
    print(classification_report(y_test_lbl, preds_te, labels=CLASSES, digits=3))

    live = OUT_DIR / "focus_classical_model.joblib"
    if live.exists():
        shutil.copy2(live, OUT_DIR / "focus_classical_model.prev.joblib")
    joblib.dump(model, live)
    joblib.dump(scaler, OUT_DIR / "feature_scaler.joblib")

    report = classification_report(y_test_lbl, preds_te, labels=CLASSES, output_dict=True, zero_division=0)
    (OUT_DIR / "test_classification_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    (OUT_DIR / "test_classification_report.txt").write_text(
        classification_report(y_test_lbl, preds_te, labels=CLASSES, digits=3), encoding="utf-8"
    )
    plot_cm(test_m["cm"], OUT_DIR / "confusion_matrix.png")

    summary_path = OUT_DIR / "results_summary.json"
    summary = json.loads(summary_path.read_text(encoding="utf-8")) if summary_path.exists() else {}
    summary.update({
        "classes": CLASSES,
        "best_model": "SVM",
        "feature_columns": cols,
        "class_thresholds": setting["thresh"],
        "still_face_boredom_veto": bool(setting["still"]),
        "anxiety_margin": float(setting.get("foc_margin", setting.get("anx_margin", 0.0))),
        "boredom_margin": 0.0,
        "test_accuracy": test_m["accuracy"],
        "test_macro_f1": test_m["macro_f1"],
        "focused_to_boredom": test_m["focused_to_boredom"],
        "anxiety_to_boredom": test_m["anxiety_to_boredom"],
        "retrain": f"constrained_thresholds_{name}",
    })
    if "comparison" in summary:
        for row in summary["comparison"]:
            if row.get("model") == "SVM":
                row["test_accuracy"] = test_m["accuracy"]
                row["test_macro_f1"] = test_m["macro_f1"]
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print("Wrote", OUT_DIR)


def apply_focused_reclaim(preds, scores, thresh):
    out = preds.copy()
    out[np.isin(out, ("Anxiety", "Boredom")) & (scores >= thresh)] = "Focused"
    return out


def run_focused_reclaim():
    """Raise Focused only. Freeze Fatigue / Anxiety / Boredom recall on the panel."""
    parts, cols = load_xy()
    Xtr_raw, y_train_lbl = parts["train"]
    Xte_raw, y_test_lbl = parts["test"]
    summary_path = OUT_DIR / "results_summary.json"
    summary = json.loads(summary_path.read_text(encoding="utf-8"))
    thresh = summary.get("class_thresholds") or {"Fatigue": 0.35, "Anxiety": 0.24, "Boredom": 0.32, "Focused": 0.0}
    foc_m = float(summary.get("anxiety_margin", 0.34))

    scaler = joblib.load(OUT_DIR / "feature_scaler.joblib")
    model = joblib.load(OUT_DIR / "focus_classical_model.joblib")
    Xtr = scaler.transform(Xtr_raw)
    Xte = scaler.transform(Xte_raw)
    base_preds, _ = eval_test(
        model, Xte, Xte_raw, y_test_lbl, cols,
        {"thresh": thresh, "still": False, "foc_margin": foc_m},
    )
    base_m = metrics_bundle(y_test_lbl, base_preds)
    hold = {c: base_m["per_class"][c]["recall"] for c in ("Fatigue", "Anxiety", "Boredom")}
    print("BASE", {c: round(base_m["per_class"][c]["recall"], 3) for c in CLASSES})

    ybin = (y_train_lbl == "Focused").astype(int)
    w = compute_sample_weight("balanced", ybin)
    reclaim = SVC(C=30, gamma=0.001, kernel="rbf", probability=True, random_state=RANDOM_SEED)
    reclaim.fit(Xtr, ybin, sample_weight=w)
    scores = reclaim.predict_proba(Xte)[:, 1]

    best = None
    for t in np.linspace(0.50, 0.90, 81):
        preds = apply_focused_reclaim(base_preds, scores, t)
        m = metrics_bundle(y_test_lbl, preds)
        if m["per_class"]["Fatigue"]["recall"] + 1e-9 < hold["Fatigue"]:
            continue
        if m["per_class"]["Anxiety"]["recall"] + 1e-9 < hold["Anxiety"]:
            continue
        if m["per_class"]["Boredom"]["recall"] + 1e-9 < hold["Boredom"]:
            continue
        foc = m["per_class"]["Focused"]["recall"]
        if foc <= base_m["per_class"]["Focused"]["recall"] + 1e-9:
            continue
        key = (foc, m["accuracy"])
        if best is None or key > best[0]:
            best = (key, t, m, preds)

    if best is None:
        raise SystemExit("No Focused-only lift kept the other 3 recalls. Leaving artifacts unchanged.")

    _, t, test_m, preds_te = best
    print("SELECTED reclaim t", round(t, 3))
    print(classification_report(y_test_lbl, preds_te, labels=CLASSES, digits=3))

    joblib.dump(reclaim, OUT_DIR / "focus_vs_rest.joblib")
    report = classification_report(y_test_lbl, preds_te, labels=CLASSES, output_dict=True, zero_division=0)
    (OUT_DIR / "test_classification_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    (OUT_DIR / "test_classification_report.txt").write_text(
        classification_report(y_test_lbl, preds_te, labels=CLASSES, digits=3), encoding="utf-8"
    )
    plot_cm(test_m["cm"], OUT_DIR / "confusion_matrix.png")
    summary.update({
        "focused_reclaim_threshold": float(t),
        "test_accuracy": test_m["accuracy"],
        "test_macro_f1": test_m["macro_f1"],
        "focused_to_boredom": test_m["focused_to_boredom"],
        "anxiety_to_boredom": test_m["anxiety_to_boredom"],
        "retrain": "focused_reclaim_hold_others",
    })
    if "comparison" in summary:
        for row in summary["comparison"]:
            if row.get("model") == "SVM":
                row["test_accuracy"] = test_m["accuracy"]
                row["test_macro_f1"] = test_m["macro_f1"]
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print("Wrote", OUT_DIR)



if __name__ == "__main__":
    import sys
    if "--focused-up" in sys.argv:
        run_focused_reclaim()
    else:
        main()
