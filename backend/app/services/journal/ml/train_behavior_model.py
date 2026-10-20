# Trains the behavior-category ML model on the labelled dataset and saves it with metrics.
# Run from backend/: python -m app.services.journal.ml.train_behavior_model

import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import ConfusionMatrixDisplay, accuracy_score, classification_report, confusion_matrix, f1_score
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from app.services.journal.ml.feature_extraction import FEATURE_NAMES

BACKEND_ROOT = Path(__file__).resolve().parents[4]
DATASET_PATH = BACKEND_ROOT / "datasets" / "journal" / "student_behavior.xlsx"
OUTPUT_DIR = BACKEND_ROOT / "trained-models" / "behavior-analysis"
MODEL_PATH = OUTPUT_DIR / "behavior_model.joblib"
RANDOM_STATE = 42

CANDIDATES = {
    "random_forest": RandomForestClassifier(
        n_estimators=200, max_depth=8, min_samples_leaf=2, random_state=RANDOM_STATE
    ),
    "gradient_boosting": GradientBoostingClassifier(
        n_estimators=150, max_depth=3, learning_rate=0.1, random_state=RANDOM_STATE
    ),
    "logistic_regression": Pipeline(
        [
            ("scaler", StandardScaler()),
            ("clf", LogisticRegression(max_iter=2000, random_state=RANDOM_STATE)),
        ]
    ),
}


def _load_dataset():
    df = pd.read_excel(DATASET_PATH)
    missing = [c for c in FEATURE_NAMES if c not in df.columns]
    if missing:
        raise ValueError(f"Dataset is missing expected feature columns: {missing}")
    X = df[FEATURE_NAMES]
    y = df["label_category"]
    return X, y


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    X, y = _load_dataset()
    print(f"Loaded {len(X)} labelled rows from {DATASET_PATH.name}")
    print(f"Class balance:\n{y.value_counts()}\n")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=RANDOM_STATE, stratify=y
    )

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
    cv_results = {}
    for name, estimator in CANDIDATES.items():
        scores = cross_val_score(estimator, X_train, y_train, cv=cv, scoring="accuracy")
        cv_results[name] = {"mean": float(scores.mean()), "std": float(scores.std())}
        print(f"{name}: CV accuracy {scores.mean():.3f} (+/- {scores.std():.3f})")

    best_name = max(cv_results, key=lambda n: cv_results[n]["mean"])
    best_model = CANDIDATES[best_name]
    print(f"\nBest candidate: {best_name}\n")

    best_model.fit(X_train, y_train)
    predictions = best_model.predict(X_test)

    test_accuracy = accuracy_score(y_test, predictions)
    test_f1_macro = f1_score(y_test, predictions, average="macro")
    report = classification_report(y_test, predictions, output_dict=True)
    report_text = classification_report(y_test, predictions)

    print(f"Test accuracy: {test_accuracy:.3f}")
    print(f"Test macro F1: {test_f1_macro:.3f}")
    print(report_text)

    labels = sorted(y.unique())
    cm = confusion_matrix(y_test, predictions, labels=labels)
    fig, ax = plt.subplots(figsize=(7, 6))
    ConfusionMatrixDisplay(cm, display_labels=labels).plot(ax=ax, xticks_rotation=45, colorbar=False)
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "confusion_matrix.png", dpi=150)
    plt.close(fig)

    if hasattr(best_model, "feature_importances_"):
        importances = best_model.feature_importances_
        order = sorted(range(len(FEATURE_NAMES)), key=lambda i: importances[i], reverse=True)
        fig, ax = plt.subplots(figsize=(8, 6))
        ax.barh([FEATURE_NAMES[i] for i in order][::-1], [importances[i] for i in order][::-1])
        ax.set_xlabel("Feature importance")
        fig.tight_layout()
        fig.savefig(OUTPUT_DIR / "feature_importance.png", dpi=150)
        plt.close(fig)

    # Refit on the full labelled set so the shipped model uses every row,
    # while the metrics above (from the held-out split) are what's reported.
    final_model = CANDIDATES[best_name]
    final_model.fit(X, y)

    joblib.dump(
        {
            "model": final_model,
            "feature_names": FEATURE_NAMES,
            "classes": sorted(y.unique()),
            "model_name": best_name,
            "trained_at": datetime.now(timezone.utc).isoformat(),
        },
        MODEL_PATH,
    )
    print(f"Saved model to {MODEL_PATH}")

    metrics = {
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "dataset_rows": len(X),
        "model_selected": best_name,
        "cross_validation": cv_results,
        "test_set_size": len(X_test),
        "test_accuracy": test_accuracy,
        "test_macro_f1": test_f1_macro,
        "classification_report": report,
    }
    with open(OUTPUT_DIR / "metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)
    with open(OUTPUT_DIR / "classification_report.txt", "w") as f:
        f.write(f"Model: {best_name}\n")
        f.write(f"Test accuracy: {test_accuracy:.3f}\nTest macro F1: {test_f1_macro:.3f}\n\n")
        f.write(report_text)
    print(f"Saved metrics to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
