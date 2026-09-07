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
import java.nio.file.Paths;
import org.springframework.data.domain.Sort;

@Service
@RequiredArgsConstructor
@Slf4j
public class JobService {

    private final ProcessingJobRepository jobRepository;
    private final CameraRepository cameraRepository;
    private final FileStorageService fileStorageService;
    private final IncidentService incidentService;
    private final RestClient.Builder restClientBuilder;

    @Value("${app.fastapi.base-url:http://localhost:8000}")
    private String fastApiBaseUrl;

    @Value("${app.fastapi.api-key}")
    private String apiKey;

    @Transactional
    public ProcessingJob submitJob(String cameraId, MultipartFile file) {
        Camera camera = cameraRepository.findById(cameraId)
                .orElseThrow(() -> new ResourceNotFoundException("Camera not found: " + cameraId));

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
                filename = Paths.get(converted.videoPath()).getFileName().toString();
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
                job.getCreatedAt());
    }

    public List<ProcessingJob> getAllJobs() {
        return jobRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt"));
    }

    @Transactional
    public void startJob(UUID jobId) {
        ProcessingJob job = jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found: " + jobId));

        if (job.getStatus() != JobStatus.QUEUED && job.getStatus() != JobStatus.FAILED) {
            throw new IllegalStateException("Only queued or failed jobs can be started");
        }

        job.setStatus(JobStatus.PROCESSING);
        job.setCurrentStage("extracting-frames");
        job.setProgressPercent(10);
        jobRepository.save(job);

        try {
            String videoPath = fileStorageService.resolvePath(job.getVideoFilePath());
            restClientBuilder.build().post()
                    .uri(fastApiBaseUrl + "/analyze")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("X-API-Key", apiKey)
                    .body(new AiJobRequest(
                            job.getId().toString(),
                            videoPath))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RuntimeException exception) {
            job.setStatus(JobStatus.FAILED);
            job.setCurrentStage("failed");
            job.setProgressPercent(0);
            jobRepository.save(job);
            throw new RuntimeException("Unable to start AI analysis", exception);
        }
    }

    @Transactional
    public void updateProgress(UUID jobId, String stage, int progress) {
        ProcessingJob job = jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found: " + jobId));

        if (job.getStatus() == JobStatus.COMPLETED) {
            return;
        }
        if ("failed".equalsIgnoreCase(stage)) {
            job.setStatus(JobStatus.FAILED);
            progress = 0;
        } else if (progress >= 100 || "complete".equalsIgnoreCase(stage)) {
            job.setStatus(JobStatus.COMPLETED);
            progress = 100;
        } else {
            job.setStatus(JobStatus.PROCESSING);
        }
        job.setCurrentStage(stage);
        job.setProgressPercent(progress);
        jobRepository.save(job);
    }

    @Transactional
    public void completeJob(UUID jobId, com.virtualguard.backend.dto.AiCallbackRequest result) {
        ProcessingJob job = jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found: " + jobId));
        job.setStatus(JobStatus.COMPLETED);
        job.setCurrentStage("complete");
        job.setProgressPercent(100);
        job.setBehaviour(result.behaviour());
        job.setSuspicionScore(result.suspicion_score());
        job.setConfidence(result.confidence());
        if (result.annotated_video_path() != null) {
            job.setAnnotatedVideoFilePath(Paths.get(result.annotated_video_path()).getFileName().toString());
        }
        ProcessingJob savedJob = jobRepository.save(job);
        incidentService.createFromAiResult(savedJob, result);
    }

    private record AiJobRequest(
            String job_id,
            String video_path) {
    }
}
