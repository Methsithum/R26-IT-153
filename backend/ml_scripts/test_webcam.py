# test_webcam.py - 100% Working

import cv2
import joblib
import json
import os

print("=" * 60)
print("STEP 3: Testing with Webcam")
print("=" * 60)

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(BACKEND_DIR, 'trained-models')

# Load model
model_path = os.path.join(MODELS_DIR, 'focus_rescue_model.pkl')
label_path = os.path.join(MODELS_DIR, 'label_names.json')

if not os.path.exists(model_path):
    print("❌ Model not found! Please run train_model.py first.")
    exit()

model = joblib.load(model_path)

with open(label_path, 'r') as f:
    label_names = json.load(f)

print("📸 Starting webcam... Press 'q' to quit")

cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("❌ Webcam not found! Please check your camera.")
    exit()

face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

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
        
        prediction = model.predict(features)[0]
        state = label_names.get(str(prediction), "UNKNOWN")
        
        # Color coding
        if prediction == 0:
            color = (0, 255, 0)      # Green - Focused
        elif prediction == 1:
            color = (0, 255, 255)    # Yellow - Fatigue
        elif prediction == 2:
            color = (0, 0, 255)      # Red - Anxiety
        else:
            color = (255, 0, 0)      # Blue - Boredom
        
        cv2.rectangle(frame, (x, y), (x+w, y+h), color, 2)
        cv2.putText(frame, state, (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)
    
    cv2.imshow('Focus Rescue - Real-Time Detection', frame)
    
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
print("✅ Webcam test completed!")