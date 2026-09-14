package com.virtualguard.backend.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.beans.factory.annotation.Value;
import com.virtualguard.backend.repository.ProcessingJobRepository;
import com.virtualguard.backend.enums.JobStatus;
import java.time.LocalDateTime;
import java.util.List;

@Component
@RequiredArgsConstructor
public class JobRecovery {
    private final ProcessingJobRepository jobs;
    private final JobLifecycle lifecycle;
    @Value("${app.jobs.lease-seconds:120}") private long leaseSeconds;
    @Value("${app.jobs.max-duration-seconds:7200}") private long maxDurationSeconds;
    @Scheduled(fixedDelayString = "${app.jobs.recovery-interval-ms:30000}")
    public void recover() {
        var now = LocalDateTime.now();
        for (var job : jobs.findByStatusIn(List.of(JobStatus.PROCESSING)))
            lifecycle.expire(job.getId(), now.minusSeconds(leaseSeconds), now.minusSeconds(maxDurationSeconds));
    }
}
