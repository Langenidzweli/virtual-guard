package com.virtualguard.backend.repository;

import com.virtualguard.backend.entity.Camera;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CameraRepository extends JpaRepository<Camera, String> {
    List<Camera> findByMonitoredTrue();
}