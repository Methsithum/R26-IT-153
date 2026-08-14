"""
evaluate.py

Scores every trained model on its held-out test set (never touched during
training or hyperparameter search), builds a single comparison table,
plots a confusion matrix for the best model per dataset, and prints the
top 10 feature importances for the Random Forest and XGBoost models.

Run after train_models.py, from anywhere:
    python evaluate.py
"""

import json
import os

import joblib
import matplotlib

matplotlib.use("Agg")  # headless-safe backend for saving PNGs
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from sklearn.metrics import (
    ConfusionMatrixDisplay,
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.normpath(
    os.path.join(SCRIPT_DIR, "..", "..", "trained-models", "study-planner", "models")
)
RESULTS_DIR = os.path.normpath(
    os.path.join(SCRIPT_DIR, "..", "..", "trained-models", "study-planner", "results")
)
os.makedirs(RESULTS_DIR, exist_ok=True)

DATASETS = ["performance", "oulad"]
MODEL_NAMES = ["logistic_regression", "random_forest", "xgboost"]


def log(msg):
    print(f"[evaluate] {msg}", flush=True)


def load_model(dataset_name, model_name):
    path = os.path.join(MODELS_DIR, f"{dataset_name}_{model_name}.pkl")
    return joblib.load(path)


def get_feature_names(pipe):
    """Pull the post-one-hot-encoding feature names out of a fitted pipeline
    for feature-importance reporting."""
    preprocessor = pipe.named_steps["preprocess"]
    return preprocessor.get_feature_names_out()


def evaluate_model(pipe, X_test, y_test):
    y_pred = pipe.predict(X_test)
    y_proba = pipe.predict_proba(X_test)[:, 1]
    return {
        "accuracy": accuracy_score(y_test, y_pred),
        "precision": precision_score(y_test, y_pred, zero_division=0),
        "recall": recall_score(y_test, y_pred, zero_division=0),
        "f1": f1_score(y_test, y_pred, zero_division=0),
        "roc_auc": roc_auc_score(y_test, y_proba),
    }, y_pred


def plot_confusion_matrix(y_test, y_pred, dataset_name, model_name):
    cm = confusion_matrix(y_test, y_pred)
    fig, ax = plt.subplots(figsize=(5, 4))
    sns.heatmap(cm, annot=True, fmt="d", cmap="Blues", ax=ax,
                xticklabels=["Not At-Risk", "At-Risk"],
                yticklabels=["Not At-Risk", "At-Risk"])
    ax.set_xlabel("Predicted")
    ax.set_ylabel("Actual")
    ax.set_title(f"{dataset_name} — {model_name} (best model) — Confusion Matrix")
    fig.tight_layout()
    out_path = os.path.join(RESULTS_DIR, f"{dataset_name}_{model_name}_confusion_matrix.png")
    fig.savefig(out_path, dpi=150)
    plt.close(fig)
    log(f"  Saved confusion matrix -> {out_path}")


def print_top_feature_importances(pipe, model_name, dataset_name, top_n=10):
    if model_name not in ("random_forest", "xgboost"):
        return
    feature_names = get_feature_names(pipe)
    importances = pipe.named_steps["clf"].feature_importances_
    order = np.argsort(importances)[::-1][:top_n]

    print(f"\nTop {top_n} feature importances — {dataset_name} / {model_name}:")
    for rank, idx in enumerate(order, start=1):
        print(f"  {rank:2d}. {feature_names[idx]:40s} {importances[idx]:.4f}")


def plot_comparison_chart(results_df):
    """Grouped bar chart of precision/recall/f1/roc_auc for every
    dataset x model combination, saved as results/model_comparison.png."""
    metrics = ["accuracy", "precision", "recall", "f1", "roc_auc"]
    # Validated categorical palette (dataviz skill default order): blue, orange, aqua, yellow, magenta.
    colors = {
        "accuracy": "#2a78d6", "precision": "#eb6834", "recall": "#1baf7a",
        "f1": "#eda100", "roc_auc": "#e87ba4",
    }

    surface = "#fcfcfb"
    text_primary = "#0b0b0b"
    text_secondary = "#52514e"
    gridline = "#e1e0d9"
    baseline = "#c3c2b7"

    labels = [f"{row.dataset}\n{row.model}" for row in results_df.itertuples()]
    n_groups = len(labels)
    n_metrics = len(metrics)
    x = np.arange(n_groups)
    bar_width = 0.8 / n_metrics

    fig, ax = plt.subplots(figsize=(11, 5.5))
    fig.patch.set_facecolor(surface)
    ax.set_facecolor(surface)

    for i, metric in enumerate(metrics):
        offsets = x + (i - (n_metrics - 1) / 2) * bar_width
        values = results_df[metric].values
        ax.bar(offsets, values, width=bar_width, label=metric.replace("_", " ").upper(),
               color=colors[metric], edgecolor=surface, linewidth=2)

    ax.set_xticks(x)
    ax.set_xticklabels(labels, color=text_primary, fontsize=9)
    ax.set_ylim(0, 1.05)
    ax.set_ylabel("Score", color=text_primary)
    ax.set_title("Model Comparison — Test Set", color=text_primary, fontsize=13, pad=14)

    ax.grid(axis="y", color=gridline, linewidth=1, zorder=0)
    ax.set_axisbelow(True)
    for spine in ["top", "right", "left"]:
        ax.spines[spine].set_visible(False)
    ax.spines["bottom"].set_color(baseline)
    ax.tick_params(colors=text_secondary)

    legend = ax.legend(
        loc="upper center", bbox_to_anchor=(0.5, -0.18), ncol=n_metrics,
        frameon=False, labelcolor=text_primary,
    )

    fig.tight_layout()
    out_path = os.path.join(RESULTS_DIR, "model_comparison.png")
    fig.savefig(out_path, dpi=150, facecolor=surface, bbox_extra_artists=(legend,), bbox_inches="tight")
    plt.close(fig)
    log(f"Saved comparison chart -> {out_path}")


def save_best_model(dataset_name, best_model_name, best_metrics):
    """Copy the winning pipeline + its feature schema to a stable
    '<dataset>_best_model.*' name so downstream services (the FastAPI
    inference layer) don't need to know which algorithm won."""
    src_model = os.path.join(MODELS_DIR, f"{dataset_name}_{best_model_name}.pkl")
    dst_model = os.path.join(MODELS_DIR, f"{dataset_name}_best_model.pkl")
    joblib.dump(joblib.load(src_model), dst_model)

    src_schema = os.path.join(MODELS_DIR, f"{dataset_name}_feature_schema.json")
    with open(src_schema) as f:
        schema = json.load(f)
    schema["selected_model"] = best_model_name
    schema["test_metrics"] = {
        k: round(v, 4) for k, v in best_metrics.items()
        if k in ("accuracy", "precision", "recall", "f1", "roc_auc")
    }
    dst_schema = os.path.join(MODELS_DIR, f"{dataset_name}_best_model_schema.json")
    with open(dst_schema, "w") as f:
        json.dump(schema, f, indent=2)

    log(f"  Saved best model -> {dst_model} (chose {best_model_name})")
    log(f"  Saved best model schema -> {dst_schema}")


def main():
    all_results = []

    for dataset_name in DATASETS:
        log("=" * 70)
        log(f"Evaluating models for: {dataset_name}")
        log("=" * 70)

        holdout = joblib.load(os.path.join(MODELS_DIR, f"{dataset_name}_holdout_data.pkl"))
        X_test, y_test = holdout["X_test"], holdout["y_test"]

        dataset_results = []
        pipes = {}
        for model_name in MODEL_NAMES:
            pipe = load_model(dataset_name, model_name)
            pipes[model_name] = pipe
            metrics, y_pred = evaluate_model(pipe, X_test, y_test)
            metrics.update({"dataset": dataset_name, "model": model_name})
            dataset_results.append(metrics)
            all_results.append(metrics)
            log(f"  {model_name:20s} accuracy={metrics['accuracy']:.3f} "
                f"precision={metrics['precision']:.3f} "
                f"recall={metrics['recall']:.3f} f1={metrics['f1']:.3f} "
                f"roc_auc={metrics['roc_auc']:.3f}")

        # Best model per dataset by F1 -> confusion matrix plot
        best = max(dataset_results, key=lambda r: r["f1"])
        best_model_name = best["model"]
        log(f"Best model for {dataset_name}: {best_model_name} (F1={best['f1']:.3f})")
        _, y_pred_best = evaluate_model(pipes[best_model_name], X_test, y_test)
        plot_confusion_matrix(y_test, y_pred_best, dataset_name, best_model_name)
        save_best_model(dataset_name, best_model_name, best)

        for model_name in ("random_forest", "xgboost"):
            print_top_feature_importances(pipes[model_name], model_name, dataset_name)

    results_df = pd.DataFrame(all_results)[
        ["dataset", "model", "accuracy", "precision", "recall", "f1", "roc_auc"]
    ]
    print("\n" + "=" * 70)
    print("Model comparison (test set)")
    print("=" * 70)
    print(results_df.to_string(index=False))

    out_csv = os.path.join(RESULTS_DIR, "model_comparison.csv")
    results_df.to_csv(out_csv, index=False)
    log(f"\nSaved comparison table -> {out_csv}")

    plot_comparison_chart(results_df)


if __name__ == "__main__":
    main()
