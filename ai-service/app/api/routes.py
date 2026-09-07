from fastapi import APIRouter, HTTPException, BackgroundTasks, Header
from pydantic import BaseModel, ConfigDict
import logging
import subprocess
from pathlib import Path
from uuid import UUID
import httpx
import asyncio
from app.models.behaviour import BehaviourAnalyzer
from app.vision.video_pipeline import process_video_pipeline
from app.vision.evidence import compact_detections
from app.core.config import config

router = APIRouter()
logger = logging.getLogger(__name__)

# Load the behaviour model once when the service starts.
behaviour_analyzer = BehaviourAnalyzer()
analysis_slots = asyncio.Semaphore(config.MAX_CONCURRENT_ANALYSES)

class JobRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    job_id: UUID
    video_path: str

class ConvertRequest(BaseModel):
    video_path: str

class ConvertResponse(BaseModel):
    video_path: str

@router.post("/analyze")
async def analyze_video(
    job: JobRequest,
    background_tasks: BackgroundTasks,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
):
    verify_api_key(x_api_key)
    if not Path(job.video_path).is_file():
        raise HTTPException(status_code=404, detail=f"Video not found: {job.video_path}")
    
    background_tasks.add_task(process_video, job)
    return {"status": "accepted", "job_id": job.job_id}

@router.post("/convert", response_model=ConvertResponse)
async def convert_video(
    video: ConvertRequest,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
):
    verify_api_key(x_api_key)
    source = Path(video.video_path)
    if not source.is_file():
        raise HTTPException(status_code=404, detail=f"Video not found: {source}")

    output = source.with_name(f"{source.stem}_browser.mp4")
    if output.exists():
        return ConvertResponse(video_path=str(output))
    temporary_output = source.with_name(f"{source.stem}_browser.part.mp4")

    try:
        from imageio_ffmpeg import get_ffmpeg_exe
        temporary_output.unlink(missing_ok=True)
        await asyncio.to_thread(
            subprocess.run,
            [get_ffmpeg_exe(), "-y", "-i", str(source), "-c:v", "libx264",
             "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart",
             str(temporary_output)],
            check=True,
            capture_output=True,
            text=True,
        )
        temporary_output.replace(output)
    except (ImportError, OSError, subprocess.CalledProcessError) as error:
        temporary_output.unlink(missing_ok=True)
        detail = error.stderr[-1000:] if isinstance(error, subprocess.CalledProcessError) else str(error)
        raise HTTPException(status_code=500, detail=f"Video conversion failed: {detail}") from error

    return ConvertResponse(video_path=str(output))


def verify_api_key(provided_api_key: str | None):
    import secrets

    if not provided_api_key or not secrets.compare_digest(provided_api_key, config.API_KEY):
        raise HTTPException(status_code=403, detail="Invalid internal API key")

async def process_video(job: JobRequest):
    async with analysis_slots:
        await _process_video(job)


async def _process_video(job: JobRequest):
    backend_base_url = config.SPRING_BOOT_URL.rstrip("/")
    job_url = f"{backend_base_url}/internal/jobs/{job.job_id}"
    progress_url = f"{job_url}/progress"
    callback_url = f"{job_url}/callback"
    try:
        await send_progress(progress_url, "validating-video", 10)

        source_path = Path(job.video_path)
        output_path = source_path.with_name(f"{source_path.stem}_annotated.mp4")

        await send_progress(progress_url, "vision-analysis", 20)
        vision_result = await asyncio.to_thread(
            process_video_pipeline,
            str(source_path),
            output_path=str(output_path),
            confidence_threshold=0.25,
            analysis_fps=config.VISION_ANALYSIS_FPS,
        )
        if not vision_result.get("success", False):
            raise RuntimeError(vision_result.get("error", "Vision pipeline failed"))

        # Analyse video with behaviour model
        await send_progress(progress_url, "behaviour-analysis", 80)
        result = await asyncio.to_thread(behaviour_analyzer.predict, job.video_path)
        if result.get("error"):
            raise RuntimeError(f"Behaviour analysis failed: {result['error']}")

        detections, detection_summary = compact_detections(vision_result.get("detections", {}))

        callback_payload = {
            "behaviour": result.get('behaviour', 'unknown'),
            "confidence": result.get('confidence', 0),
            "suspicion_score": result.get('suspicion_score', 0),
            "detections": detections,
            "detection_summary": detection_summary,
            "annotated_video_path": str(output_path),
            "vision_status": "completed",
        }

        await send_callback(callback_url, callback_payload)

        await send_progress(progress_url, "complete", 100)

    except Exception:
        logger.exception("Video processing failed for job %s", job.job_id)
        await send_progress(progress_url, "failed", 0)

async def send_progress(progress_url: str, stage: str, progress: int):
    for attempt in range(2):
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    progress_url,
                    json={"stage": stage, "progress": progress},
                    headers={"X-API-Key": config.API_KEY}
                )
                response.raise_for_status()
            return
        except httpx.HTTPError:
            if attempt == 1:
                logger.warning("Failed to send job progress to %s", progress_url, exc_info=True)
                return
            await asyncio.sleep(0.5)

async def send_callback(callback_url: str, result: dict):
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    callback_url,
                    json=result,
                    headers={"X-API-Key": config.API_KEY}
                )
                response.raise_for_status()
            return
        except httpx.HTTPError:
            if attempt == 2:
                raise
            logger.warning("Callback attempt %s failed for %s", attempt + 1, callback_url)
            await asyncio.sleep(2 ** attempt)
