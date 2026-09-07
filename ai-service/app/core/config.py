import os
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv()


def _resolve_model_path(model_name: str, fallback_name: str):
    project_root = Path(__file__).resolve().parents[2]
    models_dir = project_root / "models"
    custom_env = os.getenv("CUSTOM_MODEL_PATH")
    fallback_env = os.getenv("BASE_MODEL_PATH")

    if custom_env:
        custom_path = Path(custom_env).expanduser()
        if not custom_path.is_absolute():
            custom_path = project_root / custom_path
        if not custom_path.is_file():
            raise FileNotFoundError(f"CUSTOM_MODEL_PATH does not exist: {custom_path}")
        return str(custom_path.resolve())

    model_choices = {
        "v1": "virtual_guard_mall_detector_v1.pt",
        "v2": "virtual_guard_mall_detector_v2.pt",
        "base": fallback_name,
    }
    selection = model_name.strip()
    selected_name = model_choices.get(selection.lower(), selection)
    if not selected_name.lower().endswith(".pt"):
        selected_name += ".pt"
    if selection.lower() == "base" and fallback_env:
        selected_path = Path(fallback_env).expanduser()
        if not selected_path.is_absolute():
            selected_path = project_root / selected_path
    else:
        selected_path = models_dir / selected_name
    if not selected_path.is_file():
        raise FileNotFoundError(
            f"Configured vision model '{model_name}' does not exist: {selected_path}"
        )
    return str(selected_path.resolve())


class Config:
    SPRING_BOOT_URL = os.getenv("SPRING_BOOT_URL", "http://localhost:8090")
    VISION_MODEL = os.getenv("VISION_MODEL", "virtual_guard_mall_detector_v1")
    BASE_MODEL_PATH = os.getenv("BASE_MODEL_PATH", "./models/yolov8n.pt")
    CUSTOM_MODEL_PATH = os.getenv("CUSTOM_MODEL_PATH")
    MODEL_PATH = _resolve_model_path(VISION_MODEL, "yolov8n.pt")
    CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.5"))
    IOU_THRESHOLD = float(os.getenv("IOU_THRESHOLD", "0.45"))
    VISION_ANALYSIS_FPS = max(1.0, float(os.getenv("VISION_ANALYSIS_FPS", "5")))
    API_KEY = os.getenv("INTERNAL_API_KEY") or os.getenv("API_KEY")
    UPLOAD_DIR = os.getenv("UPLOAD_DIR", "../backend/uploads")
    MAX_CONCURRENT_ANALYSES = max(1, int(os.getenv("MAX_CONCURRENT_ANALYSES", "1")))


config = Config()

if not config.API_KEY:
    raise RuntimeError("INTERNAL_API_KEY must be configured")
