package com.virtualguard.backend.service;

import com.virtualguard.backend.entity.Camera;
import com.virtualguard.backend.entity.Incident;
import com.virtualguard.backend.enums.CameraStatus;
import com.virtualguard.backend.enums.ReviewStatus;
import com.virtualguard.backend.repository.CameraRepository;
import com.virtualguard.backend.repository.IncidentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CameraStatusService {

    private final CameraRepository cameraRepository;
    private final IncidentRepository incidentRepository;

    @Value("${app.incidents.alert-threshold:70.0}")
    private double alertThreshold;

    @Transactional
    public void refresh(String cameraId) {
        Camera camera = cameraRepository.findById(cameraId).orElse(null);
        if (camera == null || camera.getStatus() == CameraStatus.OFFLINE) {
            return;
        }
        List<Incident> pending = incidentRepository.findByJobCameraIdAndReviewStatus(
                cameraId, ReviewStatus.PENDING_REVIEW);
        if (pending.isEmpty()) {
            camera.setStatus(CameraStatus.NORMAL);
        } else {
            double highestScore = pending.stream().mapToDouble(this::suspicionScore).max().orElse(0.0);
            camera.setStatus(highestScore >= alertThreshold ? CameraStatus.ALERT : CameraStatus.REVIEW);
        }
        cameraRepository.save(camera);
    }

    private double suspicionScore(Incident incident) {
        if (incident.getBoundingBoxes() == null) return 0.0;
        Object value = incident.getBoundingBoxes().get("suspicionScore");
        return value instanceof Number number ? number.doubleValue() : 0.0;
    }
}
