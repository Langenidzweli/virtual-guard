import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

import cv2
import numpy as np
from app.models.behaviour import BEHAVIOUR_FEATURE_COLUMNS
from app.vision.review_segments import find_review_segments, merge_windows


class IdentityScaler:
    def transform(self, values):
        assert values.shape == (1, 14)
        assert np.isfinite(values).all()
        return values


class MotionClassifier:
    def predict(self, values):
        return np.array([int(values[0, 0] > 10)])

    def predict_proba(self, values):
        return np.array([[0.1, 0.9]])


class ReviewSegmentsTest(unittest.TestCase):
    def test_padding_merging_and_duration_clipping(self):
        self.assertEqual(merge_windows([(0, 10, .8), (10, 20, .9), (40, 50, .7)], 51), [
            dict(start_seconds=0.0, end_seconds=23.0, confidence=.9),
            dict(start_seconds=37.0, end_seconds=51, confidence=.7),
        ])

    def test_empty_windows_do_not_invent_a_segment(self):
        self.assertEqual(merge_windows([], 30), [])

    def test_nested_windows_do_not_shorten_evidence(self):
        self.assertEqual(merge_windows([(0, 20, .8), (5, 10, .9)], 30)[0]['end_seconds'], 23)

    def test_window_localization_on_synthetic_video(self):
        analyzer = SimpleNamespace(feature_columns=BEHAVIOUR_FEATURE_COLUMNS,
                                   scaler=IdentityScaler(), model=MotionClassifier())
        with tempfile.TemporaryDirectory() as directory:
            path = str(Path(directory) / 'motion.avi')
            writer = cv2.VideoWriter(path, cv2.VideoWriter_fourcc(*'MJPG'), 10, (32, 32))
            self.assertTrue(writer.isOpened())
            for frame in range(400):
                # Motion only around seconds 15–24; static footage elsewhere.
                value = 255 if 150 <= frame < 250 and (frame // 10) % 2 else 0
                writer.write(np.full((32, 32, 3), value, dtype=np.uint8))
            writer.release()
            segments = find_review_segments(analyzer, path)
            self.assertEqual(len(segments), 1)
            self.assertGreater(segments[0]['start_seconds'], 0)
            self.assertLess(segments[0]['end_seconds'], 40)
            self.assertLessEqual(segments[0]['start_seconds'], 15)
            self.assertGreaterEqual(segments[0]['end_seconds'], 25)

    def test_short_or_missing_video_has_no_suggestions(self):
        self.assertEqual(find_review_segments(None, 'missing-review-video.mp4'), [])


if __name__ == '__main__':
    unittest.main()
