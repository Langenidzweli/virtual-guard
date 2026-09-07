package com.virtualguard.backend.service;

import com.virtualguard.backend.dto.CameraDto;
import com.virtualguard.backend.dto.CameraRequest;
import com.virtualguard.backend.entity.Camera;
import com.virtualguard.backend.enums.CameraStatus;
import com.virtualguard.backend.exception.ResourceNotFoundException;
import com.virtualguard.backend.repository.CameraRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CameraService {

    private final CameraRepository cameraRepository;

    @Transactional(readOnly = true)
    public List<CameraDto> getAll() {
        return cameraRepository.findAll().stream().map(this::toDto).toList();
    }

    @Transactional
    public CameraDto create(CameraRequest request) {
        if (cameraRepository.existsById(request.id())) {
            throw new IllegalArgumentException("Camera ID already exists: " + request.id());
        }
        Camera camera = new Camera();
        camera.setId(request.id());
        camera.setStatus(CameraStatus.IDLE);
        apply(camera, request);
        return toDto(cameraRepository.save(camera));
    }

    @Transactional
    public CameraDto update(String id, CameraRequest request) {
        if (!id.equals(request.id())) {
            throw new IllegalArgumentException("Camera ID cannot be changed");
        }
        Camera camera = cameraRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Camera not found: " + id));
        apply(camera, request);
        return toDto(cameraRepository.save(camera));
    }

    private void apply(Camera camera, CameraRequest request) {
        camera.setLabel(request.label().trim());
        camera.setX(request.x());
        camera.setY(request.y());
        camera.setMonitored(request.monitored());
        camera.setSiteId(blankToNull(request.siteId()));
        camera.setStreamUrl(blankToNull(request.streamUrl()));
        camera.setLastUpdateAt(LocalDateTime.now());
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private CameraDto toDto(Camera camera) {
        CameraDto dto = new CameraDto();
        dto.setId(camera.getId());
        dto.setLabel(camera.getLabel());
        dto.setX(camera.getX());
        dto.setY(camera.getY());
        dto.setMonitored(camera.isMonitored());
        dto.setStatus(camera.getStatus());
        dto.setSiteId(camera.getSiteId());
        dto.setStreamUrl(camera.getStreamUrl());
        return dto;
    }
}
