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

    private final com.virtualguard.backend.service.JobLifecycle lifecycle;

    @PostMapping("/{id}/progress")
    public ResponseEntity<Void> updateProgress(
            @PathVariable UUID id,
            @org.springframework.web.bind.annotation.RequestParam UUID attemptId,
            @Valid @RequestBody AiProgressRequest request) {
        lifecycle.progress(id, attemptId, request.stage(), request.progress(), request.reason());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/callback")
    public ResponseEntity<Void> completeJob(
            @PathVariable UUID id,
            @org.springframework.web.bind.annotation.RequestParam UUID attemptId,
            @Valid @RequestBody AiCallbackRequest request) {
        lifecycle.complete(id, attemptId, request);
        return ResponseEntity.ok().build();
    }
}
