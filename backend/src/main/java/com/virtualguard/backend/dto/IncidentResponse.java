package com.virtualguard.backend.dto;

import com.virtualguard.backend.enums.ReviewStatus;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

public record IncidentResponse(
        UUID id,
        UUID jobId,
        String cameraId,
        String cameraLabel,
        String detectionType,
        double confidence,
        Double suspicionScore,
        Map<String, Object> evidence,
        ReviewStatus reviewStatus,
        LocalDateTime detectedAt,
        LocalDateTime reviewedAt,
        String reviewedBy) {
}
