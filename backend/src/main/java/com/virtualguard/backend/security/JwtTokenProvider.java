package com.virtualguard.backend.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;

import java.security.Key;
import java.util.Base64;
import java.util.Date;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class JwtTokenProvider {

    @Value("${app.jwt.secret}")
    private String secretKey;

    @Value("${app.jwt.access-expiration-ms}")
    private long accessExpirationMs;

    @Value("${app.jwt.refresh-expiration-ms}")
    private long refreshExpirationMs;

    private Key key;

    private final UserDetailsService userDetailsService;

    @PostConstruct
    protected void init() {
        byte[] decodedKey = Base64.getDecoder().decode(secretKey);
        this.key = Keys.hmacShaKeyFor(decodedKey);
    }

    public String generateAccessToken(UUID userId, String email, String role) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + accessExpirationMs);
        return Jwts.builder()
                .setSubject(email)
                .claim("userId", userId.toString())
                .claim("role", "ROLE_" + role)
                .claim("tokenType", "access")
                .claim("authVersion", versionFor(email))
                .setIssuedAt(now)
                .setExpiration(expiry)
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    public String generateRefreshToken(UUID userId, String email) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + refreshExpirationMs);
        return Jwts.builder()
                .setSubject(email)
                .claim("userId", userId.toString())
                .claim("tokenType", "refresh")
                .claim("authVersion", versionFor(email))
                .setIssuedAt(now)
                .setExpiration(expiry)
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    public Authentication getAuthentication(String token) {
        Claims claims = parseClaims(token);
        String email = claims.getSubject();
        UserDetails userDetails = userDetailsService.loadUserByUsername(email);
        if (!userDetails.isEnabled()) throw new org.springframework.security.authentication.DisabledException("Account is deactivated");
        long version = userDetails instanceof AccountPrincipal account ? account.getAuthVersion() : 0;
        Number tokenVersion = claims.get("authVersion", Number.class);
        if (version != (tokenVersion == null ? 0 : tokenVersion.longValue()))
            throw new org.springframework.security.authentication.BadCredentialsException("Session revoked. Please log in again.");
        return new UsernamePasswordAuthenticationToken(userDetails, "", userDetails.getAuthorities());
    }

    private long versionFor(String email) {
        UserDetails details = userDetailsService.loadUserByUsername(email);
        if (details == null) return 0; // supports non-account UserDetails providers
        if (!details.isEnabled()) throw new org.springframework.security.authentication.DisabledException("Account is deactivated");
        return details instanceof AccountPrincipal account ? account.getAuthVersion() : 0;
    }

    public String mediaTicket(String email, String filename) {
        return Jwts.builder().setId(java.util.UUID.randomUUID().toString()).setSubject(email).claim("tokenType", "media")
                .claim("file", filename).claim("authVersion", versionFor(email))
                .setIssuedAt(new Date()).setExpiration(new Date(System.currentTimeMillis() + 120_000))
                .signWith(key, SignatureAlgorithm.HS256).compact();
    }

    public boolean canReadMedia(String ticket, String filename) {
        try {
            Claims claims = parseClaims(ticket);
            return "media".equals(claims.get("tokenType")) && filename.equals(claims.get("file"))
                    && getAuthentication(ticket).isAuthenticated();
        } catch (JwtException | IllegalArgumentException | org.springframework.security.core.AuthenticationException exception) {
            return false;
        }
    }

    public boolean validateToken(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            log.debug("Invalid JWT: {}", e.getMessage());
            return false;
        }
    }

    public Claims parseClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(key)
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    public String getEmailFromToken(String token) {
        return parseClaims(token).getSubject();
    }

    public boolean isRefreshToken(String token) {
        return validateToken(token) && "refresh".equals(parseClaims(token).get("tokenType", String.class));
    }

    public boolean isAccessToken(String token) {
        return validateToken(token) && "access".equals(parseClaims(token).get("tokenType", String.class));
    }
}
