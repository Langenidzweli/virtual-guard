from __future__ import annotations


class SimpleTracker:
    def __init__(self, match_iou_threshold=0.3, dedupe_iou_threshold=0.7, max_age=30):
        self._next_id = 1
        self._active = {}
        self._frame_index = 0
        self.match_iou_threshold = match_iou_threshold
        self.dedupe_iou_threshold = dedupe_iou_threshold
        self.max_age = max_age

    def _bbox_iou(self, a, b):
        if not a or not b:
            return 0.0
        ax1, ay1, ax2, ay2 = a
        bx1, by1, bx2, by2 = b
        intersection_width = max(0.0, min(ax2, bx2) - max(ax1, bx1))
        intersection_height = max(0.0, min(ay2, by2) - max(ay1, by1))
        intersection = intersection_width * intersection_height
        area_a = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
        area_b = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
        union = area_a + area_b - intersection
        return intersection / union if union > 0 else 0.0

    def update(self, detections):
        self._frame_index += 1
        self._active = {
            track_id: state
            for track_id, state in self._active.items()
            if self._frame_index - state["last_seen"] <= self.max_age
        }

        deduped = []
        for detection in detections:
            if not detection.get("bbox"):
                continue
            bbox = detection["bbox"]
            matched = False
            for existing in deduped:
                if detection.get("class_name") != existing.get("class_name"):
                    continue
                if self._bbox_iou(bbox, existing["bbox"]) >= self.dedupe_iou_threshold:
                    matched = True
                    if detection.get("confidence", 0.0) > existing.get("confidence", 0.0):
                        existing.update(detection)
                    break
            if not matched:
                deduped.append(dict(detection))

        tracked = []
        matched_track_ids = set()
        for detection in deduped:
            bbox = detection.get("bbox") or [0, 0, 0, 0]
            best_track_id = None
            best_iou = 0.0
            for track_id, state in self._active.items():
                if track_id in matched_track_ids:
                    continue
                if detection.get("class_name") != state["class_name"]:
                    continue
                iou = self._bbox_iou(bbox, state["bbox"])
                if iou > best_iou:
                    best_iou = iou
                    best_track_id = track_id
            if best_track_id is None or best_iou < self.match_iou_threshold:
                best_track_id = self._next_id
                self._next_id += 1
            self._active[best_track_id] = {
                "bbox": bbox,
                "class_name": detection.get("class_name"),
                "last_seen": self._frame_index,
            }
            matched_track_ids.add(best_track_id)
            entry = dict(detection)
            entry["tracking_id"] = best_track_id
            tracked.append(entry)
        return tracked
