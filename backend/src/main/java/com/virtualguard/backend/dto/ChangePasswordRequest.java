package com.virtualguard.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChangePasswordRequest(
        @NotBlank @Size(max = 72) String currentPassword,
        @NotBlank @Size(min = 12, max = 72) String newPassword,
        @NotBlank @Size(min = 12, max = 72) String confirmPassword) {
    @Override
    public String toString() { return "ChangePasswordRequest[REDACTED]"; }
}
