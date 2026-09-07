package com.virtualguard.backend.controller;

import com.virtualguard.backend.dto.NotificationCountResponse;
import com.virtualguard.backend.enums.ReviewStatus;
import com.virtualguard.backend.repository.IncidentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final IncidentRepository incidentRepository;

    @GetMapping("/count")
    public NotificationCountResponse getPendingReviewCount() {
        return new NotificationCountResponse(
                incidentRepository.countByReviewStatus(ReviewStatus.PENDING_REVIEW));
    }
}
