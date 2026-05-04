#!/bin/bash

echo "========================================="
echo "Academic Priority Prediction Pipeline"
echo "========================================="

# Activate virtual environment
source ../../venv/bin/activate

# Install required packages
echo "Installing required packages..."
pip install pandas numpy scikit-learn xgboost imbalanced-learn matplotlib seaborn joblib

# Step 1: Data Preprocessing
echo ""
echo "[Step 1] Running Data Preprocessing..."
python data_preprocessing.py

# Step 2: Model Training
echo ""
echo "[Step 2] Running Model Training..."
python model_training.py

# Step 3: Test Service
echo ""
echo "[Step 3] Testing Prediction Service..."
python model_service.py

echo ""
echo "========================================="
echo "Pipeline Complete!"
echo "========================================="