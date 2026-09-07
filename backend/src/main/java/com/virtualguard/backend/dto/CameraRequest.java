package com.virtualguard.backend.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CameraRequest(
        @NotBlank
        @Pattern(regexp = "[A-Za-z0-9_-]+", message = "must contain only letters, numbers, hyphens, or underscores")
        @Size(max = 64) String id,
        @NotBlank @Size(max = 100) String label,
        @DecimalMin("0.0") @DecimalMax("100.0") double x,
        @DecimalMin("0.0") @DecimalMax("100.0") double y,
        boolean monitored,
        @Size(max = 100) String siteId,
        @Size(max = 500) String streamUrl) {
}
