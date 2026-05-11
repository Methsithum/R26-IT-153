"""
=====================================================================
 Academic Study Planner — Master Pipeline Runner
 Usage: python run_pipeline.py
=====================================================================
Copies uploaded datasets to the correct folder, then runs:
  Step 1 — Data Cleaning & Preprocessing
  Step 2 — Model Training
  Step 3 — Deep Evaluation
=====================================================================
"""

import os
import sys
import shutil
import subprocess

BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
DATA_DIR    = os.path.join(BASE_DIR, "datasets",      "study-planner")
SCRIPTS_DIR = os.path.join(BASE_DIR, "ml_scripts",    "study-planner")
MODEL_DIR   = os.path.join(BASE_DIR, "trained-models","study-planner")
VIZ_DIR     = os.path.join(MODEL_DIR, "visualizations")

os.makedirs(DATA_DIR,    exist_ok=True)
os.makedirs(SCRIPTS_DIR, exist_ok=True)
os.makedirs(MODEL_DIR,   exist_ok=True)
os.makedirs(VIZ_DIR,     exist_ok=True)

# ── Copy source datasets if running locally ────────────────────────
# Update these paths to wherever your files actually are
SOURCE_FILES = {
    "train_data.csv": os.path.join(BASE_DIR, "train_data.csv"),
    "test_data.csv":  os.path.join(BASE_DIR, "test_data.csv"),
    "X_train.npy":    os.path.join(BASE_DIR, "X_train.npy"),
    "X_test.npy":     os.path.join(BASE_DIR, "X_test.npy"),
    "y_train.npy":    os.path.join(BASE_DIR, "y_train.npy"),
    "y_test.npy":     os.path.join(BASE_DIR, "y_test.npy"),
}

print("=" * 60)
print("  ACADEMIC STUDY PLANNER — ML PIPELINE")
print("=" * 60)
print()

for fname, src in SOURCE_FILES.items():
    dest = os.path.join(DATA_DIR, fname)
    if os.path.exists(src) and not os.path.exists(dest):
        shutil.copy(src, dest)
        print(f"[COPY]  {fname} → datasets/study-planner/")
    elif os.path.exists(dest):
        print(f"[OK]    {fname} already in datasets/study-planner/")
    else:
        print(f"[SKIP]  {fname} not found at {src}")

print()

STEPS = [
    ("Step 1 — Data Cleaning",  os.path.join(SCRIPTS_DIR, "01_data_cleaning.py")),
    ("Step 2 — Model Training", os.path.join(SCRIPTS_DIR, "02_train_models.py")),
    ("Step 3 — Evaluation",     os.path.join(SCRIPTS_DIR, "03_evaluate.py")),
]

for step_name, script in STEPS:
    print(f"\n{'='*60}")
    print(f"  ▶  {step_name}")
    print(f"{'='*60}")
    if not os.path.exists(script):
        print(f"  ⚠  Script not found: {script}")
        continue
    result = subprocess.run([sys.executable, script], capture_output=False)
    if result.returncode != 0:
        print(f"\n❌  {step_name} FAILED (exit code {result.returncode})")
        sys.exit(result.returncode)

print("\n" + "="*60)
print("  ✅  ALL STEPS COMPLETE")
print("="*60)
print(f"\n  Trained models : {MODEL_DIR}")
print(f"  Visualizations : {VIZ_DIR}")
print(f"  Datasets       : {DATA_DIR}")
print()
print("  Next: start FastAPI server")
print("    uvicorn app.main:app --reload --port 8000")
print()