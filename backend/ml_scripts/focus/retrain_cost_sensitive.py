"""Tune the existing SVM for the panel confusion pattern without collapsing Boredom.

Uses landmark_features.csv (no image datasets). Constraints:
  Boredom recall >= 0.55, Anxiety recall >= 0.38, Focused recall >= 0.60.
Picks the setting that cuts Focused→Boredom and Anxiety→Boredom the most
while keeping those floors.
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

MIN_REC = {"Focused": 0.60, "Fatigue": 0.90, "Anxiety": 0.38, "Boredom": 0.55}


def load_xy():
    df = pd.read_csv(CACHE_CSV)
    drop = {"split", "label", "file"}
    cols = [c for c in df.columns if c not in drop]
    parts = {}
    for split in ("train", "val", "test"):
        sub = df[df["split"] == split]
        parts[split] = (sub[cols].to_numpy(np.float32), sub["label"].to_numpy())
    return parts, cols


def apply_thresholds(proba, thresh):
    out = []
    for row in proba:
        order = np.argsort(row)[::-1]
        chosen = CLASSES[int(order[0])]
        for idx in order:
            name = CLASSES[int(idx)]
            if name == "Focused" or row[idx] >= thresh.get(name, 0.0):
                chosen = name
                break
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
    return all(m["per_class"][c]["recall"] >= MIN_REC[c] for c in CLASSES)


def objective(m):
    return (
        0.30 * m["macro_f1"]
        + 0.15 * m["per_class"]["Boredom"]["precision"]
        + 0.15 * m["per_class"]["Anxiety"]["recall"]
        + 0.10 * m["per_class"]["Focused"]["recall"]
        - 0.35 * m["focused_to_boredom"]
        - 0.25 * m["anxiety_to_boredom"]
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
    preds = apply_thresholds(reorder_proba(model, model.predict_proba(Xte_scaled)), setting["thresh"])
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
    original = SVC(C=10, gamma=0.001, kernel="rbf", probability=True, random_state=RANDOM_SEED)
    original.fit(Xtr, y_train, sample_weight=w)

    pred0 = np.array([CLASSES[i] for i in original.predict(Xtr)])
    w_mild = w.copy()
    for i, (true, pred) in enumerate(zip(y_train_lbl, pred0)):
        if true == pred:
            continue
        if (true, pred) in (("Focused", "Boredom"), ("Anxiety", "Boredom")):
            w_mild[i] *= 1.8
        else:
            w_mild[i] *= 1.25
    mild = SVC(C=10, gamma=0.001, kernel="rbf", probability=True, random_state=RANDOM_SEED)
    mild.fit(Xtr, y_train, sample_weight=w_mild)

    candidates = []
    for name, model in (("original", original), ("mild", mild)):
        # still-face needs unscaled X
        setting = None
        proba_va = reorder_proba(model, model.predict_proba(Xva))
        best = None
        for tb in (0.40, 0.50, 0.55, 0.60, 0.65, 0.70):
            for ta in (0.35, 0.45, 0.50, 0.55, 0.62):
                for tf in (0.50, 0.70, 0.80):
                    for still in (False, True):
                        thresh = {"Fatigue": tf, "Anxiety": ta, "Boredom": tb, "Focused": 0.0}
                        preds = apply_thresholds(proba_va, thresh)
                        if still:
                            preds = apply_still_face(preds, Xva_raw, cols)
                        m = metrics_bundle(y_val_lbl, preds)
                        if not ok(m):
                            continue
                        score = objective(m)
                        if best is None or score > best["score"]:
                            best = {"score": score, "thresh": thresh, "still": still, "name": name}
        if best:
            preds_te, test_m = eval_test(model, Xte, Xte_raw, y_test_lbl, cols, best)
            print(name, "val_obj", round(best["score"], 4), "test_acc", round(test_m["accuracy"], 4),
                  "F->B", round(test_m["focused_to_boredom"], 3), "A->B", round(test_m["anxiety_to_boredom"], 3),
                  "thresh", best["thresh"], "still", best["still"])
            print("  test recalls", {c: round(test_m["per_class"][c]["recall"], 3) for c in CLASSES})
            candidates.append((best["score"], model, best, test_m, preds_te, name))

    if not candidates:
        raise SystemExit("No constrained setting beat the recall floors. Leaving model unchanged.")

    candidates.sort(key=lambda r: r[0], reverse=True)
    _, model, setting, test_m, preds_te, name = candidates[0]
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


if __name__ == "__main__":
    main()
