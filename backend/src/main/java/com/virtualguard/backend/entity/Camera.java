package com.virtualguard.backend.entity;

import com.virtualguard.backend.enums.CameraStatus;
import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Entity
@Table(name = "cameras")
@Data
public class Camera {
    @Id
    private String id;

    @Column(nullable = false)
    private String label;

    @Column(nullable = false)
    private double x;

    @Column(nullable = false)
    private double y;

    @Column(nullable = false)
    private boolean monitored;

    private String siteId;
    private String streamUrl;
    private LocalDateTime lastUpdateAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CameraStatus status;
}