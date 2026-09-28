package com.virtualguard.backend.service;

import com.virtualguard.backend.dto.ChangePasswordRequest;
import com.virtualguard.backend.entity.Guard;
import com.virtualguard.backend.entity.User;
import com.virtualguard.backend.enums.Role;
import com.virtualguard.backend.repository.GuardRepository;
import com.virtualguard.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.Optional;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PasswordServiceTest {
    UserRepository users = mock(UserRepository.class);
    GuardRepository guards = mock(GuardRepository.class);
    BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);
    PasswordService service = new PasswordService(users, guards, encoder);
    User user;
    UUID guardId = UUID.randomUUID();
    @BeforeEach void setup() {
        user = new User(); user.setEmail("guard@example.test"); user.setRole(Role.SECURITY_GUARD);
        user.setPassword(encoder.encode("Original-password-123")); user.setAuthVersion(7);
        Guard guard = new Guard(); guard.setUser(user);
        when(guards.findById(guardId)).thenReturn(Optional.of(guard));
        when(users.findForPasswordChange(user.getEmail())).thenReturn(Optional.of(user));
        when(users.save(user)).thenReturn(user);
        ReflectionTestUtils.setField(service, "temporaryPassword", "Temporary-password-123");
    }
    @Test void resetHashesPasswordAndRevokesExistingSessions() {
        service.resetGuard(guardId);
        assertTrue(encoder.matches("Temporary-password-123", user.getPassword()));
        assertNotEquals("Temporary-password-123", user.getPassword());
        assertTrue(user.isMustChangePassword()); assertEquals(8, user.getAuthVersion());
    }
    @Test void changeRequiresCurrentPasswordAndClearsRestriction() {
        service.resetGuard(guardId);
        service.change(user.getEmail(), new ChangePasswordRequest("Temporary-password-123", "Personal-password-456", "Personal-password-456"));
        assertFalse(user.isMustChangePassword()); assertEquals(9,user.getAuthVersion());
        assertTrue(encoder.matches("Personal-password-456",user.getPassword()));
    }
    @Test void wrongCurrentPasswordCannotChangeAccount() {
        assertThrows(IllegalArgumentException.class, () -> service.change(user.getEmail(),new ChangePasswordRequest("wrong", "Personal-password-456", "Personal-password-456")));
        assertEquals(7,user.getAuthVersion()); verify(users,never()).save(any());
    }
    @Test void mismatchedOrReusedOrOversizedPasswordsAreRejected() {
        for (var request : java.util.List.of(
                new ChangePasswordRequest("Original-password-123", "Personal-password-456", "different-password-789"),
                new ChangePasswordRequest("Original-password-123", "Original-password-123", "Original-password-123"),
                new ChangePasswordRequest("Original-password-123", "Temporary-password-123", "Temporary-password-123"),
                new ChangePasswordRequest("Original-password-123", "a".repeat(73), "a".repeat(73)))) {
            assertThrows(IllegalArgumentException.class, () -> service.change(user.getEmail(),request));
        }
        verify(users,never()).save(any());
    }
    @Test void resetCannotTargetAdministrator() {
        user.setRole(Role.ADMIN);
        assertThrows(IllegalArgumentException.class, () -> service.resetGuard(guardId));
        verify(users,never()).save(any());
    }
    @Test void missingTemporaryPasswordFailsWithoutMutation() {
        ReflectionTestUtils.setField(service,"temporaryPassword", "");
        assertThrows(IllegalStateException.class, () -> service.resetGuard(guardId));
        assertEquals(7,user.getAuthVersion()); verify(users,never()).save(any());
    }
}
