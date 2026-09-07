package com.virtualguard.backend.dto;

import com.virtualguard.backend.enums.ReviewStatus;

import java.time.LocalDateTime;
import java.util.UUID;

public record IncidentSummaryResponse(
        UUID id,
        UUID jobId,
        String cameraId,
        String cameraLabel,
        String detectionType,
        double confidence,
        Double suspicionScore,
        String annotatedVideoFileName,
        ReviewStatus reviewStatus,
        LocalDateTime detectedAt,
        LocalDateTime reviewedAt,
        String reviewedBy) {
}
