package com.virtualguard.backend.repository;

import com.virtualguard.backend.entity.Camera;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CameraRepository extends JpaRepository<Camera, String> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select c from Camera c where c.id = :id")
    java.util.Optional<Camera> lockById(@org.springframework.data.repository.query.Param("id") String id);
    List<Camera> findByMonitoredTrue();
}