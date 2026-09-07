import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.vision.evidence import compact_detections


class DetectionEvidenceTests(unittest.TestCase):
    def test_small_payload_is_preserved_and_summarized(self):
        records, summary = compact_detections({
            0: [{"class_name": "person", "confidence": 0.9, "tracking_id": 1, "bbox": [1, 2, 3, 4]}],
            1: [{"class_name": "bag", "confidence": 0.8, "tracking_id": 2, "bbox": [5, 6, 7, 8]}],
        })
        self.assertEqual(2, len(records))
        self.assertEqual(2, summary["totalDetections"])
        self.assertEqual(1, summary["class:person"])
        self.assertEqual(1, summary["class:bag"])

    def test_large_payload_is_bounded_across_timeline(self):
        source = {
            frame: [{"class_name": "person", "confidence": 0.9, "bbox": [1, 2, 3, 4]}]
            for frame in range(1000)
        }
        records, summary = compact_detections(source, max_records=100)
        self.assertEqual(100, len(records))
        self.assertEqual(1000, summary["totalDetections"])
        self.assertEqual(0, records[0]["frame"])
        self.assertEqual(999, records[-1]["frame"])

    def test_rejects_invalid_limit(self):
        with self.assertRaises(ValueError):
            compact_detections({}, max_records=0)


if __name__ == "__main__":
    unittest.main()
