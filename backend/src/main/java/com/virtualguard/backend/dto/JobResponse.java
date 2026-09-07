package com.virtualguard.backend.dto;

import java.util.UUID;

public record JobResponse(UUID jobId, String status, String videoFileName) {
}