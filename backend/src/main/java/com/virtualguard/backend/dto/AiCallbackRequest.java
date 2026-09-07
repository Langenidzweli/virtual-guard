package com.virtualguard.backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Map;

public record AiCallbackRequest(
        @NotBlank @Pattern(regexp = "(?i)normal|shoplifting") String behaviour,
        @NotNull @DecimalMin("0.0") @DecimalMax("1.0") Double confidence,
        @NotNull @DecimalMin("0.0") @DecimalMax("100.0") Double suspicion_score,
        @Size(max = 500) List<@Valid AiDetectionRequest> detections,
        @Size(max = 20) Map<@NotBlank String, @Min(0) Long> detection_summary,
        @Size(max = 1024) String annotated_video_path,
        @NotBlank @Pattern(regexp = "completed") String vision_status) {

    public record AiDetectionRequest(
            @NotNull @Min(0) Integer frame,
            @NotBlank String class_name,
            @NotNull @DecimalMin("0.0") @DecimalMax("1.0") Double confidence,
            @Min(0) Integer tracking_id,
            @NotNull @Size(min = 4, max = 4) List<@NotNull Double> bbox) {
    }
}
