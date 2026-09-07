from pathlib import Path

import pytest

from app.core.config import _resolve_model_path
from app.vision import detector as detector_module


def test_default_v1_model_resolves_to_existing_file(monkeypatch):
    monkeypatch.delenv("CUSTOM_MODEL_PATH", raising=False)

    model_path = Path(_resolve_model_path("v1", "yolov8n.pt"))

    assert model_path.is_file()
    assert model_path.name == "virtual_guard_mall_detector_v1.pt"


def test_missing_named_model_fails_instead_of_falling_back(monkeypatch):
    monkeypatch.delenv("CUSTOM_MODEL_PATH", raising=False)

    with pytest.raises(FileNotFoundError, match="Configured vision model"):
        _resolve_model_path("model-that-does-not-exist", "yolov8n.pt")


def test_missing_custom_model_fails_instead_of_falling_back(monkeypatch):
    monkeypatch.setenv("CUSTOM_MODEL_PATH", "models/model-that-does-not-exist.pt")

    with pytest.raises(FileNotFoundError, match="CUSTOM_MODEL_PATH"):
        _resolve_model_path("v1", "yolov8n.pt")


def test_detector_does_not_fall_back_when_requested_model_is_missing(monkeypatch, tmp_path):
    monkeypatch.setattr(detector_module, "YOLO", lambda _path: object())

    with pytest.raises(FileNotFoundError, match="Configured YOLO model"):
        detector_module.YOLODetector(model_path=tmp_path / "missing.pt")
