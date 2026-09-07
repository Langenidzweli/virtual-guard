package com.virtualguard.backend.controller;

import com.virtualguard.backend.dto.AiCallbackRequest;
import com.virtualguard.backend.dto.AiProgressRequest;
import com.virtualguard.backend.service.JobService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/internal/jobs")
@RequiredArgsConstructor
public class InternalJobController {

    private final JobService jobService;

    @PostMapping("/{id}/progress")
    public ResponseEntity<Void> updateProgress(
            @PathVariable UUID id,
            @Valid @RequestBody AiProgressRequest request) {
        jobService.updateProgress(id, request.stage(), request.progress());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/callback")
    public ResponseEntity<Void> completeJob(
            @PathVariable UUID id,
            @Valid @RequestBody AiCallbackRequest request) {
        jobService.completeJob(id, request);
        return ResponseEntity.ok().build();
    }
}
