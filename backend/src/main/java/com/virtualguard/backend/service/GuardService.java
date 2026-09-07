package com.virtualguard.backend.service;

import com.virtualguard.backend.dto.GuardRequestDto;
import com.virtualguard.backend.dto.GuardResponseDto;
import com.virtualguard.backend.entity.Guard;
import com.virtualguard.backend.enums.GuardStatus;
import com.virtualguard.backend.exception.ResourceNotFoundException;
import com.virtualguard.backend.repository.GuardRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GuardService {

    private final GuardRepository guardRepository;

    @Transactional(readOnly = true)
    public List<GuardResponseDto> getAllGuards() {
        return guardRepository.findAll().stream()
                .map(this::toResponseDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public GuardResponseDto getGuardById(UUID id) {
        Guard guard = guardRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Guard not found: " + id));
        return toResponseDto(guard);
    }

    @Transactional
    public GuardResponseDto createGuard(GuardRequestDto request) {
        if (guardRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new IllegalArgumentException("Email already exists: " + request.getEmail());
        }
        if (guardRepository.findByBadgeNumber(request.getBadgeNumber()).isPresent()) {
            throw new IllegalArgumentException("Badge number already exists: " + request.getBadgeNumber());
        }

        Guard guard = new Guard();
        guard.setName(request.getName());
        guard.setEmail(request.getEmail());
        guard.setPhone(request.getPhone());
        guard.setBadgeNumber(request.getBadgeNumber());
        guard.setStatus(GuardStatus.ACTIVE);
        guard.setDateJoined(LocalDate.now());

        Guard saved = guardRepository.save(guard);
        return toResponseDto(saved);
    }

    @Transactional
    public GuardResponseDto updateGuard(UUID id, GuardRequestDto request) {
        Guard guard = guardRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Guard not found: " + id));

        guardRepository.findByEmail(request.getEmail())
                .filter(existing -> !existing.getId().equals(id))
                .ifPresent(existing -> { throw new IllegalArgumentException("Email already exists: " + request.getEmail()); });
        guardRepository.findByBadgeNumber(request.getBadgeNumber())
                .filter(existing -> !existing.getId().equals(id))
                .ifPresent(existing -> { throw new IllegalArgumentException("Badge number already exists: " + request.getBadgeNumber()); });

        guard.setName(request.getName());
        guard.setEmail(request.getEmail());
        guard.setPhone(request.getPhone());
        guard.setBadgeNumber(request.getBadgeNumber());

        Guard updated = guardRepository.save(guard);
        return toResponseDto(updated);
    }

    @Transactional
    public GuardResponseDto updateGuardStatus(UUID id, GuardStatus status) {
        Guard guard = guardRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Guard not found: " + id));

        guard.setStatus(status);
        Guard updated = guardRepository.save(guard);
        return toResponseDto(updated);
    }

    private GuardResponseDto toResponseDto(Guard guard) {
        GuardResponseDto dto = new GuardResponseDto();
        dto.setId(guard.getId());
        dto.setName(guard.getName());
        dto.setEmail(guard.getEmail());
        dto.setPhone(guard.getPhone());
        dto.setBadgeNumber(guard.getBadgeNumber());
        dto.setStatus(guard.getStatus());
        dto.setDateJoined(guard.getDateJoined());
        return dto;
    }
}
