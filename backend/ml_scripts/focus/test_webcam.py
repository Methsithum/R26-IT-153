# 03_test_webcam.py

import cv2
import joblib
import json

print("="*60)
print("STEP 3: PP1 DEMO - Focus Rescue")
print("FOCUSED (Green) | FATIGUE (Yellow) | ANXIETY (Red)")
print("="*60)

# Paths
MODEL_PATH = "ml_data/focus/models/focus_rescue_pp1.pkl"
SCALER_PATH = "ml_data/focus/models/scaler_pp1.pkl"
LABELS_PATH = "ml_data/focus/models/labels_pp1.json"

# Load model
model = joblib.load(MODEL_PATH)
scaler = joblib.load(SCALER_PATH)

with open(LABELS_PATH, 'r') as f:
    labels = json.load(f)

# Initialize webcam
cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print("❌ Webcam not found!")
    exit()

face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

print("\n📸 Press 'q' to quit")

while True:
    ret, frame = cap.read()
    if not ret:
        break
    
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, 1.3, 5)
    
    for (x, y, w, h) in faces:
        face = gray[y:y+h, x:x+w]
        face_resized = cv2.resize(face, (50, 50))
        features = face_resized.flatten().reshape(1, -1)
        
        features_scaled = scaler.transform(features)
        pred = model.predict(features_scaled)[0]
        state = labels.get(str(pred), "UNKNOWN")
        
        if pred == 0:
            color = (0, 255, 0)
        elif pred == 1:
            color = (0, 255, 255)
        else:
            color = (0, 0, 255)
        
        cv2.rectangle(frame, (x, y), (x+w, y+h), color, 2)
        cv2.putText(frame, state, (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)
    
    cv2.imshow('Focus Rescue - PP1 Demo', frame)
    
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
print("\n✅ Demo completed!")