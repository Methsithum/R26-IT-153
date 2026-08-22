"""
Step 5 of the Student Focus Monitor ML pipeline: trains a 4-class focus
classifier (focused / fatigue / anxiety / boredom) via transfer learning on
top of MobileNetV2.

Two-stage training:
  Stage 1 -- backbone frozen, train only the new classification head.
  Stage 2 -- unfreeze the last ~20 backbone layers and fine-tune everything
             at a much lower learning rate, so the pretrained ImageNet
             features aren't wrecked by a large gradient step.

Train/val/test are loaded from the pre-split folders built by
build_unified_dataset.py and extract_daisee_boredom.py. We deliberately do
NOT use image_dataset_from_directory's `validation_split`, because that
re-shuffles images across a split boundary we already fixed on disk
specifically to keep a person's face from leaking across train/val/test.
"""
import json

import matplotlib
matplotlib.use("Agg")  # headless-safe backend, no display needed to save a PNG
import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
import tensorflow as tf
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.utils.class_weight import compute_class_weight

from dataset_utils import OUTPUT_ROOT, CLASSES, BACKEND_ROOT

IMG_SIZE = (224, 224)   # MobileNetV2's native input resolution
BATCH_SIZE = 32
STAGE1_EPOCHS = 10
STAGE2_EPOCHS = 8
STAGE1_LR = 1e-3
STAGE2_LR = 1e-5
FINE_TUNE_LAYERS = 20   # number of trailing backbone layers unfrozen in stage 2

# The smallest class (fatigue) was getting a ~1.87x "balanced" weight boost,
# giving the model a strong incentive to guess fatigue whenever unsure --
# it was dumping a lot of true boredom images into fatigue as a result.
# Capping the weight limits how hard we let the loss push toward any one
# minority class. NOTE: a first attempt at 2.0 never actually engaged (raw
# fatigue weight was 1.87, already under that cap) -- all the improvement
# that round came from early stopping alone. 1.4 is low enough to actually
# clip fatigue's weight this time.
MAX_CLASS_WEIGHT = 1.4

# Let each stage stop once val_loss stops improving instead of always
# running the full fixed epoch count -- stage 2 in particular was showing
# rising val_loss in its later epochs (overfitting to generic "sleepy
# expression" cues rather than genuinely separating fatigue from boredom).
EARLY_STOPPING_PATIENCE = 3

MODEL_DIR = BACKEND_ROOT / "trained-models" / "focus"
MODEL_DIR.mkdir(parents=True, exist_ok=True)


def load_split(split_name, shuffle):
    return tf.keras.utils.image_dataset_from_directory(
        OUTPUT_ROOT / split_name,
        labels="inferred",
        label_mode="int",       # integer class ids, paired with sparse_categorical_crossentropy
        class_names=CLASSES,    # fixes label-index order identically across train/val/test
        image_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
        shuffle=shuffle,
    )


def build_augmentation():
    """Random augmentation layers. Keras preprocessing layers like these only
    run under training=True and pass through unchanged at inference/eval
    time, so wiring augmentation directly into the model applies it to the
    training set only -- val/test see the original images automatically."""
    return tf.keras.Sequential([
        tf.keras.layers.RandomFlip("horizontal"),
        tf.keras.layers.RandomRotation(0.08),
        tf.keras.layers.RandomBrightness(0.15),
        tf.keras.layers.RandomZoom(0.15),
    ], name="augmentation")


def build_model():
    base_model = tf.keras.applications.MobileNetV2(
        input_shape=IMG_SIZE + (3,), include_top=False, weights="imagenet"
    )
    base_model.trainable = False  # frozen for stage 1

    inputs = tf.keras.Input(shape=IMG_SIZE + (3,))
    x = build_augmentation()(inputs)
    x = tf.keras.applications.mobilenet_v2.preprocess_input(x)
    x = base_model(x, training=False)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.Dropout(0.3)(x)
    outputs = tf.keras.layers.Dense(len(CLASSES), activation="softmax")(x)
    return tf.keras.Model(inputs, outputs), base_model


def compute_train_class_weights(train_ds):
    """Class weights from the training set's actual label distribution --
    the fixed UTA/DAiSEE person-level splits mean class sizes aren't equal,
    so we weight the loss instead of resampling/duplicating images.

    Raw "balanced" weights are clipped to MAX_CLASS_WEIGHT so the smallest
    class (fatigue) doesn't get such a large loss boost that the model
    starts guessing it whenever uncertain."""
    labels = np.concatenate([y.numpy() for _, y in train_ds])
    classes = np.arange(len(CLASSES))
    raw_weights = compute_class_weight(class_weight="balanced", classes=classes, y=labels)
    capped_weights = np.minimum(raw_weights, MAX_CLASS_WEIGHT)
    return dict(zip(classes, capped_weights))


def plot_training_curves(history1, history2, out_path):
    acc = history1.history["accuracy"] + history2.history["accuracy"]
    val_acc = history1.history["val_accuracy"] + history2.history["val_accuracy"]
    loss = history1.history["loss"] + history2.history["loss"]
    val_loss = history1.history["val_loss"] + history2.history["val_loss"]
    stage_boundary = len(history1.history["accuracy"])

    fig, axes = plt.subplots(1, 2, figsize=(12, 5))

    axes[0].plot(acc, label="train")
    axes[0].plot(val_acc, label="val")
    axes[0].axvline(stage_boundary - 0.5, color="gray", linestyle="--", label="fine-tune start")
    axes[0].set_title("Accuracy")
    axes[0].set_xlabel("epoch")
    axes[0].legend()

    axes[1].plot(loss, label="train")
    axes[1].plot(val_loss, label="val")
    axes[1].axvline(stage_boundary - 0.5, color="gray", linestyle="--", label="fine-tune start")
    axes[1].set_title("Loss")
    axes[1].set_xlabel("epoch")
    axes[1].legend()

    fig.tight_layout()
    fig.savefig(out_path)
    plt.close(fig)


def plot_confusion_matrix(y_true, y_pred, out_path):
    """Saves a two-panel heatmap: raw counts, and row-normalized (i.e. what
    fraction of each TRUE class's images landed in each PREDICTED class) --
    the normalized view is what makes the fatigue/boredom confusion
    directly readable regardless of the two classes' different sizes."""
    cm = confusion_matrix(y_true, y_pred, labels=np.arange(len(CLASSES)))
    cm_normalized = cm.astype(float) / cm.sum(axis=1, keepdims=True)

    fig, axes = plt.subplots(1, 2, figsize=(13, 5.5))
    sns.heatmap(cm, annot=True, fmt="d", cmap="Blues", xticklabels=CLASSES, yticklabels=CLASSES, ax=axes[0])
    axes[0].set_title("Confusion matrix (raw counts)")
    axes[0].set_xlabel("predicted")
    axes[0].set_ylabel("true")

    sns.heatmap(cm_normalized, annot=True, fmt=".1%", cmap="Blues", xticklabels=CLASSES, yticklabels=CLASSES, ax=axes[1])
    axes[1].set_title("Confusion matrix (row-normalized)")
    axes[1].set_xlabel("predicted")
    axes[1].set_ylabel("true")

    fig.tight_layout()
    fig.savefig(out_path)
    plt.close(fig)
    return cm, cm_normalized


def print_top_confusions(cm_normalized, top_n=5):
    """Plain-text ranking of the largest off-diagonal confusions, phrased as
    "X% of true <A> images were predicted as <B>" -- directly quotable in a
    report's limitations section."""
    pairs = []
    for i, true_cls in enumerate(CLASSES):
        for j, pred_cls in enumerate(CLASSES):
            if i != j:
                pairs.append((cm_normalized[i, j], true_cls, pred_cls))
    pairs.sort(reverse=True)

    print(f"\nTop {top_n} class-pair confusions on the test set:")
    for frac, true_cls, pred_cls in pairs[:top_n]:
        print(f"  {frac:.1%} of true {true_cls} images were predicted as {pred_cls}")


def main():
    train_ds = load_split("train", shuffle=True)
    val_ds = load_split("val", shuffle=False)
    test_ds = load_split("test", shuffle=False)

    # Computed before caching/prefetching so this is a plain one-off pass
    # over the labels, not tangled up with the training data pipeline.
    class_weights = compute_train_class_weights(train_ds)
    print(f"Capped class weights used (max {MAX_CLASS_WEIGHT}):",
          {CLASSES[i]: round(w, 3) for i, w in class_weights.items()})

    AUTOTUNE = tf.data.AUTOTUNE
    train_ds = train_ds.cache().prefetch(AUTOTUNE)
    val_ds = val_ds.cache().prefetch(AUTOTUNE)
    test_ds = test_ds.cache().prefetch(AUTOTUNE)

    model, base_model = build_model()

    # --- Stage 1: train the head only ---
    model.compile(
        optimizer=tf.keras.optimizers.Adam(STAGE1_LR),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    print("\n=== Stage 1: training classification head (backbone frozen) ===")
    stage1_early_stop = tf.keras.callbacks.EarlyStopping(
        monitor="val_loss", patience=EARLY_STOPPING_PATIENCE, restore_best_weights=True
    )
    history1 = model.fit(
        train_ds, validation_data=val_ds, epochs=STAGE1_EPOCHS,
        class_weight=class_weights, callbacks=[stage1_early_stop],
    )
    print(f"Stage 1 stopped after {len(history1.history['loss'])}/{STAGE1_EPOCHS} epochs "
          f"(best weights restored from the lowest val_loss epoch)")

    # --- Stage 2: fine-tune the last few backbone layers ---
    base_model.trainable = True
    for layer in base_model.layers[:-FINE_TUNE_LAYERS]:
        layer.trainable = False

    model.compile(
        optimizer=tf.keras.optimizers.Adam(STAGE2_LR),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    print(f"\n=== Stage 2: fine-tuning last {FINE_TUNE_LAYERS} backbone layers ===")
    stage2_early_stop = tf.keras.callbacks.EarlyStopping(
        monitor="val_loss", patience=EARLY_STOPPING_PATIENCE, restore_best_weights=True
    )
    history2 = model.fit(
        train_ds, validation_data=val_ds, epochs=STAGE2_EPOCHS,
        class_weight=class_weights, callbacks=[stage2_early_stop],
    )
    print(f"Stage 2 stopped after {len(history2.history['loss'])}/{STAGE2_EPOCHS} epochs "
          f"(best weights restored from the lowest val_loss epoch)")

    # --- Save model + training curves ---
    model_path = MODEL_DIR / "focus_mobilenetv2.keras"
    model.save(model_path)
    plot_training_curves(history1, history2, MODEL_DIR / "training_curves.png")
    print(f"\nSaved model to {model_path}")

    # --- Final evaluation on the held-out TEST split (the reported number) ---
    y_true = np.concatenate([y.numpy() for _, y in test_ds])
    y_pred_probs = model.predict(test_ds)
    y_pred = np.argmax(y_pred_probs, axis=1)

    report_text = classification_report(y_true, y_pred, target_names=CLASSES, digits=3)
    print("\n=== Test-set classification report ===")
    print(report_text)

    report_dict = classification_report(y_true, y_pred, target_names=CLASSES, digits=3, output_dict=True)
    with open(MODEL_DIR / "test_classification_report.json", "w") as f:
        json.dump(report_dict, f, indent=2)
    with open(MODEL_DIR / "test_classification_report.txt", "w") as f:
        f.write(report_text)

    # --- Confusion matrix on the same held-out TEST split ---
    cm, cm_normalized = plot_confusion_matrix(y_true, y_pred, MODEL_DIR / "confusion_matrix.png")
    print("\n=== Confusion matrix (raw counts, rows=true, cols=predicted) ===")
    print(CLASSES)
    print(cm)
    print_top_confusions(cm_normalized)


if __name__ == "__main__":
    main()
