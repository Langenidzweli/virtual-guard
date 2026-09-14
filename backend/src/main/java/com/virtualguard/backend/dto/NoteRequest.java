package com.virtualguard.backend.dto;
import java.util.UUID;
import jakarta.validation.constraints.*;
public record NoteRequest(@NotNull UUID id, @NotBlank @Size(max=5000) String text) {}
