package com.virtualguard.backend.service;

import com.virtualguard.backend.dto.JobProgressResponse;
import com.virtualguard.backend.exception.ResourceNotFoundException;
import com.virtualguard.backend.entity.Camera;
import com.virtualguard.backend.entity.ProcessingJob;
import com.virtualguard.backend.enums.JobStatus;
import com.virtualguard.backend.repository.CameraRepository;
import com.virtualguard.backend.repository.ProcessingJobRepository;
import com.virtualguard.backend.storage.FileStorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import org.springframework.web.multipart.MultipartFile;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Sort;

@Service
@RequiredArgsConstructor
@Slf4j
public class JobService {

    private final ProcessingJobRepository jobRepository;
    private final CameraRepository cameraRepository;
    private final FileStorageService fileStorageService;
    private final JobLifecycle lifecycle;
    private final RestClient.Builder restClientBuilder;

    @Value("${app.fastapi.base-url:http://localhost:8000}")
    private String fastApiBaseUrl;

    @Value("${app.fastapi.api-key}")
    private String apiKey;

    @Transactional
    public ProcessingJob submitJob(String cameraId, MultipartFile file) {
        Camera camera = cameraRepository.findById(cameraId)
                .orElseThrow(() -> new ResourceNotFoundException("Camera not found: " + cameraId));

        if (!camera.isMonitored()) throw new IllegalStateException("Monitoring is disabled for this camera");
        String filename = fileStorageService.storeFile(file);
        try {
            ConvertResponse converted = restClientBuilder.build().post()
                    .uri(fastApiBaseUrl + "/convert")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("X-API-Key", apiKey)
                    .body(new ConvertRequest(fileStorageService.resolvePath(filename)))
                    .retrieve()
                    .body(ConvertResponse.class);
            if (converted != null && converted.videoPath() != null) {
                filename = com.virtualguard.backend.storage.MediaFilename.fromPath(converted.videoPath());
            }
        } catch (RuntimeException exception) {
            log.warn("Video conversion unavailable for {}; keeping original upload", filename, exception);
        }

        ProcessingJob job = new ProcessingJob();
        job.setCamera(camera);
        job.setVideoFilePath(filename);
        job.setStatus(JobStatus.QUEUED);
        job.setProgressPercent(0);
        job.setCurrentStage("queued");

        return jobRepository.save(job);
    }

    private record ConvertRequest(String video_path) {
    }

    private record ConvertResponse(@JsonProperty("video_path") String videoPath) {
    }

    public JobProgressResponse getJobProgress(UUID jobId) {
        ProcessingJob job = jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found: " + jobId));

        return new JobProgressResponse(
                job.getId(),
                job.getStatus().name(),
                job.getCurrentStage(),
                job.getProgressPercent(),
                job.getSuspicionScore(),
                job.getConfidence(),
                job.getBehaviour(),
                job.getAnnotatedVideoFilePath(),
                job.getCamera().getId(),
                job.getVideoFilePath(),
                job.getCreatedAt(), job.getFailureReason(), job.getAttemptCount());
    }

    public List<ProcessingJob> getAllJobs() {
        return jobRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt"));
    }

    public void startJob(UUID jobId) {
        var claim = lifecycle.claim(jobId);
        if (claim == null) return;
        try {
            restClientBuilder.build().post().uri(fastApiBaseUrl + "/analyze")
                .contentType(MediaType.APPLICATION_JSON).header("X-API-Key", apiKey)
                .body(new AiJobRequest(claim.jobId().toString(), claim.attemptId().toString(),
                        fileStorageService.resolvePath(claim.filename())))
                .retrieve().toBodilessEntity();
        } catch (RuntimeException exception) {
            lifecycle.fail(jobId, claim.attemptId(), "Unable to reach AI analysis service. Retry analysis.");
            throw new IllegalStateException("Unable to start AI analysis. The job is marked failed and can be retried.");
        }
    }
    private record AiJobRequest(String job_id, String attempt_id, String video_path) {}
}
