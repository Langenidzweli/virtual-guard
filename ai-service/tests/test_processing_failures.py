import asyncio
import unittest
from uuid import UUID
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
import httpx

from app.api.routes import JobRequest, _process_video, send_callback
from app.core.config import config
from app.main import app


class ProcessingFailureTests(unittest.TestCase):
    def test_review_segments_are_delivered_and_failure_keeps_full_clip_result(self):
        job = JobRequest(attempt_id=UUID("22222222-2222-2222-2222-222222222222"), job_id=UUID("11111111-1111-1111-1111-111111111111"), video_path="input.mp4")
        expected = [{"start_seconds": 4.0, "end_seconds": 18.0, "confidence": .9}]
        for fails in (False, True):
            with (
                self.subTest(segment_failure=fails),
                patch("app.api.routes.process_video_pipeline", return_value={"success": True, "detections": {}}),
                patch("app.api.routes.behaviour_analyzer.predict", return_value={"behaviour": "shoplifting", "confidence": .9, "suspicion_score": 90}),
                patch("app.api.routes.find_review_segments", return_value=expected, side_effect=RuntimeError("segment failure") if fails else None),
                patch("app.api.routes.send_progress", new_callable=AsyncMock),
                patch("app.api.routes.send_callback", new_callable=AsyncMock) as callback,
                patch("app.api.routes.logger.exception"),
            ):
                asyncio.run(_process_video(job))
                payload = callback.await_args.args[1]
                self.assertEqual(payload['review_segments'], [] if fails else expected)
                self.assertEqual(payload['behaviour'], 'shoplifting')
                self.assertEqual(payload['suspicion_score'], 90)

    def test_final_callback_retries_transient_network_failures(self):
        class RetryClient:
            attempts = 0

            def __init__(self, **_kwargs):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *_args):
                return False

            async def post(self, url, **_kwargs):
                RetryClient.attempts += 1
                request = httpx.Request("POST", url)
                if RetryClient.attempts < 3:
                    raise httpx.ConnectError("temporary outage", request=request)
                return httpx.Response(200, request=request)

        with (
            patch("app.api.routes.httpx.AsyncClient", RetryClient),
            patch("app.api.routes.asyncio.sleep", new_callable=AsyncMock),
        ):
            asyncio.run(send_callback("https://example.invalid/callback", {"ok": True}))

        self.assertEqual(RetryClient.attempts, 3)

    def test_health_is_degraded_when_behaviour_model_is_unavailable(self):
        with (
            patch("app.api.routes.behaviour_analyzer.model", None),
            patch("app.api.routes.behaviour_analyzer.scaler", None),
        ):
            response = TestClient(app).get("/health")

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["status"], "degraded")

    def test_health_is_healthy_when_behaviour_model_is_ready(self):
        with (
            patch("app.api.routes.behaviour_analyzer.model", object()),
            patch("app.api.routes.behaviour_analyzer.scaler", object()),
        ):
            response = TestClient(app).get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "healthy")

    def test_behaviour_model_failure_marks_job_failed_without_callback(self):
        job = JobRequest(
            attempt_id=UUID("22222222-2222-2222-2222-222222222222"), job_id=UUID("11111111-1111-1111-1111-111111111111"),
            video_path="input.mp4",
        )
        vision_result = {
            "success": True,
            "detections": {},
        }

        with self.assertLogs("app.api.routes", level="ERROR"):
            with (
                patch("app.api.routes.process_video_pipeline", return_value=vision_result),
                patch("app.api.routes.behaviour_analyzer.predict", return_value={"error": "Model not loaded"}),
                patch("app.api.routes.send_progress", new_callable=AsyncMock) as progress,
                patch("app.api.routes.send_callback", new_callable=AsyncMock) as callback,
            ):
                asyncio.run(_process_video(job))

        callback.assert_not_awaited()
        self.assertEqual(
            progress.await_args_list[-1].args,
            (
                f"{config.SPRING_BOOT_URL.rstrip('/')}/internal/jobs/{job.job_id}/progress?attemptId={job.attempt_id}",
                "failed",
                0,
            ),
        )


if __name__ == "__main__":
    unittest.main()
