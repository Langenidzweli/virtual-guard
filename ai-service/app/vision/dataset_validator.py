from __future__ import annotations

import ast
import math
from pathlib import Path


SUPPORTED_IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png"}


def _read_class_names(data_yaml_path):
    try:
        with open(data_yaml_path, "r", encoding="utf-8") as handle:
            lines = handle.read().splitlines()
        names = []
        for line in lines:
            stripped = line.strip()
            if stripped.startswith("names:"):
                rest = stripped[len("names:"):].strip()
                if rest:
                    parsed = ast.literal_eval(rest)
                    if isinstance(parsed, (list, tuple)):
                        names = [str(item) for item in parsed]
                    break
        if names:
            return names
    except Exception:
        pass
    return []


def _validate_label_file(label_path, class_count):
    for line_number, line in enumerate(label_path.read_text(encoding="utf-8").splitlines(), start=1):
        values = line.split()
        if len(values) != 5:
            return f"line {line_number} must contain 5 values"
        try:
            class_value = float(values[0])
            coordinates = [float(value) for value in values[1:]]
        except ValueError:
            return f"line {line_number} contains a non-numeric value"
        if not class_value.is_integer():
            return f"line {line_number} class ID must be an integer"
        class_id = int(class_value)
        if class_id < 0 or (class_count and class_id >= class_count):
            return f"line {line_number} class ID {class_id} is out of range"
        if not all(math.isfinite(value) for value in coordinates):
            return f"line {line_number} contains a non-finite coordinate"
        x_center, y_center, width, height = coordinates
        if not all(0.0 <= value <= 1.0 for value in coordinates):
            return f"line {line_number} coordinates must be between 0 and 1"
        if width == 0.0 or height == 0.0:
            return f"line {line_number} width and height must be greater than 0"
    return None


def validate_mall_dataset(dataset_root):
    base = Path(dataset_root)
    report = {
        "dataset_root": str(base),
        "valid": True,
        "issues": [],
        "class_names": [],
        "train_images": 0,
        "valid_images": 0,
        "test_images": 0,
        "train_labels": 0,
        "valid_labels": 0,
        "test_labels": 0,
        "missing_labels": 0,
        "empty_labels": 0,
        "invalid_labels": 0,
    }

    data_yaml = base / "data.yaml"
    report["class_names"] = _read_class_names(str(data_yaml))
    if not data_yaml.is_file():
        report["valid"] = False
        report["issues"].append("Missing data.yaml")
    elif not report["class_names"]:
        report["valid"] = False
        report["issues"].append("data.yaml does not define a readable class-name list")

    for split in ["train", "valid", "test"]:
        img_dir = base / split / "images"
        lbl_dir = base / split / "labels"
        if not img_dir.exists() or not lbl_dir.exists():
            report["valid"] = False
            report["issues"].append(f"Missing directory for split: {split}")
            continue
        images = sorted(
            path for path in img_dir.iterdir()
            if path.is_file() and path.suffix.lower() in SUPPORTED_IMAGE_SUFFIXES
        )
        labels = sorted(path for path in lbl_dir.glob("*.txt") if path.is_file())
        report[f"{split}_images"] = len(images)
        report[f"{split}_labels"] = len(labels)
        for image_path in images:
            label_path = lbl_dir / f"{image_path.stem}.txt"
            if not label_path.exists():
                report["missing_labels"] += 1
                report["issues"].append(f"Missing label for {image_path.name}")
                report["valid"] = False
                continue
            if label_path.stat().st_size == 0:
                report["empty_labels"] += 1
                report["valid"] = False
                report["issues"].append(f"Empty label for {image_path.name}")
                continue
            label_error = _validate_label_file(label_path, len(report["class_names"]))
            if label_error:
                report["invalid_labels"] += 1
                report["valid"] = False
                report["issues"].append(f"Invalid label {label_path.name}: {label_error}")

    if report["class_names"]:
        report["class_names"] = [name.strip() for name in report["class_names"] if name.strip()]
    return report
