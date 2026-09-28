package com.virtualguard.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import io.jsonwebtoken.JwtException;

@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider tokenProvider;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String token = resolveToken(request);
        try {
            if (token != null && tokenProvider.isAccessToken(token)) {
                Authentication auth = tokenProvider.getAuthentication(token);
                SecurityContextHolder.getContext().setAuthentication(auth);
                // A reset account may authenticate only to complete its password change.
                if (auth.getPrincipal() instanceof AccountPrincipal account
                        && account.isMustChangePassword()
                        && !java.util.Set.of("/api/auth/change-password", "/api/auth/me",
                                "/api/auth/login", "/api/auth/refresh").contains(request.getServletPath())) {
                    response.setStatus(403);
                    response.setContentType("application/json");
                    response.getWriter().write("{\"error\":\"Change your password before continuing\",\"code\":\"PASSWORD_CHANGE_REQUIRED\"}");
                    return;
                }
            }
        } catch (AuthenticationException | JwtException | IllegalArgumentException exception) {
            SecurityContextHolder.clearContext();
        }
        filterChain.doFilter(request, response);
    }

    private String resolveToken(HttpServletRequest request) {
        String bearer = request.getHeader("Authorization");
        if (bearer != null && bearer.startsWith("Bearer ")) {
            return bearer.substring(7);
        }
        return null;
    }
}
