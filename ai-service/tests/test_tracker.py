import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.vision.tracker import SimpleTracker


class SimpleTrackerTests(unittest.TestCase):
    def test_keeps_id_for_overlapping_pixel_boxes(self):
        tracker = SimpleTracker()
        first = tracker.update([{"class_name": "person", "confidence": 0.9, "bbox": [100, 100, 200, 300]}])
        second = tracker.update([{"class_name": "person", "confidence": 0.9, "bbox": [105, 102, 205, 302]}])
        self.assertEqual(first[0]["tracking_id"], second[0]["tracking_id"])

    def test_does_not_match_different_classes(self):
        tracker = SimpleTracker()
        person = tracker.update([{"class_name": "person", "confidence": 0.9, "bbox": [100, 100, 200, 300]}])
        bag = tracker.update([{"class_name": "bag", "confidence": 0.9, "bbox": [100, 100, 200, 300]}])
        self.assertNotEqual(person[0]["tracking_id"], bag[0]["tracking_id"])

    def test_deduplicates_highly_overlapping_same_class_boxes(self):
        tracker = SimpleTracker()
        tracked = tracker.update([
            {"class_name": "person", "confidence": 0.8, "bbox": [100, 100, 200, 300]},
            {"class_name": "person", "confidence": 0.9, "bbox": [101, 101, 201, 301]},
        ])
        self.assertEqual(1, len(tracked))
        self.assertEqual(0.9, tracked[0]["confidence"])

    def test_expires_stale_tracks(self):
        tracker = SimpleTracker(max_age=2)
        first = tracker.update([{"class_name": "person", "confidence": 0.9, "bbox": [100, 100, 200, 300]}])
        tracker.update([])
        tracker.update([])
        later = tracker.update([{"class_name": "person", "confidence": 0.9, "bbox": [100, 100, 200, 300]}])
        self.assertNotEqual(first[0]["tracking_id"], later[0]["tracking_id"])

    def test_assigns_each_track_at_most_once_per_frame(self):
        tracker = SimpleTracker(match_iou_threshold=0.2)
        tracker.update([{"class_name": "person", "confidence": 0.9, "bbox": [100, 100, 300, 300]}])
        tracked = tracker.update([
            {"class_name": "person", "confidence": 0.9, "bbox": [100, 100, 195, 300]},
            {"class_name": "person", "confidence": 0.9, "bbox": [205, 100, 300, 300]},
        ])
        self.assertEqual(2, len({item["tracking_id"] for item in tracked}))


if __name__ == "__main__":
    unittest.main()
