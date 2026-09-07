package com.virtualguard.backend.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

class JwtTokenProviderTest {

    private JwtTokenProvider provider;

    @BeforeEach
    void setUp() {
        provider = new JwtTokenProvider(mock(UserDetailsService.class));
        String secret = Base64.getEncoder().encodeToString(
                "virtual-guard-test-secret-32-bytes-minimum".getBytes(StandardCharsets.UTF_8));
        ReflectionTestUtils.setField(provider, "secretKey", secret);
        ReflectionTestUtils.setField(provider, "accessExpirationMs", 60_000L);
        ReflectionTestUtils.setField(provider, "refreshExpirationMs", 120_000L);
        provider.init();
    }

    @Test
    void accessAndRefreshTokensCannotBeInterchanged() {
        UUID userId = UUID.randomUUID();
        String access = provider.generateAccessToken(userId, "guard@example.com", "SECURITY_GUARD");
        String refresh = provider.generateRefreshToken(userId, "guard@example.com");

        assertTrue(provider.isAccessToken(access));
        assertFalse(provider.isRefreshToken(access));
        assertTrue(provider.isRefreshToken(refresh));
        assertFalse(provider.isAccessToken(refresh));
    }

    @Test
    void tamperedTokenIsRejected() {
        String token = provider.generateAccessToken(UUID.randomUUID(), "guard@example.com", "SECURITY_GUARD");
        int signatureStart = token.lastIndexOf('.') + 1;
        char replacement = token.charAt(signatureStart) == 'a' ? 'b' : 'a';
        String tampered = token.substring(0, signatureStart) + replacement + token.substring(signatureStart + 1);

        assertFalse(provider.validateToken(tampered));
    }
}
