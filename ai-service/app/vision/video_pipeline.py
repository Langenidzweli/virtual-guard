import os
from pathlib import Path

import cv2

from app.vision.annotator import VideoAnnotator
from app.vision.detector import YOLODetector
from app.vision.tracker import SimpleTracker


def process_video_pipeline(video_path, output_path=None, confidence_threshold=0.5, analysis_fps=5.0):
    if not os.path.exists(video_path):
        raise FileNotFoundError(video_path)
    detector = YOLODetector(confidence_threshold=confidence_threshold)
    tracker = SimpleTracker()
    annotator = VideoAnnotator()
    source = Path(video_path)
    output = Path(output_path) if output_path else source.with_name(f"{source.stem}_annotated.mp4")
    output.parent.mkdir(parents=True, exist_ok=True)
    cap = cv2.VideoCapture(str(source))
    if not cap.isOpened():
        raise RuntimeError(f"Unable to open video: {video_path}")

    source_fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    frame_stride = max(1, round(source_fps / max(1.0, analysis_fps)))
    detections_by_frame = {}
    frame_index = 0
    analyzed_frame_count = 0
    last_tracked = []
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_index % frame_stride == 0:
            detections = detector.detect_frame(frame, conf_threshold=confidence_threshold)
            last_tracked = tracker.update(detections)
            for detection in last_tracked:
                detection["label"] = detection.get("class_name", "OBJECT")
            analyzed_frame_count += 1
        detections_by_frame[frame_index] = [dict(detection) for detection in last_tracked]
        frame_index += 1
    cap.release()
    try:
        annotator.write_annotated_video(str(source), str(output), detections_by_frame)
        return {
            "success": True,
            "annotated_video_path": str(output),
            "frame_count": frame_index,
            "analyzed_frame_count": analyzed_frame_count,
            "frame_stride": frame_stride,
            "detections": detections_by_frame,
        }
    except Exception as exc:
        return {"success": False, "error": str(exc), "annotated_video_path": str(output)}
