import os
import logging
from pathlib import Path

import cv2

from app.core.config import config

logger = logging.getLogger(__name__)

try:
    from ultralytics import YOLO
except Exception:  # pragma: no cover
    YOLO = None


class YOLODetector:
    def __init__(self, model_path=None, confidence_threshold=None):
        self.model_path = model_path or config.MODEL_PATH
        self.confidence_threshold = confidence_threshold if confidence_threshold is not None else config.CONFIDENCE_THRESHOLD
        self.model = None
        self.load_model()

    def load_model(self):
        if YOLO is None:
            raise RuntimeError("ultralytics is not available")

        candidate_paths = [self.model_path]

        resolved_model_path = None
        for candidate in candidate_paths:
            resolved = str(Path(candidate).resolve()) if candidate else None
            if candidate and os.path.exists(candidate):
                resolved_model_path = candidate
                break
            if resolved and os.path.exists(resolved):
                resolved_model_path = resolved
                break

        if resolved_model_path is None:
            raise FileNotFoundError(f"Configured YOLO model does not exist: {self.model_path}")

        self.model = YOLO(resolved_model_path)
        logger.info("YOLO model loaded: %s", resolved_model_path)
        return self.model

    def detect_frame(self, frame, conf_threshold=None):
        if self.model is None:
            raise RuntimeError("YOLO model is not loaded")
        threshold = conf_threshold if conf_threshold is not None else self.confidence_threshold
        results = self.model(frame, verbose=False, conf=threshold)
        detections = []
        for result in results:
            for box in result.boxes:
                xyxy = box.xyxy[0].tolist()
                conf = float(box.conf[0])
                cls_id = int(box.cls[0])
                class_name = result.names.get(cls_id, str(cls_id))
                detections.append({
                    "class_id": cls_id,
                    "class_name": class_name,
                    "confidence": conf,
                    "bbox": [float(xyxy[0]), float(xyxy[1]), float(xyxy[2]), float(xyxy[3])],
                })
        return detections

    def detect_video(self, video_path, conf_threshold=None):
        if not os.path.exists(video_path):
            raise FileNotFoundError(video_path)
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise RuntimeError(f"Unable to open video: {video_path}")
        frames = []
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            frames.append(self.detect_frame(frame, conf_threshold=conf_threshold))
        cap.release()
        return frames
