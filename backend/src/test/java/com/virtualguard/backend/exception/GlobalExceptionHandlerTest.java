package com.virtualguard.backend.exception;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.junit.jupiter.api.Assertions.assertEquals;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void missingResourceReturnsNotFound() {
        assertEquals(HttpStatus.NOT_FOUND,
                handler.handleNotFound(new ResourceNotFoundException("missing")).getStatusCode());
    }

    @Test
    void invalidStateReturnsConflict() {
        assertEquals(HttpStatus.CONFLICT,
                handler.handleConflict(new IllegalStateException("already reviewed")).getStatusCode());
    }

    @Test
    void invalidRefreshTokenReturnsUnauthorized() {
        assertEquals(HttpStatus.UNAUTHORIZED,
                handler.handleInvalidRefreshToken(new InvalidRefreshTokenException()).getStatusCode());
    }

    @Test
    void unexpectedFailureReturnsServerError() {
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR,
                handler.handleRuntime(new RuntimeException("database details")).getStatusCode());
    }
}
