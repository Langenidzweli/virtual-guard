package com.virtualguard.backend.controller;

import com.virtualguard.backend.dto.IncidentResponse;
import com.virtualguard.backend.dto.IncidentSummaryResponse;
import com.virtualguard.backend.enums.ReviewStatus;
import com.virtualguard.backend.service.IncidentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import org.springframework.security.core.Authentication;

@RestController
@RequestMapping("/api/incidents")
@RequiredArgsConstructor
public class IncidentController {

    private final IncidentService incidentService;

    @GetMapping
    public List<IncidentSummaryResponse> getAllIncidents(
            @RequestParam(required = false) ReviewStatus status) {
        return incidentService.getIncidents(status);
    }

    @GetMapping("/{id}")
    public ResponseEntity<IncidentResponse> getIncidentById(@PathVariable UUID id) {
        return ResponseEntity.ok(incidentService.getIncident(id));
    }

    @GetMapping("/status/{status}")
    public List<IncidentSummaryResponse> getIncidentsByStatus(@PathVariable ReviewStatus status) {
        return incidentService.getIncidents(status);
    }

    @PatchMapping("/{id}/review")
    public ResponseEntity<IncidentResponse> updateReviewStatus(
            @PathVariable UUID id,
            @RequestParam ReviewStatus status,
            Authentication authentication) {
        return ResponseEntity.ok(incidentService.reviewIncident(id, status, authentication.getName()));
    }
}
