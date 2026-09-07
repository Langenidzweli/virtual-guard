from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import joblib
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_recall_fscore_support,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split

from app.models.behaviour import BEHAVIOUR_FEATURE_COLUMNS, BEHAVIOUR_TARGET_MAPPING, BEHAVIOUR_TARGET_LABELS

DATASET_PATH = ROOT / "datasets" / "features" / "video_features_improved.csv"
MODEL_PATH = ROOT / "models" / "behaviour_model_v2.pkl"
SCALER_PATH = ROOT / "models" / "scaler_v2.pkl"


def load_model_and_scaler():
    if not MODEL_PATH.exists() or not SCALER_PATH.exists():
        raise FileNotFoundError(f"Expected model artifacts at {MODEL_PATH} and {SCALER_PATH}")

    model = joblib.load(MODEL_PATH)
    scaler = joblib.load(SCALER_PATH)
    expected = list(BEHAVIOUR_FEATURE_COLUMNS)
    actual = [str(name) for name in list(scaler.feature_names_in_)]
    if actual != expected:
        raise ValueError(
            f"Scaler schema mismatch: expected {expected} but found {actual}. "
            "This indicates the feature schema is not aligned with the trained v2 model."
        )
    if getattr(model, "n_features_in_", None) != len(expected):
        raise ValueError(
            f"Model expects {getattr(model, 'n_features_in_', 'unknown')} features but the expected schema is {len(expected)}"
        )
    return model, scaler


def load_dataset():
    df = pd.read_csv(DATASET_PATH)
    required = {"video_name", "label"} | set(BEHAVIOUR_FEATURE_COLUMNS)
    missing = sorted(required - set(df.columns))
    if missing:
        raise ValueError(f"Dataset is missing expected columns: {missing}")

    invalid_labels = sorted(set(df["label"]) - set(BEHAVIOUR_TARGET_MAPPING.keys()))
    if invalid_labels:
        raise ValueError(f"Dataset contains unexpected labels: {invalid_labels}")

    return df


def video_level_split(df: pd.DataFrame):
    video_labels = df[["video_name", "label"]].drop_duplicates()
    train_videos, temp_videos = train_test_split(
        video_labels,
        test_size=0.30,
        random_state=42,
        stratify=video_labels["label"],
    )
    val_videos, test_videos = train_test_split(
        temp_videos,
        test_size=0.50,
        random_state=42,
        stratify=temp_videos["label"],
    )

    def subset(videos):
        return df[df["video_name"].isin(videos["video_name"])].copy()

    return subset(train_videos), subset(val_videos), subset(test_videos)


def evaluate_split(model, scaler, split_df: pd.DataFrame):
    X = split_df[BEHAVIOUR_FEATURE_COLUMNS].copy()
    y = split_df["label"].map(BEHAVIOUR_TARGET_MAPPING).to_numpy(dtype=int)
    X_scaled = scaler.transform(X)
    predictions = model.predict(X_scaled)
    precision, recall, f1, support = precision_recall_fscore_support(
        y,
        predictions,
        labels=[0, 1],
        zero_division=0,
    )
    class_metrics = {} 
    for class_id, label_name in zip([0, 1], ["normal", "shoplifting"]):
        class_metrics[class_id] = {
            "label": label_name,
            "precision": float(precision[class_id]),
            "recall": float(recall[class_id]),
            "f1": float(f1[class_id]),
            "support": int(support[class_id]),
        }
    return {
        "accuracy": accuracy_score(y, predictions),
        "precision": precision_score(y, predictions, zero_division=0),
        "recall": recall_score(y, predictions, zero_division=0),
        "f1": f1_score(y, predictions, zero_division=0),
        "confusion_matrix": confusion_matrix(y, predictions, labels=[0, 1]).tolist(),
        "class_precision_recall_f1": class_metrics,
    }


def report():
    df = load_dataset()
    model, scaler = load_model_and_scaler()
    train_df, val_df, test_df = video_level_split(df)

    label_counts = df[["video_name", "label"]].drop_duplicates()["label"].value_counts()
    feature_counts = df.groupby("label").size()

    metrics = {
        "dataset": str(DATASET_PATH),
        "videos": {
            "total": int(df["video_name"].nunique()),
            "normal": int(label_counts.get("normal", 0)),
            "shoplifting": int(label_counts.get("shoplifting", 0)),
            "train": int(train_df["video_name"].nunique()),
            "validation": int(val_df["video_name"].nunique()),
            "test": int(test_df["video_name"].nunique()),
        },
        "features": {
            "normal": int(feature_counts.get("normal", 0)),
            "shoplifting": int(feature_counts.get("shoplifting", 0)),
            "expected_schema": BEHAVIOUR_FEATURE_COLUMNS,
        },
        "label_mapping": {
            "normal": BEHAVIOUR_TARGET_MAPPING["normal"],
            "shoplifting": BEHAVIOUR_TARGET_MAPPING["shoplifting"],
            "0": BEHAVIOUR_TARGET_LABELS[0],
            "1": BEHAVIOUR_TARGET_LABELS[1],
        },
        "model": type(model).__name__,
        "train": evaluate_split(model, scaler, train_df),
        "validation": evaluate_split(model, scaler, val_df),
        "test": evaluate_split(model, scaler, test_df),
    }

    print("====================================")
    print("VIRTUAL GUARD BEHAVIOUR MODEL V2")
    print("BASELINE EVALUATION")
    print("====================================")
    print(f"Dataset: {DATASET_PATH.name}")
    print(f"Original videos: {metrics['videos']['total']}")
    print(f"Train: {metrics['videos']['train']} videos")
    print(f"Validation: {metrics['videos']['validation']} videos")
    print(f"Test: {metrics['videos']['test']} videos")
    print(f"Features: {len(BEHAVIOUR_FEATURE_COLUMNS)}")
    print(f"Model: {metrics['model']}")
    print(f"Normal videos: {metrics['videos']['normal']}")
    print(f"Shoplifting videos: {metrics['videos']['shoplifting']}")
    print(f"Normal features: {metrics['features']['normal']}")
    print(f"Shoplifting features: {metrics['features']['shoplifting']}")
    print(f"Label mapping: normal -> {metrics['label_mapping']['normal']}, shoplifting -> {metrics['label_mapping']['shoplifting']}")
    print("\nTEST METRICS")
    for key in ["accuracy", "precision", "recall", "f1"]:
        print(f"{key.title()}: {metrics['test'][key] * 100:.2f}%")
    print(f"Confusion matrix: {metrics['test']['confusion_matrix']}")
    print("Class metrics:")
    for class_id, label_name in [(0, "normal"), (1, "shoplifting")]:
        class_metrics = metrics["test"]["class_precision_recall_f1"][class_id]
        print(
            f"  {label_name}: precision={class_metrics['precision']:.4f}, recall={class_metrics['recall']:.4f}, "
            f"f1={class_metrics['f1']:.4f}, support={class_metrics['support']}"
        )
    print("====================================")
    return metrics


if __name__ == "__main__":
    report()
