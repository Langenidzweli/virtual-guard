package com.virtualguard.backend.repository;

import com.virtualguard.backend.entity.ProcessingJob;
import com.virtualguard.backend.enums.JobStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface ProcessingJobRepository extends JpaRepository<ProcessingJob, UUID> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select j from ProcessingJob j where j.id = :id")
    java.util.Optional<ProcessingJob> lockById(@org.springframework.data.repository.query.Param("id") UUID id);
    List<ProcessingJob> findByStatusIn(List<JobStatus> statuses);
}
