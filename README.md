# 🎓 Smart Uni Guide

**Smart Uni Guide** is an AI-driven, all-in-one academic support platform designed to empower university students. By integrating personalized study planning, gamified engagement, focus monitoring, and career prediction, the system transforms raw academic and behavioral data into actionable insights, helping students reduce stress, improve performance, and achieve long-term success.

---

## ✨ Key Features

### 1. 📚 Academic Management with Personalized Study Planner
- **ML-powered scheduling** – Analyzes assignment marks, grades, deadlines, exam dates, and workload.
- **Dynamic adjustments** – Adapts study plans based on performance changes, internship commitments, and year-specific pressures.
- **Smart prioritization** – Generates personalized to-do lists and reminders to prevent missed deadlines.
- **Habit tracking** – Allocates study time per module while monitoring consistency.

### 2. 🎮 Gamified Student Journal
- **Interactive question-based interface** – Replaces manual journaling with guided, structured inputs.
- **Predefined options** – Ensures consistent, high-quality academic & behavioral data collection.
- **Engagement mechanics** – Game-like experience boosts motivation and daily participation.

### 3. 👁️ Gamified Student Focus Monitoring System
- **Real-time webcam analysis** – Tracks eye movement, facial expressions, head position, yawning, and blink rate.
- **State detection** – Identifies **Focused**, **Fatigue**, **Anxiety**, or **Boredom**.
- **Gamified feedback** – A growing tree represents focus; points, levels, and achievements reward sustained attention.
- **Personalized interventions**:
  - Fatigue → Short break suggestion
  - Anxiety → Breathing exercise
  - Boredom → Engaging content recommendation
- **Check-in system** – Prompts every 15 minutes to validate predictions and boost interaction.

### 4. 🔮 Integrated Future & Career Prediction Engine
- **Multi-source data fusion** – Combines academic (GPA, module marks, projects), emotional (stress, mood), and behavioral (study hours, attendance, sleep) data.
- **Ensemble ML models** – Outputs two core metrics:
  - **Career Readiness Score** – Alignment with suitable career domains.
  - **Academic & Burnout Risk Level** – Sustainability risk detection.
- **What-if simulation** – Students can adjust variables (e.g., study hours, stress levels) and see real-time impact on readiness and risk scores, enabling active, personalized decision-making.

---

## 🛠️ Tech Stack

| Layer       | Technology                                         |
|-------------|----------------------------------------------------|
| Backend     | FastAPI (Python)                                   |
| Frontend    | React + TailwindCSS                                |
| Database    | MongoDB                                            |
| AI/ML       | Scikit-learn, TensorFlow/PyTorch, OpenCV, Ensemble Models |

---

## 🧠 How It Works (High-Level Flow)

1. **Data Collection** – Via gamified journal, focus monitoring (webcam), and academic records.
2. **Processing** – FastAPI backend ingests data, stores in MongoDB, and triggers ML pipelines.
3. **Analysis** – Models predict focus states, personalize study plans, and generate career/burnout scores.
4. **Intervention** – React frontend displays dynamic dashboards, gamified feedback (tree growth), and actionable recommendations.
5. **Simulation** – Students interact with “what-if” sliders to explore future outcomes.

---

## 🚀 Getting Started

### Prerequisites
- Python 3.9+
- Node.js 16+
- MongoDB (local or Atlas)

### Backend Setup (FastAPI)
```
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
uvicorn main:app --reload
```

Frontend Setup (React + Tailwind)
```
cd frontend
npm install
npm run dev
```

Project Structure (Simplified)
```
smart-uni-guide/
├── backend/
│   ├── app/
│   │   ├── api/           # FastAPI endpoints
│   │   ├── models/        # MongoDB schemas
│   │   ├── ml/            # ML models (planner, focus, career)
│   │   └── utils/         # Helpers
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Dashboard, journal, focus, planner
│   │   └── styles/        # Tailwind CSS
│   └── package.json
└── README.md

```


👥 Team

Academic Management & Study Planner - Methsithu R C

Gamified Student Journal - Premathilaka H.P.D.D.

Focus Monitoring System - Abeyratne H.M.R.N.

Career Prediction Engine - Udantha W.A.I.

Smart Uni Guide – Where data meets student success.
