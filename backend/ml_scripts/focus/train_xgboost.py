import pandas as pd
import numpy as np
import xgboost as xgb
import joblib
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, balanced_accuracy_score
from sklearn.utils.class_weight import compute_class_weight
from imblearn.over_sampling import SMOTE
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent.resolve()
BACKEND_DIR = SCRIPT_DIR.parent.parent.resolve()
DATA_PATH = BACKEND_DIR / "datasets" / "focus" / "processed" / "training_data.csv"
MODEL_PATH = BACKEND_DIR / "trained-models" / "focus" / "xgboost_state_classifier.pkl"
STATE_NAMES = {0: 'Focused', 1: 'Fatigue', 2: 'Anxiety', 3: 'Boredom'}


def get_class_weights(y):
    """Return a class -> weight mapping using sklearn's balanced heuristic."""
    classes = np.unique(y)
    weights = compute_class_weight(class_weight='balanced', classes=classes, y=y)
    return dict(zip(classes, weights))

def train_model():
    df = pd.read_csv(DATA_PATH)
    
    # Get feature columns (exclude labels / metadata)
    feature_cols = [
        col for col in df.columns
        if col not in ['state', 'source', 'label', 'image_name', 'image_path', 'video_name', 'frame_num', 'emotion', 'state_name']
    ]
    
    X = df[feature_cols].values
    y = df['state'].values

    present_classes = sorted(np.unique(y).tolist())
    required_classes = [0, 1, 2, 3]
    missing_classes = [c for c in required_classes if c not in present_classes]
    if missing_classes:
        raise ValueError(
            f"Missing required classes in training data: {missing_classes}. "
            "Regenerate processed datasets so all classes 0,1,2,3 are present."
        )
    
    print(f"Dataset shape: {X.shape}")
    print(f"Features: {feature_cols}")
    print(f"\nClass distribution:")
    for state, count in df['state'].value_counts().sort_index().items():
        print(f"  state {state}: {count}")
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    print(f"\nBefore SMOTE:")
    print(f"  Training samples: {len(X_train)}")
    print(f"  Test samples: {len(X_test)}")
    print(f"  Training class distribution:")
    unique, counts = np.unique(y_train, return_counts=True)
    for state, count in zip(unique, counts):
        print(f"    state {state}: {count}")
    
    # Apply SMOTE for data balancing
    print("\n--- Applying SMOTE ---")
    smote = SMOTE(random_state=42, k_neighbors=5)
    X_train_resampled, y_train_resampled = smote.fit_resample(X_train, y_train)
    
    print(f"\nAfter SMOTE:")
    print(f"  Training samples: {len(X_train_resampled)}")
    print(f"  Training class distribution:")
    unique, counts = np.unique(y_train_resampled, return_counts=True)
    for state, count in zip(unique, counts):
        print(f"    state {state}: {count}")
    
    # Calculate class weights for imbalance (on original data for consistency)
    weight_dict = get_class_weights(y_train)
    
    print(f"\nClass weights (based on original distribution): {weight_dict}")
    
    # Assign sample weights
    sample_weights = np.array([weight_dict[label] for label in y_train_resampled])
    
    # Train XGBoost
    model = xgb.XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        eval_metric='mlogloss'
    )
    
    print("\n--- Training Model ---")
    model.fit(X_train_resampled, y_train_resampled, sample_weight=sample_weights)
    
    # Evaluate
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    balanced_acc = balanced_accuracy_score(y_test, y_pred)
    
    print(f"\n--- Results ---")
    print(f"Test Accuracy: {accuracy:.4f}")
    print(f"Balanced Accuracy: {balanced_acc:.4f}")
    print(f"\nClassification Report:")
    report_labels = sorted(np.unique(y))
    report_names = [STATE_NAMES[i] for i in report_labels]
    print(classification_report(
        y_test,
        y_pred,
        labels=report_labels,
        target_names=report_names,
        zero_division=0,
    ))
    
    print("\nConfusion Matrix:")
    cm = confusion_matrix(y_test, y_pred)
    print(cm)
    
    # Cross-validation
    cv_scores = cross_val_score(model, X, y, cv=5, scoring='balanced_accuracy')
    print(f"\n5-fold Cross Validation Balanced Accuracy: {cv_scores.mean():.4f} (+/- {cv_scores.std():.4f})")
    
    # Save model
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    print(f"\n✅ Model saved to {MODEL_PATH}")
    
    # Feature importance
    importance = model.feature_importances_
    print("\n--- Feature Importance ---")
    for feat, imp in zip(feature_cols, importance):
        print(f"  {feat}: {imp:.4f}")

if __name__ == "__main__":
    train_model()