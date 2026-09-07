package com.virtualguard.backend.service;

import com.virtualguard.backend.dto.AiCallbackRequest;
import com.virtualguard.backend.dto.IncidentSummaryResponse;
import com.virtualguard.backend.entity.Camera;
import com.virtualguard.backend.entity.Incident;
import com.virtualguard.backend.entity.ProcessingJob;
import com.virtualguard.backend.enums.ReviewStatus;
import com.virtualguard.backend.repository.IncidentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class IncidentServiceTest {

    @Mock
    private IncidentRepository incidentRepository;
    @Mock
    private CameraStatusService cameraStatusService;

    private IncidentService incidentService;
    private ProcessingJob job;

    @BeforeEach
    void setUp() {
        incidentService = new IncidentService(incidentRepository, cameraStatusService);
        Camera camera = new Camera();
        camera.setId("cam-aisle-a");
        camera.setLabel("Aisle A");
        job = new ProcessingJob();
        job.setId(UUID.randomUUID());
        job.setCamera(camera);
    }

    @Test
    void createsOnePendingIncidentForSuspiciousResult() {
        AiCallbackRequest request = new AiCallbackRequest(
                "shoplifting", 0.91, 82.5,
                List.of(new AiCallbackRequest.AiDetectionRequest(
                        12, "person", 0.88, 1, List.of(1.0, 2.0, 3.0, 4.0))),
                java.util.Map.of("totalDetections", 1L),
                "video_annotated.mp4", "completed");
        when(incidentRepository.existsByJobId(job.getId())).thenReturn(false);

        incidentService.createFromAiResult(job, request);

        ArgumentCaptor<Incident> captor = ArgumentCaptor.forClass(Incident.class);
        verify(incidentRepository).save(captor.capture());
        Incident incident = captor.getValue();
        assertEquals(ReviewStatus.PENDING_REVIEW, incident.getReviewStatus());
        assertEquals("SHOPLIFTING", incident.getDetectionType());
        assertEquals(82.5, incident.getBoundingBoxes().get("suspicionScore"));
    }

    @Test
    void ignoresNormalResults() {
        AiCallbackRequest request = new AiCallbackRequest(
                "normal", 0.96, 4.0, List.of(), java.util.Map.of(), "video_annotated.mp4", "completed");

        incidentService.createFromAiResult(job, request);

        verify(incidentRepository, never()).save(any());
    }

    @Test
    void ignoresDuplicateCallbackForSameJob() {
        AiCallbackRequest request = new AiCallbackRequest(
                "shoplifting", 0.91, 82.5, List.of(), java.util.Map.of(), "video_annotated.mp4", "completed");
        when(incidentRepository.existsByJobId(job.getId())).thenReturn(true);

        incidentService.createFromAiResult(job, request);

        verify(incidentRepository, never()).save(any());
    }

    @Test
    void incidentListsExposeSummaryAndAnnotatedFilenameWithoutDetectionPayload() {
        Incident incident = new Incident();
        incident.setId(UUID.randomUUID());
        incident.setJob(job);
        incident.setDetectionType("SHOPLIFTING");
        incident.setConfidence(0.91);
        incident.setReviewStatus(ReviewStatus.PENDING_REVIEW);
        incident.setBoundingBoxes(java.util.Map.of(
                "suspicionScore", 82.5,
                "annotatedVideoPath", "C:\\uploads\\clip_annotated.mp4",
                "detections", List.of(java.util.Map.of("frame", 1))));
        when(incidentRepository.findAllByOrderByDetectedAtDesc()).thenReturn(List.of(incident));

        List<IncidentSummaryResponse> summaries = incidentService.getIncidents(null);

        assertEquals(1, summaries.size());
        assertEquals("clip_annotated.mp4", summaries.get(0).annotatedVideoFileName());
        assertEquals(82.5, summaries.get(0).suspicionScore());
    }

    @Test
    void preventsReviewingAnIncidentTwice() {
        UUID incidentId = UUID.randomUUID();
        Incident incident = new Incident();
        incident.setId(incidentId);
        incident.setJob(job);
        incident.setReviewStatus(ReviewStatus.CONFIRMED);
        when(incidentRepository.findById(incidentId)).thenReturn(Optional.of(incident));

        assertThrows(IllegalStateException.class,
                () -> incidentService.reviewIncident(incidentId, ReviewStatus.DISMISSED, "guard@example.com"));
    }
}
