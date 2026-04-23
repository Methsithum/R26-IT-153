# test_webcam.py

import cv2
import joblib
import json
import numpy as np

print("=" * 50)
print("STEP 4: Testing with Webcam")
print("=" * 50)

# Load model
model = joblib.load('backend/trained-models/focus_rescue_model.pkl')

# Load label names
with open('backend/trained-models/label_names.json', 'r') as f:
    label_names = json.load(f)

print("📸 Starting webcam... Press 'q' to quit")

# Initialize webcam
cap = cv2.VideoCapture(0)

# Load face detector
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

while True:
    ret, frame = cap.read()
    if not ret:
        break
    
    # Convert to grayscale
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    # Detect faces
    faces = face_cascade.detectMultiScale(gray, 1.3, 5)
    
    for (x, y, w, h) in faces:
        # Extract face region
        face_roi = gray[y:y+h, x:x+w]
        face_resized = cv2.resize(face_roi, (50, 50))
        
        # Predict
        features = face_resized.flatten().reshape(1, -1)
        prediction = model.predict(features)[0]
        state = label_names.get(str(prediction), "UNKNOWN")
        
        # Color based on state
        if prediction == 0:
            color = (0, 255, 0)    # Green - Focused
        elif prediction == 1:
            color = (0, 255, 255)  # Yellow - Fatigue
        elif prediction == 2:
            color = (0, 0, 255)    # Red - Anxiety
        else:
            color = (255, 0, 0)    # Blue - Boredom
        
        # Draw rectangle and label
        cv2.rectangle(frame, (x, y), (x+w, y+h), color, 2)
        cv2.putText(frame, state, (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 
                    0.8, color, 2)
    
    cv2.imshow('Focus Rescue - Real Time Detection', frame)
    
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
print("✅ Webcam test completed!")