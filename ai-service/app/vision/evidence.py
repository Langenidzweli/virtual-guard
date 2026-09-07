from collections import Counter


def compact_detections(detections_by_frame, max_records=500):
    """Return bounded, timeline-distributed detection evidence and summary counts."""
    if max_records < 1:
        raise ValueError("max_records must be at least 1")

    records = []
    class_counts = Counter()
    for frame_index, frame_detections in sorted(detections_by_frame.items()):
        for detection in frame_detections:
            class_name = str(detection.get("class_name", "OBJECT"))
            class_counts[class_name] += 1
            records.append({
                "frame": int(frame_index),
                "class_name": class_name,
                "confidence": float(detection.get("confidence", 0.0)),
                "tracking_id": detection.get("tracking_id"),
                "bbox": [float(value) for value in detection.get("bbox", [0, 0, 0, 0])],
            })

    total = len(records)
    if total > max_records:
        if max_records == 1:
            records = [records[0]]
        else:
            records = [
                records[round(index * (total - 1) / (max_records - 1))]
                for index in range(max_records)
            ]

    summary = {
        "totalDetections": total,
        "returnedDetections": len(records),
        **{f"class:{name}": count for name, count in sorted(class_counts.items())},
    }
    return records, summary
