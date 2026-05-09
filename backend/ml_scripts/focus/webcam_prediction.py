import cv2
import numpy as np
import pandas as pd
import joblib
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).parent))
from feature_extractor import FaceFeatureExtractor

# Load trained model if exists
SCRIPT_DIR = Path(__file__).parent.resolve()
BACKEND_DIR = SCRIPT_DIR.parent.parent.resolve()
MODEL_PATH = BACKEND_DIR / "trained-models" / "focus" / "xgboost_state_classifier.pkl"
SCALER_PATH = BACKEND_DIR / "trained-models" / "focus" / "scaler.pkl"

STATE_NAMES = {
    0: 'Focused',
    1: 'Fatigue',
    2: 'Anxiety',
    3: 'Boredom',
}
state_colors = {
    'Focused': (0, 255, 0),      # Green
    'Fatigue': (0, 165, 255),    # Orange
    'Anxiety': (0, 0, 255),      # Red
    'Boredom': (255, 0, 0)       # Blue
}

def load_model():
    """Load trained model and scaler if available"""
    model = None
    scaler = None
    
    if MODEL_PATH.exists():
        model = joblib.load(MODEL_PATH)
        print(f"✅ Model loaded from {MODEL_PATH}")
    else:
        print(f"⚠️ Model not found at {MODEL_PATH}")
        print("   Will run in demo mode (no predictions)")
    
    if SCALER_PATH.exists():
        scaler = joblib.load(SCALER_PATH)
        print(f"✅ Scaler loaded from {SCALER_PATH}")
        if hasattr(scaler, 'feature_names_in_'):
            print(f"   Expected features: {list(scaler.feature_names_in_)}")
        if hasattr(scaler, 'mean_') and hasattr(scaler, 'feature_names_in_'):
            print("   Using training means as fallback values for missing webcam features")
    
    return model, scaler

def predict_state(model, scaler, features):
    """Predict state from features"""
    if model is None or scaler is None:
        return None, None
    
    # Match the exact training feature order and use neutral defaults for
    # features that are not available from the live webcam extractor.
    feature_cols = list(scaler.feature_names_in_) if hasattr(scaler, 'feature_names_in_') else list(features.keys())
    feature_defaults = {}
    if hasattr(scaler, 'mean_') and len(getattr(scaler, 'mean_', [])) == len(feature_cols):
        feature_defaults = dict(zip(feature_cols, scaler.mean_))
    
    # Create feature DataFrame (with column names to avoid sklearn warning)
    X_df = pd.DataFrame([{col: features.get(col, feature_defaults.get(col, 0.0)) for col in feature_cols}])
    
    # Scale features
    X_scaled = scaler.transform(X_df)
    
    # Predict
    prediction = model.predict(X_scaled)[0]
    probabilities = model.predict_proba(X_scaled)[0]
    
    return STATE_NAMES.get(int(prediction), f"Unknown({prediction})"), float(np.max(probabilities))

def run_webcam_prediction():
    print("="*50)
    print("Focus Rescue - Real-time State Detection")
    print("="*50)
    
    # Load model
    model, scaler = load_model()
    
    # Initialize webcam
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("❌ Cannot open webcam!")
        return
    
    print("✅ Webcam opened!")
    print("\nControls:")
    print("   Press 'q' to quit")
    print("   Press 'r' to reset")
    print("\n" + "="*50)
    
    # Initialize feature extractor
    extractor = FaceFeatureExtractor()
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    
    frame_count = 0
    current_state = "Waiting..."
    confidence = 0.0
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        frame_count += 1
        display_frame = frame.copy()
        
        # Face detection
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.3, 5)
        
        if len(faces) > 0:
            # Get the largest face
            (x, y, w, h) = max(faces, key=lambda f: f[2] * f[3])
            cv2.rectangle(display_frame, (x, y), (x+w, y+h), (0, 255, 0), 2)
            
            # Extract features
            features = extractor.extract_all_features(frame)
            
            if features and model is not None:
                # Predict state
                state, conf = predict_state(model, scaler, features)
                if state:
                    current_state = state
                    confidence = conf
            
            # Show features on frame
            if features:
                y_pos = y + h + 20
                cv2.putText(display_frame, f"EAR: {features.get('avg_ear', 0):.3f}", 
                           (x, y_pos), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)
                y_pos += 20
                cv2.putText(display_frame, f"MAR: {features.get('mouth_ratio', 0):.3f}", 
                           (x, y_pos), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)
        
        # Display current state
        state_color = state_colors.get(current_state, (255, 255, 255))
        
        # Background for state text
        cv2.rectangle(display_frame, (10, 10), (300, 80), (0, 0, 0), -1)
        cv2.putText(display_frame, f"STATE: {current_state}", (20, 45), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.8, state_color, 2)
        cv2.putText(display_frame, f"Confidence: {confidence:.2f}", (20, 70), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)
        
        # Instructions
        cv2.putText(display_frame, "Press 'q' to quit", (10, display_frame.shape[0] - 10), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        
        # Show frame
        cv2.imshow('Focus Rescue - Real-time State Detection', display_frame)
        
        # Handle key press
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('r'):
            current_state = "Waiting..."
            confidence = 0.0
            print("Reset!")
    
    cap.release()
    cv2.destroyAllWindows()
    print("\n✅ Webcam prediction completed!")

if __name__ == "__main__":
    run_webcam_prediction()