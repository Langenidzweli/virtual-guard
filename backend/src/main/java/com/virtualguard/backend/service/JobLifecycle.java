package com.virtualguard.backend.service;

import com.virtualguard.backend.entity.ProcessingJob;
import com.virtualguard.backend.enums.JobStatus;
import com.virtualguard.backend.dto.AiCallbackRequest;
import com.virtualguard.backend.repository.ProcessingJobRepository;
import com.virtualguard.backend.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class JobLifecycle {
    private final ProcessingJobRepository jobs;
    private final IncidentService incidents;

    public record Claim(UUID jobId, UUID attemptId, String filename) {}

    @Transactional
    public Claim claim(UUID id) {
        ProcessingJob job = lock(id);
        if (job.getStatus() == JobStatus.PROCESSING || job.getStatus() == JobStatus.COMPLETED) return null;
        if (!job.getCamera().isMonitored()) throw new IllegalStateException("Monitoring is disabled for this camera");
        job.setStatus(JobStatus.PROCESSING);
        job.setAttemptId(UUID.randomUUID());
        job.setAttemptCount(job.getAttemptCount() + 1);
        job.setStartedAt(LocalDateTime.now());
        job.setHeartbeatAt(LocalDateTime.now());
        job.setFailureReason(null);
        job.setCurrentStage("queued");
        job.setProgressPercent(0);
        jobs.save(job);
        return new Claim(id, job.getAttemptId(), job.getVideoFilePath());
    }

    @Transactional
    public void fail(UUID id, UUID attempt, String reason) {
        ProcessingJob job = lock(id);
        if (job.getStatus() != JobStatus.PROCESSING || !java.util.Objects.equals(attempt, job.getAttemptId())) return;
        markFailed(job, reason);
    }

    private void markFailed(ProcessingJob job, String reason) {
        job.setStatus(JobStatus.FAILED);
        job.setCurrentStage("failed");
        job.setProgressPercent(0);
        job.setFailureReason(reason == null ? "Analysis failed" : reason.substring(0, Math.min(250, reason.length())));
        jobs.save(job);
    }

    @Transactional
    public void progress(UUID id, UUID attempt, String stage, int percent, String reason) {
        ProcessingJob job = lock(id);
        checkAttempt(job, attempt);
        if (job.getStatus() != JobStatus.PROCESSING) return;
        job.setHeartbeatAt(LocalDateTime.now());
        if ("failed".equals(stage)) { markFailed(job, reason); return; }
        // Only a validated final callback can complete a job.
        if (!"heartbeat".equals(stage) && !"complete".equals(stage) && percent >= job.getProgressPercent()) {
            job.setCurrentStage(stage);
            job.setProgressPercent(Math.min(99, percent));
        }
        jobs.save(job);
    }

    @Transactional
    public void complete(UUID id, UUID attempt, AiCallbackRequest result) {
        ProcessingJob job = lock(id);
        checkAttempt(job, attempt);
        if (job.getStatus() == JobStatus.COMPLETED) return;
        if (job.getStatus() != JobStatus.PROCESSING) throw new IllegalStateException("Analysis attempt is no longer active");
        job.setStatus(JobStatus.COMPLETED);
        job.setCurrentStage("complete");
        job.setProgressPercent(100);
        job.setBehaviour(result.behaviour());
        job.setConfidence(result.confidence());
        job.setSuspicionScore(result.suspicion_score());
        job.setFailureReason(null);
        if (result.annotated_video_path() != null)
            job.setAnnotatedVideoFilePath(com.virtualguard.backend.storage.MediaFilename.fromPath(result.annotated_video_path()));
        jobs.save(job);
        // The job lock serializes duplicate callbacks before the incident existence check.
        incidents.createFromAiResult(job, result);
    }

    @Transactional
    public void expire(UUID id, LocalDateTime leaseCutoff, LocalDateTime durationCutoff) {
        ProcessingJob job = lock(id);
        if (job.getStatus() == JobStatus.PROCESSING &&
                (job.getHeartbeatAt() == null || job.getHeartbeatAt().isBefore(leaseCutoff)
                || job.getStartedAt() == null || job.getStartedAt().isBefore(durationCutoff)))
            markFailed(job, "Analysis stopped responding or exceeded its time limit. Retry analysis.");
    }

    private ProcessingJob lock(UUID id) {
        return jobs.lockById(id).orElseThrow(() -> new ResourceNotFoundException("Job not found: " + id));
    }
    private void checkAttempt(ProcessingJob job, UUID attempt) {
        if (attempt == null || !attempt.equals(job.getAttemptId()))
            throw new IllegalStateException("Stale analysis attempt");
    }
}
