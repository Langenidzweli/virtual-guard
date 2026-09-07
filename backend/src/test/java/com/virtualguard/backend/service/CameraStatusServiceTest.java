package com.virtualguard.backend.service;

import com.virtualguard.backend.entity.Camera;
import com.virtualguard.backend.entity.Incident;
import com.virtualguard.backend.enums.CameraStatus;
import com.virtualguard.backend.enums.ReviewStatus;
import com.virtualguard.backend.repository.CameraRepository;
import com.virtualguard.backend.repository.IncidentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CameraStatusServiceTest {

    @Mock CameraRepository cameraRepository;
    @Mock IncidentRepository incidentRepository;

    private CameraStatusService service;

    @BeforeEach
    void setUp() {
        service = new CameraStatusService(cameraRepository, incidentRepository);
        ReflectionTestUtils.setField(service, "alertThreshold", 70.0);
    }

    @Test
    void highSuspicionPendingIncidentSetsAlert() {
        Camera camera = camera(CameraStatus.NORMAL);
        Incident incident = new Incident();
        incident.setBoundingBoxes(Map.of("suspicionScore", 82.5));
        when(cameraRepository.findById(camera.getId())).thenReturn(Optional.of(camera));
        when(incidentRepository.findByJobCameraIdAndReviewStatus(camera.getId(), ReviewStatus.PENDING_REVIEW))
                .thenReturn(List.of(incident));

        service.refresh(camera.getId());

        assertEquals(CameraStatus.ALERT, camera.getStatus());
        verify(cameraRepository).save(camera);
    }

    @Test
    void noPendingIncidentsReturnsCameraToNormal() {
        Camera camera = camera(CameraStatus.ALERT);
        when(cameraRepository.findById(camera.getId())).thenReturn(Optional.of(camera));
        when(incidentRepository.findByJobCameraIdAndReviewStatus(camera.getId(), ReviewStatus.PENDING_REVIEW))
                .thenReturn(List.of());

        service.refresh(camera.getId());

        assertEquals(CameraStatus.NORMAL, camera.getStatus());
    }

    @Test
    void offlineStatusIsNotOverwritten() {
        Camera camera = camera(CameraStatus.OFFLINE);
        when(cameraRepository.findById(camera.getId())).thenReturn(Optional.of(camera));

        service.refresh(camera.getId());

        assertEquals(CameraStatus.OFFLINE, camera.getStatus());
        verify(incidentRepository, never()).findByJobCameraIdAndReviewStatus(camera.getId(), ReviewStatus.PENDING_REVIEW);
        verify(cameraRepository, never()).save(camera);
    }

    private Camera camera(CameraStatus status) {
        Camera camera = new Camera();
        camera.setId("cam-aisle-a");
        camera.setStatus(status);
        return camera;
    }
}
