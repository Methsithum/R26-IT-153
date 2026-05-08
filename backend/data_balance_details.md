# Data Balance Details (4-Class Focus Model)

Updated: 2026-05-08

## Overview
මෙම model pipeline එකේ final merged dataset එක classes 4ක් cover කරයි:
- 0 = Focused
- 1 = Fatigue
- 2 = Anxiety
- 3 = Boredom

Total samples: **7000**

## Class Distribution
| Class | Label    | Count | Percentage |
|------:|----------|------:|-----------:|
| 0     | Focused  | 3525  | 50.36%     |
| 1     | Fatigue  | 1000  | 14.29%     |
| 2     | Anxiety  | 500   | 7.14%      |
| 3     | Boredom  | 1975  | 28.21%     |

## Imbalance Analysis
- Majority class: Focused (3525)
- Minority class: Anxiety (500)
- Imbalance ratio (max/min): **7.05 : 1**

අර්ථය: Dataset එක balanced නොවුණත් class weighting හරහා training phase එකේ imbalance effect එක control කරලා තියෙනවා.

## Balancing Method Used
Oversampling/SMOTE use කරලා නෑ.

Use කරලා තියෙන්නේ **class weights**:

- weight(class 0) = 0.4964539007
- weight(class 1) = 1.75
- weight(class 2) = 3.5
- weight(class 3) = 0.8860759494

These were applied as **sample weights** during XGBoost training.

## Why This Is Correct
- Minority classes (especially Anxiety) get larger effective penalty for misclassification.
- Majority class (Focused) gets lower weight.
- No synthetic samples are created (data integrity preserved).

## Notes for Future Updates
If you add more Anxiety/Fatigue/Boredom data, rerun:
1. conversion scripts
2. `merge_all_datasets.py`
3. `train_xgboost.py`

Class weights will be recalculated automatically each run.
