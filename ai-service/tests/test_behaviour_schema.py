import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import cv2
import joblib
import numpy as np
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import config
from app.models.behaviour import BehaviourAnalyzer, BEHAVIOUR_FEATURE_COLUMNS
from app.vision.detector import YOLODetector
from app.vision.dataset_validator import validate_mall_dataset
from app.vision.tracker import SimpleTracker
from app.vision.video_pipeline import process_video_pipeline


class BehaviourSchemaTests(unittest.TestCase):
    @staticmethod
    def _write_synthetic_video(path, frames=30):
        writer = cv2.VideoWriter(
            str(path),
            cv2.VideoWriter_fourcc(*"mp4v"),
            15.0,
            (64, 64),
        )
        if not writer.isOpened():
            raise AssertionError("video writer could not be opened")

        for i in range(frames):
            frame = np.zeros((64, 64, 3), dtype=np.uint8)
            cx = 32 + int(10 * np.sin(i / 3.0))
            cy = 32 + int(8 * np.cos(i / 2.5))
            cv2.circle(frame, (cx, cy), 8, (255, 255, 255), -1)
            writer.write(frame)

        writer.release()

    def test_feature_schema_matches_saved_v2_model(self):
        model = joblib.load(os.path.join("models", "behaviour_model_v2.pkl"))
        scaler = joblib.load(os.path.join("models", "scaler_v2.pkl"))

        self.assertEqual(model.n_features_in_, 14)
        self.assertEqual(list(scaler.feature_names_in_), BEHAVIOUR_FEATURE_COLUMNS)
        self.assertEqual(len(BEHAVIOUR_FEATURE_COLUMNS), 14)

    def test_extract_features_from_video_returns_contract_shape(self):
        video_path = os.path.join("tests", "tmp_synthetic_motion.mp4")
        self._write_synthetic_video(video_path)

        try:
            analyzer = BehaviourAnalyzer(
                model_path=os.path.join("models", "behaviour_model_v2.pkl"),
                scaler_path=os.path.join("models", "scaler_v2.pkl"),
            )

            values = analyzer.extract_features_from_video(video_path)
            self.assertIsNotNone(values)
            self.assertEqual(values.shape, (1, 14))
            self.assertTrue(analyzer.validate_feature_vector(values))
            self.assertEqual(list(analyzer.get_feature_columns()), BEHAVIOUR_FEATURE_COLUMNS)
        finally:
            if os.path.exists(video_path):
                os.remove(video_path)

    def test_valid_feature_vector_predicts_without_schema_error(self):
        analyzer = BehaviourAnalyzer(
            model_path=os.path.join("models", "behaviour_model_v2.pkl"),
            scaler_path=os.path.join("models", "scaler_v2.pkl"),
        )
        feature_vector = np.random.default_rng(0).normal(size=(1, len(BEHAVIOUR_FEATURE_COLUMNS)))
        self.assertTrue(analyzer.validate_feature_vector(feature_vector))
        self.assertEqual(analyzer.scaler.transform(feature_vector).shape, (1, len(BEHAVIOUR_FEATURE_COLUMNS)))

    def test_analyze_endpoint_still_accepts_requests_and_uses_callbacks(self):
        client = TestClient(app)
        payload = {
            "job_id": "22222222-2222-2222-2222-222222222222",
            "video_path": os.path.join("tests", "tmp_synthetic_motion.mp4"),
        }

        self._write_synthetic_video(payload["video_path"])
        try:
            with patch("app.api.routes.behaviour_analyzer.predict", return_value={
                "behaviour": "normal",
                "confidence": 0.91,
                "suspicion_score": 12.5,
                "prediction": 0,
            }), patch("app.api.routes.send_progress", return_value=None), patch("app.api.routes.send_callback", return_value=None) as callback_mock:
                response = client.post("/analyze", json=payload, headers={"X-API-Key": config.API_KEY})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()["status"], "accepted")
                self.assertEqual(callback_mock.call_count, 1)
                self.assertEqual(
                    callback_mock.call_args.args[0],
                    f"{config.SPRING_BOOT_URL.rstrip('/')}/internal/jobs/22222222-2222-2222-2222-222222222222/callback",
                )
        finally:
            if os.path.exists(payload["video_path"]):
                os.remove(payload["video_path"])

    def test_analyze_endpoint_rejects_caller_controlled_callback_urls(self):
        client = TestClient(app)
        response = client.post("/analyze", json={
            "job_id": "44444444-4444-4444-4444-444444444444",
            "video_path": "missing.mp4",
            "callback_url": "https://attacker.invalid/callback",
            "progress_url": "https://attacker.invalid/progress",
        }, headers={"X-API-Key": config.API_KEY})

        self.assertEqual(response.status_code, 422)

    def test_analyze_endpoint_rejects_missing_internal_key(self):
        client = TestClient(app)
        response = client.post("/analyze", json={
            "job_id": "33333333-3333-3333-3333-333333333333",
            "video_path": "missing.mp4",
        })
        self.assertEqual(response.status_code, 403)

    def test_yolo_model_loads(self):
        detector = YOLODetector()
        self.assertIsNotNone(detector.model)
        self.assertTrue(len(detector.model.names) >= 1)

    def test_mall_dataset_validates(self):
        report = validate_mall_dataset(os.path.join("datasets", "mall_surveillance"))
        self.assertTrue(report["valid"])
        self.assertEqual(report["train_images"], 1120)
        self.assertEqual(report["valid_images"], 239)
        self.assertEqual(report["test_images"], 239)
        self.assertIn("bag", report["class_names"])

    def test_vision_model_selection_supports_custom_detector_with_fallback(self):
        configured = __import__('app.core.config', fromlist=['config']).config
        self.assertTrue(hasattr(configured, 'VISION_MODEL'))
        self.assertTrue(hasattr(configured, 'BASE_MODEL_PATH'))
        self.assertIn(configured.VISION_MODEL, ('v1', 'v2', 'virtual_guard_mall_detector_v1', 'virtual_guard_mall_detector_v2'))
        self.assertTrue(os.path.isfile(configured.MODEL_PATH))

    def test_tracking_generates_ids(self):
        tracker = SimpleTracker()
        detections = [
            {"class_name": "person", "confidence": 0.91, "bbox": [0.2, 0.2, 0.6, 0.6]},
            {"class_name": "person", "confidence": 0.89, "bbox": [0.21, 0.21, 0.61, 0.61]},
        ]
        tracked = tracker.update(detections)
        self.assertTrue(len(tracked) == 1)
        self.assertIn("tracking_id", tracked[0])

    def test_video_pipeline_produces_annotated_output(self):
        source = os.path.join("tests", "tmp_vision_video.mp4")
        output = os.path.join("tests", "tmp_annotated_output.mp4")
        self._write_synthetic_video(source, frames=20)
        try:
            result = process_video_pipeline(source, output_path=output, confidence_threshold=0.25)
            self.assertTrue(result["success"])
            self.assertTrue(os.path.exists(result["annotated_video_path"]))
        finally:
            for path in [source, output]:
                if os.path.exists(path):
                    os.remove(path)


if __name__ == "__main__":
    unittest.main()
