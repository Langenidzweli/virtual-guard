package com.virtualguard.backend.dto;

import com.virtualguard.backend.enums.CameraStatus;
import lombok.Data;

@Data
public class CameraDto {
    private String id;
    private String label;
    private double x;
    private double y;
    private boolean monitored;
    private CameraStatus status;
    private String siteId;
    private String streamUrl;
}