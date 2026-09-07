import cv2
import subprocess
from pathlib import Path

from imageio_ffmpeg import get_ffmpeg_exe


class VideoAnnotator:
    def __init__(self):
        self.font = cv2.FONT_HERSHEY_SIMPLEX

    def annotate_frame(self, frame, detections):
        output = frame.copy()
        for detection in detections:
            bbox = detection.get("bbox")
            if not bbox:
                continue
            x1, y1, x2, y2 = [int(v) for v in bbox]
            color = (0, 255, 0)
            cv2.rectangle(output, (x1, y1), (x2, y2), color, 2)
            label = detection.get("label") or detection.get("class_name", "OBJECT")
            confidence = detection.get("confidence", 0.0)
            label_text = f"{label.upper()} {confidence:.2f}"
            cv2.putText(output, label_text, (x1, max(0, y1 - 10)), self.font, 0.5, color, 1, cv2.LINE_AA)
            tracking_id = detection.get("tracking_id")
            if tracking_id is not None:
                cv2.putText(output, f"ID {tracking_id}", (x1, max(0, y2 + 20)), self.font, 0.5, color, 1, cv2.LINE_AA)
        return output

    def write_annotated_video(self, source_path, output_path, detections_by_frame):
        output = Path(output_path)
        temporary_output = output.with_name(f"{output.stem}.annotating.mp4")
        temporary_output.unlink(missing_ok=True)
        cap = cv2.VideoCapture(source_path)
        if not cap.isOpened():
            raise RuntimeError(f"Unable to open source video: {source_path}")
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(str(temporary_output), fourcc, fps, (width, height))
        if not writer.isOpened():
            cap.release()
            raise RuntimeError(f"Unable to create output video: {temporary_output}")
        frame_index = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            annotated = self.annotate_frame(frame, detections_by_frame.get(frame_index, []))
            writer.write(annotated)
            frame_index += 1
        cap.release()
        writer.release()
        try:
            subprocess.run(
                [
                    get_ffmpeg_exe(), "-y",
                    "-i", str(temporary_output),
                    "-i", str(source_path),
                    "-map", "0:v:0", "-map", "1:a?",
                    "-c:v", "libx264", "-preset", "veryfast",
                    "-pix_fmt", "yuv420p", "-c:a", "aac",
                    "-movflags", "+faststart", "-shortest", str(output),
                ],
                check=True,
                capture_output=True,
                text=True,
            )
        except (OSError, subprocess.CalledProcessError) as error:
            detail = error.stderr[-1000:] if isinstance(error, subprocess.CalledProcessError) else str(error)
            raise RuntimeError(f"Unable to encode browser-compatible video: {detail}") from error
        finally:
            temporary_output.unlink(missing_ok=True)
        return str(output)
