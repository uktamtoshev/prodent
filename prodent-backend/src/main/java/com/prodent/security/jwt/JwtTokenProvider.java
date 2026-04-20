package com.prodent.security.jwt;

import com.prodent.config.AppProperties;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtTokenProvider {

    private final AppProperties appProperties;
    private SecretKey key;

    private static final Set<String> KNOWN_DEFAULTS = Set.of(
            "your-256-bit-secret-key-change-in-production-minimum-32-chars",
            "your-super-secret-jwt-key-minimum-32-characters-long-change-me"
    );

    @PostConstruct
    public void init() {
        String secret = appProperties.getJwt().getSecret();
        if (secret == null || secret.isBlank() || KNOWN_DEFAULTS.contains(secret)) {
            throw new IllegalStateException(
                    "JWT_SECRET is not configured or uses a known default. "
                    + "Set a unique secret via the JWT_SECRET environment variable (min 32 chars).");
        }
        if (secret.length() < 32) {
            throw new IllegalStateException(
                    "JWT_SECRET is too short (" + secret.length() + " chars). Minimum 32 characters required.");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateAccessToken(UUID userId, String email, List<String> roles) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + appProperties.getJwt().getAccessTokenExpiration());

        return Jwts.builder()
                .subject(userId.toString())
                .claim("email", email)
                .claim("roles", roles)
                .issuedAt(now)
                .expiration(expiry)
                .signWith(key)
                .compact();
    }

    public String generateRefreshToken(UUID userId) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + appProperties.getJwt().getRefreshTokenExpiration());

        // jti makes every refresh token unique even if generated in the same millisecond.
        // Without it, two calls in rapid succession (e.g., test + CI) produce identical JWTs,
        // causing duplicate-hash constraint violations on refresh_tokens.token_hash.
        return Jwts.builder()
                .id(UUID.randomUUID().toString())
                .subject(userId.toString())
                .issuedAt(now)
                .expiration(expiry)
                .signWith(key)
                .compact();
    }

    public boolean validateToken(String token) {
        try {
            Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException ex) {
            log.warn("Invalid JWT token: {}", ex.getMessage());
            return false;
        }
    }

    public UUID getUserIdFromToken(String token) {
        Claims claims = parseClaims(token);
        return UUID.fromString(claims.getSubject());
    }

    @SuppressWarnings("unchecked")
    public List<String> getRolesFromToken(String token) {
        Claims claims = parseClaims(token);
        return claims.get("roles", List.class);
    }

    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
