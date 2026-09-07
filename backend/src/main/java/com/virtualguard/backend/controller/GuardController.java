package com.virtualguard.backend.controller;

import com.virtualguard.backend.dto.GuardRequestDto;
import com.virtualguard.backend.dto.GuardResponseDto;
import com.virtualguard.backend.enums.GuardStatus;
import com.virtualguard.backend.service.GuardService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/guards")
@RequiredArgsConstructor
public class GuardController {

    private final GuardService guardService;

    @GetMapping
    public List<GuardResponseDto> getAllGuards() {
        return guardService.getAllGuards();
    }

    @GetMapping("/{id}")
    public ResponseEntity<GuardResponseDto> getGuardById(@PathVariable UUID id) {
        return ResponseEntity.ok(guardService.getGuardById(id));
    }

    @PostMapping
    public ResponseEntity<GuardResponseDto> createGuard(@Valid @RequestBody GuardRequestDto request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(guardService.createGuard(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<GuardResponseDto> updateGuard(
            @PathVariable UUID id,
            @Valid @RequestBody GuardRequestDto request) {
        return ResponseEntity.ok(guardService.updateGuard(id, request));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<GuardResponseDto> updateGuardStatus(
            @PathVariable UUID id,
            @RequestParam GuardStatus status) {
        return ResponseEntity.ok(guardService.updateGuardStatus(id, status));
    }
}
