import unittest
import numpy as np
from app.vision.pose import attach_poses, draw_pose


class PoseTests(unittest.TestCase):
    def test_matches_only_people_once(self):
        detections = [{'class_name': name, 'bbox': [0, 0, 100, 100]}
                      for name in ['bag', 'people', 'person']]
        attach_poses(detections, [{'bbox': [0, 0, 100, 100], 'keypoints': [[10, 10, .9]] * 17}])
        self.assertNotIn('keypoints', detections[0])
        self.assertEqual(sum('keypoints' in d for d in detections), 1)

    def test_does_not_match_distant_person(self):
        detections = [{'class_name': 'person', 'bbox': [0, 0, 20, 20]}]
        attach_poses(detections, [{'bbox': [100, 100, 120, 120], 'keypoints': []}])
        self.assertNotIn('keypoints', detections[0])

    def test_draws_confident_joints_without_mutating_input_points(self):
        frame = np.zeros((100, 100, 3), dtype=np.uint8)
        points = [[20 + i, 20 + i, .9] for i in range(17)]
        draw_pose(frame, points)
        self.assertGreater(frame.sum(), 0)
        self.assertEqual(points[0], [20, 20, .9])

    def test_ignores_uncertain_and_invalid_joints(self):
        frame = np.zeros((100, 100, 3), dtype=np.uint8)
        points = [[20, 20, .1]] * 15 + [[float('nan'), 20, .9], [0, 0, .9]]
        draw_pose(frame, points)
        self.assertEqual(frame.sum(), 0)
