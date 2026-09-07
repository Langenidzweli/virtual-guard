package com.virtualguard.backend.controller;

import com.virtualguard.backend.dto.JobProgressResponse;
import com.virtualguard.backend.dto.JobResponse;
import com.virtualguard.backend.entity.ProcessingJob;
import com.virtualguard.backend.service.JobService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/jobs")
@RequiredArgsConstructor
@Slf4j
public class JobController {

    private final JobService jobService;

    @PostMapping
    public ResponseEntity<JobResponse> submitJob(
            @RequestParam("cameraId") String cameraId,
            @RequestParam("file") MultipartFile file) {

        log.info("Video job submitted for camera {} ({} bytes)", cameraId, file.getSize());

        ProcessingJob job = jobService.submitJob(cameraId, file);
        return ResponseEntity.accepted().body(
                new JobResponse(job.getId(), "QUEUED", job.getVideoFilePath()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<JobProgressResponse> getJobProgress(@PathVariable UUID id) {
        JobProgressResponse progress = jobService.getJobProgress(id);
        return ResponseEntity.ok(progress);
    }

    @PostMapping("/{id}/start")
    public ResponseEntity<Void> startJob(@PathVariable UUID id) {
        jobService.startJob(id);
        return ResponseEntity.accepted().build();
    }

    @GetMapping
    public ResponseEntity<List<JobProgressResponse>> getAllJobs() {
        List<ProcessingJob> jobs = jobService.getAllJobs();
        List<JobProgressResponse> responses = jobs.stream()
                .map(job -> new JobProgressResponse(
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
                        job.getCreatedAt()))
                .collect(Collectors.toList());
        return ResponseEntity.ok(responses);
    }
}
