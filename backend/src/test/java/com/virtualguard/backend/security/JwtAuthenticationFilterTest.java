package com.virtualguard.backend.security;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class JwtAuthenticationFilterTest {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void removedUserTokenContinuesAsUnauthenticatedInsteadOfFailingFilter() throws Exception {
        JwtTokenProvider provider = mock(JwtTokenProvider.class);
        when(provider.isAccessToken("valid-but-stale")).thenReturn(true);
        when(provider.getAuthentication("valid-but-stale"))
                .thenThrow(new UsernameNotFoundException("removed user"));
        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(provider);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/jobs");
        request.addHeader("Authorization", "Bearer valid-but-stale");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(chain).doFilter(request, response);
    }
    @Test
    void resetAccountCannotUseApplicationUntilPasswordChanged() throws Exception {
        var user = new com.virtualguard.backend.entity.User();
        user.setEmail("guard@example.test"); user.setPassword("hash");
        user.setRole(com.virtualguard.backend.enums.Role.SECURITY_GUARD); user.setMustChangePassword(true);
        var principal = new AccountPrincipal(user, true);
        var auth = new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(principal, "", principal.getAuthorities());
        JwtTokenProvider provider = mock(JwtTokenProvider.class);
        when(provider.isAccessToken("restricted")).thenReturn(true);
        when(provider.getAuthentication("restricted")).thenReturn(auth);
        for (String path : java.util.List.of("/api/jobs", "/api/guards", "/api/video/file/ticket")) {
            var request = new MockHttpServletRequest("GET",path); request.setServletPath(path);
            request.addHeader("Authorization", "Bearer restricted");
            var response = new MockHttpServletResponse(); var chain = mock(FilterChain.class);
            new JwtAuthenticationFilter(provider).doFilter(request,response,chain);
            org.junit.jupiter.api.Assertions.assertEquals(403,response.getStatus());
            org.mockito.Mockito.verifyNoInteractions(chain);
        }
        for (String path : java.util.List.of("/api/auth/me", "/api/auth/change-password", "/api/auth/refresh")) {
            var request = new MockHttpServletRequest("POST",path); request.setServletPath(path);
            request.addHeader("Authorization", "Bearer restricted");
            var response = new MockHttpServletResponse(); var chain = mock(FilterChain.class);
            new JwtAuthenticationFilter(provider).doFilter(request,response,chain);
            verify(chain).doFilter(request,response);
        }
    }

}
