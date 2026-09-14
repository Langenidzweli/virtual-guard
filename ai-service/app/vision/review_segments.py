"""Experimental temporal suggestions; the clip-level prediction is unchanged."""
import math
import cv2
import numpy as np
from app.models.behaviour import BEHAVIOUR_FEATURE_COLUMNS, build_feature_vector_from_motions


def merge_windows(windows, duration, padding=3.0, gap=2.0):
    segments = []
    for start, end, confidence in sorted(windows):
        start, end = max(0.0, start - padding), min(duration, end + padding)
        if end <= start:
            continue
        if segments and start <= segments[-1]['end_seconds'] + gap:
            segments[-1]['end_seconds'] = max(segments[-1]['end_seconds'], end)
            segments[-1]['confidence'] = max(segments[-1]['confidence'], confidence)
        else:
            segments.append(dict(start_seconds=start, end_seconds=end, confidence=confidence))
    return segments


def find_review_segments(analyzer, video_path, window_seconds=10.0, step_seconds=5.0):
    """Sample once, classify overlapping windows, pad and merge positive windows.

    Uses the existing model on shorter inputs, so timestamps are suggestions,
    not validated action localization. Never changes the whole-clip result.
    """
    if window_seconds <= 0 or step_seconds <= 0:
        raise ValueError('Window and step must be positive')
    cap = cv2.VideoCapture(str(video_path))
    try:
        fps = cap.get(cv2.CAP_PROP_FPS)
        count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if not cap.isOpened() or not math.isfinite(fps) or fps <= 0 or count < 2:
            return []
        duration = count / fps
        frames, motions = [], []
        previous = None
        for index in range(0, count, 10):
            cap.set(cv2.CAP_PROP_POS_FRAMES, index)
            ok, frame = cap.read()
            if not ok:
                break
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            frames.append(index)
            if previous is not None:
                motions.append(float(np.mean(cv2.absdiff(gray, previous))))
            previous = gray
    finally:
        cap.release()
    if len(frames) < 3:
        return []
    frames = np.asarray(frames)
    windows = []
    for start in np.arange(0, duration, step_seconds):
        end = min(duration, start + window_seconds)
        indices = np.flatnonzero((frames >= start * fps) & (frames < end * fps))
        if len(indices) >= 3:
            values = motions[indices[0]:indices[-1]]
            features = build_feature_vector_from_motions(values, len(indices), max(1, round((end-start)*fps)))
            order = [BEHAVIOUR_FEATURE_COLUMNS.index(name) for name in analyzer.feature_columns]
            features = features[:, order]
            if np.isfinite(features).all():
                scaled = analyzer.scaler.transform(features)
                prediction = analyzer.model.predict(scaled)[0]
                confidence = float(np.max(analyzer.model.predict_proba(scaled)))
                if prediction == 1:
                    windows.append((float(start), float(end), confidence))
        if end >= duration:
            break
    # Bound payload without silently discarding later evidence: combine closest
    # intervals if an unusually long recording produces more than 100 segments.
    segments = merge_windows(windows, duration)
    while len(segments) > 100:
        index = min(range(len(segments)-1), key=lambda i: segments[i+1]['start_seconds']-segments[i]['end_seconds'])
        segments[index]['end_seconds'] = segments[index+1]['end_seconds']
        segments[index]['confidence'] = max(segments[index]['confidence'], segments[index+1]['confidence'])
        del segments[index+1]
    return segments
