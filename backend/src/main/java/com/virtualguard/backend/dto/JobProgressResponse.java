package com.virtualguard.backend.dto;

import java.util.UUID;
import java.time.LocalDateTime;

public record JobProgressResponse(
                UUID jobId,
                String status,
                String currentStage,
                int progressPercent,
                Double suspicionScore,
                Double confidence,
                String behaviour,
                String annotatedVideoFileName,
                String cameraId,
                String videoFileName,
                LocalDateTime createdAt) {
}
