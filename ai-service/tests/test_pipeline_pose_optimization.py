import unittest
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch
import numpy as np

from app.vision.video_pipeline import process_video_pipeline


class PipelinePoseOptimizationTests(unittest.TestCase):
    def test_pose_runs_for_people_and_tracking_stays_per_video(self):
        frame = np.zeros((16, 16, 3), dtype=np.uint8)
        frames = [[{'class_name': name, 'bbox': [0, 0, 10, 10]}]
                  for name in ['bag', 'person', 'people']]
        with (
            tempfile.TemporaryDirectory() as temp,
            patch('app.vision.video_pipeline.os.path.exists', return_value=True),
            patch('app.vision.video_pipeline.config.POSE_ENABLED', True),
            patch('app.vision.video_pipeline.YOLODetector') as detector,
            patch('app.vision.video_pipeline.PoseEstimator') as pose,
            patch('app.vision.video_pipeline.SimpleTracker') as tracker,
            patch('app.vision.video_pipeline.VideoAnnotator'),
            patch('app.vision.video_pipeline.cv2.VideoCapture') as capture,
            patch('app.vision.video_pipeline.attach_poses') as attach,
        ):
            capture.return_value.get.return_value = 5
            tracker.side_effect = lambda: MagicMock(update=lambda detections: detections)
            for _ in range(2):
                capture.return_value.read.side_effect = [(True, frame)] * 3 + [(False, None)]
                detector.return_value.detect_frame.side_effect = frames
                result = process_video_pipeline(str(Path(temp) / 'input.mp4'), str(Path(temp) / 'output.mp4'))
                self.assertTrue(result['success'])
                self.assertEqual(result['analyzed_frame_count'], 3)
                self.assertEqual(result['frame_count'], 3)
            self.assertEqual(pose.return_value.detect.call_count, 4)
            self.assertEqual(attach.call_count, 4)
            self.assertEqual(tracker.call_count, 2)
