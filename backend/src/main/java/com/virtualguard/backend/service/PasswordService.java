package com.virtualguard.backend.service;

import com.virtualguard.backend.dto.ChangePasswordRequest;
import com.virtualguard.backend.entity.User;
import com.virtualguard.backend.enums.Role;
import com.virtualguard.backend.exception.ResourceNotFoundException;
import com.virtualguard.backend.repository.GuardRepository;
import com.virtualguard.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PasswordService {
    private final UserRepository users;
    private final GuardRepository guards;
    private final PasswordEncoder encoder;

    @Value("${app.guards.temporary-password:}")
    private String temporaryPassword;

    @Transactional
    public void resetGuard(UUID guardId) {
        var guard = guards.findById(guardId)
                .orElseThrow(() -> new ResourceNotFoundException("Guard not found"));
        String email = guard.getUser() == null ? guard.getEmail() : guard.getUser().getEmail();
        User user = users.findForPasswordChange(email)
                .orElseThrow(() -> new IllegalStateException("This guard has no login account"));
        if (user.getRole() != Role.SECURITY_GUARD)
            throw new IllegalArgumentException("Only security guard passwords can be reset here");
        if (!validPassword(temporaryPassword))
            throw new IllegalStateException("A valid temporary guard password must be configured on the server");
        user.setPassword(encoder.encode(temporaryPassword));
        user.setMustChangePassword(true);
        user.setAuthVersion(user.getAuthVersion() + 1);
        users.save(user);
    }

    @Transactional
    public User change(String email, ChangePasswordRequest request) {
        User user = users.findForPasswordChange(email)
                .orElseThrow(() -> new ResourceNotFoundException("Account not found"));
        if (!encoder.matches(request.currentPassword(), user.getPassword()))
            throw new IllegalArgumentException("Current password is incorrect");
        if (!validPassword(request.newPassword()))
            throw new IllegalArgumentException("Use at least 12 characters and no more than 72 UTF-8 bytes");
        if (!request.newPassword().equals(request.confirmPassword()))
            throw new IllegalArgumentException("New passwords do not match");
        if (encoder.matches(request.newPassword(), user.getPassword())
                || request.newPassword().equals(temporaryPassword))
            throw new IllegalArgumentException("Choose a different password from the current or temporary password");
        user.setPassword(encoder.encode(request.newPassword()));
        user.setMustChangePassword(false);
        user.setAuthVersion(user.getAuthVersion() + 1);
        return users.save(user);
    }

    private boolean validPassword(String password) {
        return password != null && !password.isBlank() && password.length() >= 12
                && password.getBytes(StandardCharsets.UTF_8).length <= 72;
    }
}
