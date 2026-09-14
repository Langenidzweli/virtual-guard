package com.virtualguard.backend.dto;
import java.time.LocalDateTime;
import java.util.UUID;
public record IncidentNote(UUID id, String author, String text, LocalDateTime createdAt) {}
