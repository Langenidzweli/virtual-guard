package com.virtualguard.backend.service;

import com.virtualguard.backend.dto.GuardRequestDto;
import com.virtualguard.backend.entity.Guard;
import com.virtualguard.backend.repository.GuardRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GuardServiceTest {

    @Mock GuardRepository guardRepository;
    private GuardService guardService;

    @BeforeEach
    void setUp() {
        guardService = new GuardService(guardRepository);
    }

    @Test
    void duplicateBadgeIsRejectedBeforeSave() {
        Guard existing = new Guard();
        when(guardRepository.findByEmail("new@example.com")).thenReturn(Optional.empty());
        when(guardRepository.findByBadgeNumber("VG-001")).thenReturn(Optional.of(existing));

        assertThrows(IllegalArgumentException.class,
                () -> guardService.createGuard(request("new@example.com", "VG-001")));
        verify(guardRepository, never()).save(any());
    }

    @Test
    void updateAllowsCurrentGuardToKeepEmailAndBadge() {
        UUID id = UUID.randomUUID();
        Guard guard = new Guard();
        guard.setId(id);
        guard.setEmail("guard@example.com");
        guard.setBadgeNumber("VG-001");
        when(guardRepository.findById(id)).thenReturn(Optional.of(guard));
        when(guardRepository.findByEmail("guard@example.com")).thenReturn(Optional.of(guard));
        when(guardRepository.findByBadgeNumber("VG-001")).thenReturn(Optional.of(guard));
        when(guardRepository.save(guard)).thenReturn(guard);

        guardService.updateGuard(id, request("guard@example.com", "VG-001"));

        assertEquals("Guard Name", guard.getName());
        verify(guardRepository).save(guard);
    }

    private GuardRequestDto request(String email, String badge) {
        GuardRequestDto request = new GuardRequestDto();
        request.setName("Guard Name");
        request.setEmail(email);
        request.setPhone("0123456789");
        request.setBadgeNumber(badge);
        return request;
    }
}
