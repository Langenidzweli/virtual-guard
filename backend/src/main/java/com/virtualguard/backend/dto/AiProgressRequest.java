package com.virtualguard.backend.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record AiProgressRequest(
        @NotBlank String stage,
        @Min(0) @Max(100) int progress, @jakarta.validation.constraints.Size(max=250) String reason) {
    public AiProgressRequest(String stage, int progress) { this(stage, progress, null); }
}
