# Behaviour evaluation observed on 14 September 2026

Command executed from `ai-service`:

```powershell
.\venv313\Scripts\python.exe training/evaluate_behaviour.py
```

The command completed with exit code 0. The following is its captured standard output. It did not retrain the model.

```text
====================================
VIRTUAL GUARD BEHAVIOUR MODEL V2
BASELINE EVALUATION
====================================
Dataset: video_features_improved.csv
Original videos: 182
Train: 127 videos
Validation: 27 videos
Test: 28 videos
Features: 14
Model: RandomForestClassifier
Normal videos: 90
Shoplifting videos: 92
Normal features: 90
Shoplifting features: 92
Label mapping: normal -> 0, shoplifting -> 1

TEST METRICS
Accuracy: 82.14%
Precision: 80.00%
Recall: 85.71%
F1: 82.76%
Confusion matrix: [[11, 3], [2, 12]]
Class metrics:
  normal: precision=0.8462, recall=0.7857, f1=0.8148, support=14
  shoplifting: precision=0.8000, recall=0.8571, f1=0.8276, support=14
====================================
```

The script evaluates `models/behaviour_model_v2.pkl` with `models/scaler_v2.pkl` against stored feature rows in `datasets/features/video_features_improved.csv`. It creates stratified video-name splits with random seed 42. It does not decode the original videos again or verify that these test videos were excluded from the saved model's original training.

Treat this as a reproducible local baseline observation, not a verified independent holdout or complete video-pipeline accuracy measurement. See [the computational guide](COMPUTATIONAL_BACKEND_README.md) for interpretation.
