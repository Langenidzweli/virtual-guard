"""COCO body keypoints for visual evidence only; not classifier inputs."""
import math
from pathlib import Path

from app.vision.tracker import SimpleTracker

# Zero-based COCO 17-keypoint connections: face, arms, torso and legs.
SKELETON = ((0, 1), (0, 2), (1, 3), (2, 4), (5, 6), (5, 7),
            (7, 9), (6, 8), (8, 10), (5, 11), (6, 12), (11, 12),
            (11, 13), (13, 15), (12, 14), (14, 16))


class PoseEstimator:
    def __init__(self, model_path):
        from ultralytics import YOLO
        if not Path(model_path).is_file():
            raise FileNotFoundError(f'Pose weights missing: {model_path}')
        self.model = YOLO(str(model_path), task='pose')

    def detect(self, frame):
        poses = []
        for result in self.model(frame, conf=0.25, verbose=False):
            if result.keypoints is None:
                continue
            for box, points in zip(result.boxes, result.keypoints.data.cpu().tolist()):
                if len(points) == 17:
                    poses.append({'bbox': box.xyxy[0].tolist(), 'keypoints': points})
        return poses


def attach_poses(tracked, poses, threshold=0.3):
    """One-to-one best-overlap assignment; never attach to bags/products."""
    candidates = []
    overlap = SimpleTracker()._bbox_iou
    for i, detection in enumerate(tracked):
        if str(detection.get('class_name', '')).lower() not in {'person', 'people'}:
            continue
        for j, pose in enumerate(poses):
            score = overlap(detection.get('bbox'), pose['bbox'])
            if score >= threshold:
                candidates.append((score, i, j))
    used_tracks, used_poses = set(), set()
    for _, i, j in sorted(candidates, reverse=True):
        if i not in used_tracks and j not in used_poses:
            tracked[i]['keypoints'] = poses[j]['keypoints']
            used_tracks.add(i)
            used_poses.add(j)


def draw_pose(frame, points, threshold=0.5):
    import cv2
    if len(points) != 17:
        return
    height, width = frame.shape[:2]
    visible = {}
    for index, point in enumerate(points):
        if len(point) < 3 or not all(math.isfinite(v) for v in point[:3]):
            continue
        x, y, confidence = point[:3]
        if confidence >= threshold and 0 < x < width and 0 < y < height:
            visible[index] = (round(x), round(y))
    for a, b in SKELETON:
        if a in visible and b in visible:
            cv2.line(frame, visible[a], visible[b], (255, 220, 0), 2, cv2.LINE_AA)
    for point in visible.values():
        cv2.circle(frame, point, 3, (0, 150, 255), -1, cv2.LINE_AA)
