"""Resume the interrupted Virtual Guard YOLO training run."""

import shutil
from pathlib import Path

from ultralytics import YOLO


RUN_NAME = "virtual_guard_mall_detector_v2"
AI_SERVICE_ROOT = Path(__file__).resolve().parent
RUN_DIR = AI_SERVICE_ROOT / "runs" / "detect" / RUN_NAME
CHECKPOINT = RUN_DIR / "weights" / "last.pt"
BEST_CHECKPOINT = RUN_DIR / "weights" / "best.pt"
OUTPUT_MODEL = AI_SERVICE_ROOT / "models" / f"{RUN_NAME}.pt"


def main() -> None:
    if not CHECKPOINT.is_file():
        raise FileNotFoundError(f"Training checkpoint not found: {CHECKPOINT}")

    YOLO(str(CHECKPOINT)).train(resume=True)

    if not BEST_CHECKPOINT.is_file():
        raise FileNotFoundError(f"Best checkpoint not found after training: {BEST_CHECKPOINT}")

    OUTPUT_MODEL.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(BEST_CHECKPOINT, OUTPUT_MODEL)
    print(f"Exported best model to: {OUTPUT_MODEL}")


if __name__ == "__main__":
    main()
