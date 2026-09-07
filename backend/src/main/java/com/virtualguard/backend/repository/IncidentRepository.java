package com.virtualguard.backend.repository;

import com.virtualguard.backend.entity.Incident;
import com.virtualguard.backend.enums.ReviewStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface IncidentRepository extends JpaRepository<Incident, UUID> {
    List<Incident> findByReviewStatus(ReviewStatus status);
    List<Incident> findAllByOrderByDetectedAtDesc();
    List<Incident> findByReviewStatusOrderByDetectedAtDesc(ReviewStatus status);
    boolean existsByJobId(UUID jobId);
    long countByReviewStatus(ReviewStatus status);
    List<Incident> findByJobCameraIdAndReviewStatus(String cameraId, ReviewStatus status);
}
