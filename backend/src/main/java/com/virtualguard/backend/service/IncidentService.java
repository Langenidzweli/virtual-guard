package com.virtualguard.backend.service;

import com.virtualguard.backend.dto.AiCallbackRequest;
import com.virtualguard.backend.dto.IncidentResponse;
import com.virtualguard.backend.dto.IncidentSummaryResponse;
import com.virtualguard.backend.entity.Incident;
import com.virtualguard.backend.entity.ProcessingJob;
import com.virtualguard.backend.enums.ReviewStatus;
import com.virtualguard.backend.exception.ResourceNotFoundException;
import com.virtualguard.backend.repository.IncidentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.nio.file.Paths;

@Service
@RequiredArgsConstructor
public class IncidentService {

    private final IncidentRepository incidentRepository;
    private final CameraStatusService cameraStatusService;

    @Transactional
    public void createFromAiResult(ProcessingJob job, AiCallbackRequest request) {
        if (request.behaviour() == null || !"shoplifting".equalsIgnoreCase(request.behaviour())) {
            return;
        }
        if (incidentRepository.existsByJobId(job.getId())) {
            return;
        }

        Incident incident = new Incident();
        incident.setJob(job);
        incident.setDetectionType(request.behaviour().toUpperCase(Locale.ROOT));
        incident.setConfidence(valueOrZero(request.confidence()));
        incident.setReviewStatus(ReviewStatus.PENDING_REVIEW);

        Map<String, Object> evidence = new LinkedHashMap<>();
        evidence.put("suspicionScore", valueOrZero(request.suspicion_score()));
        evidence.put("annotatedVideoPath", request.annotated_video_path());
        evidence.put("visionStatus", request.vision_status());
        evidence.put("detections", request.detections() == null ? List.of() : request.detections());
        evidence.put("detectionSummary", request.detection_summary() == null ? Map.of() : request.detection_summary());
        incident.setBoundingBoxes(evidence);

        incidentRepository.save(incident);
        cameraStatusService.refresh(job.getCamera().getId());
    }

    @Transactional(readOnly = true)
    public List<IncidentSummaryResponse> getIncidents(ReviewStatus status) {
        List<Incident> incidents = status == null
                ? incidentRepository.findAllByOrderByDetectedAtDesc()
                : incidentRepository.findByReviewStatusOrderByDetectedAtDesc(status);
        return incidents.stream().map(this::toSummaryResponse).toList();
    }

    @Transactional(readOnly = true)
    public IncidentResponse getIncident(UUID id) {
        return toResponse(findIncident(id));
    }

    @Transactional
    public IncidentResponse reviewIncident(UUID id, ReviewStatus status, String reviewedBy) {
        if (status == ReviewStatus.PENDING_REVIEW) {
            throw new IllegalArgumentException("A review must confirm, dismiss, or escalate the incident");
        }
        Incident incident = findIncident(id);
        if (incident.getReviewStatus() != ReviewStatus.PENDING_REVIEW) {
            throw new IllegalStateException("Incident has already been reviewed");
        }
        incident.setReviewStatus(status);
        incident.setReviewedAt(LocalDateTime.now());
        incident.setReviewedBy(reviewedBy);
        Incident saved = incidentRepository.save(incident);
        cameraStatusService.refresh(saved.getJob().getCamera().getId());
        return toResponse(saved);
    }

    private Incident findIncident(UUID id) {
        return incidentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Incident not found: " + id));
    }

    private IncidentResponse toResponse(Incident incident) {
        ProcessingJob job = incident.getJob();
        return new IncidentResponse(
                incident.getId(),
                job.getId(),
                job.getCamera().getId(),
                job.getCamera().getLabel(),
                incident.getDetectionType(),
                incident.getConfidence(),
                getSuspicionScore(incident),
                incident.getBoundingBoxes(),
                incident.getReviewStatus(),
                incident.getDetectedAt(),
                incident.getReviewedAt(),
                incident.getReviewedBy());
    }

    private IncidentSummaryResponse toSummaryResponse(Incident incident) {
        ProcessingJob job = incident.getJob();
        return new IncidentSummaryResponse(
                incident.getId(),
                job.getId(),
                job.getCamera().getId(),
                job.getCamera().getLabel(),
                incident.getDetectionType(),
                incident.getConfidence(),
                getSuspicionScore(incident),
                annotatedVideoFileName(incident),
                incident.getReviewStatus(),
                incident.getDetectedAt(),
                incident.getReviewedAt(),
                incident.getReviewedBy());
    }

    private String annotatedVideoFileName(Incident incident) {
        if (incident.getBoundingBoxes() == null) {
            return null;
        }
        Object path = incident.getBoundingBoxes().get("annotatedVideoPath");
        return path instanceof String value && !value.isBlank()
                ? Paths.get(value).getFileName().toString()
                : null;
    }

    private Double getSuspicionScore(Incident incident) {
        Object rawScore = incident.getBoundingBoxes() == null
                ? null
                : incident.getBoundingBoxes().get("suspicionScore");
        return rawScore instanceof Number number ? number.doubleValue() : null;
    }

    private double valueOrZero(Double value) {
        return value == null ? 0.0 : value;
    }
}
