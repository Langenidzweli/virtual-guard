package com.virtualguard.backend.entity;

import com.virtualguard.backend.enums.ReviewStatus;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "incidents")
@Data
public class Incident {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "job_id", nullable = false)
    private ProcessingJob job;

    @Column(nullable = false)
    private String detectionType;

    @Column(nullable = false)
    private double confidence;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> boundingBoxes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ReviewStatus reviewStatus;

    private LocalDateTime detectedAt;
    private LocalDateTime reviewedAt;
    private String reviewedBy;

    @PrePersist
    protected void onCreate() {
        detectedAt = LocalDateTime.now();
    }
}