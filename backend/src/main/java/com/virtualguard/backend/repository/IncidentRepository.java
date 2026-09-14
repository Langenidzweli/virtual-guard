package com.virtualguard.backend.repository;

import com.virtualguard.backend.entity.Incident;
import com.virtualguard.backend.enums.ReviewStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface IncidentRepository extends JpaRepository<Incident, UUID> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select i from Incident i where i.id = :id")
    java.util.Optional<Incident> lockById(@org.springframework.data.repository.query.Param("id") UUID id);
    List<Incident> findByReviewStatus(ReviewStatus status);
    List<Incident> findAllByOrderByDetectedAtDesc();
    List<Incident> findByReviewStatusOrderByDetectedAtDesc(ReviewStatus status);
    boolean existsByJobId(UUID jobId);
    long countByReviewStatus(ReviewStatus status);
    List<Incident> findByJobCameraIdAndReviewStatus(String cameraId, ReviewStatus status);
}
