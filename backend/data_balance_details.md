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

අර්ථය: Dataset එක imbalanced වුණත්, SMOTE + class weighting හරහා training phase එකේ imbalance effect එක effectively control කරලා තියෙනවා.

## Balancing Method Used
දැන් **SMOTE (Synthetic Minority Over-sampling Technique) + Class Weights** දෙකම use කරලා තියෙනවා.

### SMOTE:
- Training data එක split කරලාට පස්සේ SMOTE apply කරනවා
- Minority classes (Anxiety, Fatigue, Boredom) සඳහා synthetic samples generate කරනවා
- Training data balanced බවට පත් කරනවා
- Test data එක original distribution එකේ තියෙනවා (fair evaluation)

### Class Weights:
- weight(class 0) = 0.4964539007
- weight(class 1) = 1.75
- weight(class 2) = 3.5
- weight(class 3) = 0.8860759494

These are applied as **sample weights** during XGBoost training on SMOTE-balanced data.

## Why This Is Correct
- **SMOTE**: Synthetic samples generate කරනවා minority classes වඩාත් improve කරගන්නට
- **Class Weights**: Additional regularization - minority class misclassification එකට larger penalty එක ගනවා
- **Dual approach**: SMOTE balanced training + class weights = better generalization
- **Test data unchanged**: Test set original distribution එකේ තියෙනවා - realistic performance assessment

## Notes for Future Updates
Rerun කරන්න:
1. conversion scripts
2. `merge_all_datasets.py`
3. `train_xgboost.py`

SMOTE සහ class weights දෙකම automatically recalculate වෙයි එක්‍ර run එකේ:
- SMOTE k_neighbors=5 සහ random_state=42 use කරනවා consistency එකට
- Class weights sklearn's balanced heuristic use කරනවා
