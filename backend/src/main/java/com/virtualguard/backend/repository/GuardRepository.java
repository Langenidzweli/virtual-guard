package com.virtualguard.backend.repository;

import com.virtualguard.backend.entity.Guard;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface GuardRepository extends JpaRepository<Guard, UUID> {
    Optional<Guard> findByEmail(String email);
    Optional<Guard> findByBadgeNumber(String badgeNumber);
}
