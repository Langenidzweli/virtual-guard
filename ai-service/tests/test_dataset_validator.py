from pathlib import Path

from app.vision.dataset_validator import validate_mall_dataset


def _dataset(tmp_path: Path, label: str):
    (tmp_path / "data.yaml").write_text("names: ['bag', 'people']\n", encoding="utf-8")
    for split in ("train", "valid", "test"):
        image_dir = tmp_path / split / "images"
        label_dir = tmp_path / split / "labels"
        image_dir.mkdir(parents=True)
        label_dir.mkdir(parents=True)
        (image_dir / "frame.jpg").write_bytes(b"image bytes are not decoded by this validator")
        (label_dir / "frame.txt").write_text(label, encoding="utf-8")
    return tmp_path


def test_valid_yolo_labels_pass(tmp_path):
    report = validate_mall_dataset(_dataset(tmp_path, "1 0.5 0.5 0.25 0.4\n"))

    assert report["valid"] is True
    assert report["invalid_labels"] == 0
    assert report["train_images"] == 1
    assert report["class_names"] == ["bag", "people"]


def test_malformed_yolo_label_is_reported(tmp_path):
    report = validate_mall_dataset(_dataset(tmp_path, "2 0.5 0.5 0.25 0.4\n"))

    assert report["valid"] is False
    assert report["invalid_labels"] == 3
    assert any("class ID 2 is out of range" in issue for issue in report["issues"])


def test_non_image_files_are_not_counted_as_images(tmp_path):
    root = _dataset(tmp_path, "0 0.5 0.5 0.25 0.4\n")
    (root / "train" / "images" / "notes.txt").write_text("not an image", encoding="utf-8")

    report = validate_mall_dataset(root)

    assert report["valid"] is True
    assert report["train_images"] == 1


def test_missing_dataset_metadata_fails_closed(tmp_path):
    root = _dataset(tmp_path, "0 0.5 0.5 0.25 0.4\n")
    (root / "data.yaml").unlink()

    report = validate_mall_dataset(root)

    assert report["valid"] is False
    assert "Missing data.yaml" in report["issues"]
