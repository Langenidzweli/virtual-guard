import asyncio
import tempfile
import unittest
from pathlib import Path
from uuid import uuid4
from unittest.mock import AsyncMock, patch
from fastapi import BackgroundTasks
from app.api import routes
from app.core.config import config


class JobAttemptTests(unittest.IsolatedAsyncioTestCase):
    async def test_duplicate_admission_schedules_once(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'clip.mp4'
            source.touch()
            job = routes.JobRequest(job_id=uuid4(), attempt_id=uuid4(), video_path=str(source))
            tasks = BackgroundTasks()
            try:
                await routes.analyze_video(job, tasks, config.API_KEY)
                await routes.analyze_video(job, tasks, config.API_KEY)
                self.assertEqual(len(tasks.tasks), 1)
            finally:
                routes.active_attempts.discard(job.attempt_id)

    async def test_heartbeat_runs_while_waiting_for_capacity_and_stops_after_completion(self):
        job = routes.JobRequest(job_id=uuid4(), attempt_id=uuid4(), video_path='unused.mp4')
        slots = asyncio.Semaphore(0)
        sent = asyncio.Event()
        async def progress(*args):
            sent.set()
        with patch.object(routes, 'analysis_slots', slots), \
             patch.object(routes, 'send_progress', AsyncMock(side_effect=progress)) as heartbeat, \
             patch.object(routes, '_process_video', AsyncMock()) as process:
            routes.active_attempts.add(job.attempt_id)
            task = asyncio.create_task(routes.process_video(job))
            await asyncio.wait_for(sent.wait(), 2)
            process.assert_not_awaited()
            self.assertIn(f'attemptId={job.attempt_id}', heartbeat.call_args.args[0])
            self.assertEqual(heartbeat.call_args.args[1], 'heartbeat')
            slots.release()
            await asyncio.wait_for(task, 2)
            process.assert_awaited_once_with(job)
            self.assertNotIn(job.attempt_id, routes.active_attempts)
