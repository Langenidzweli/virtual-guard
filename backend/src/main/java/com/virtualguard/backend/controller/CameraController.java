package com.virtualguard.backend.controller;

import com.virtualguard.backend.dto.CameraDto;
import com.virtualguard.backend.dto.CameraRequest;
import com.virtualguard.backend.service.CameraService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/cameras")
@RequiredArgsConstructor
public class CameraController {

    private final CameraService cameraService;

    @GetMapping
    public List<CameraDto> getAllCameras() {
        return cameraService.getAll();
    }

    @PostMapping
    public CameraDto createCamera(@Valid @RequestBody CameraRequest request) {
        return cameraService.create(request);
    }

    @PutMapping("/{id}")
    public CameraDto updateCamera(@PathVariable String id, @Valid @RequestBody CameraRequest request) {
        return cameraService.update(id, request);
    }
}
