package com.virtualguard.backend.repository;

import com.virtualguard.backend.entity.ProcessingJob;
import com.virtualguard.backend.enums.JobStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface ProcessingJobRepository extends JpaRepository<ProcessingJob, UUID> {
    List<ProcessingJob> findByStatusIn(List<JobStatus> statuses);
}