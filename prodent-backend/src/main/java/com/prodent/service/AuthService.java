package com.prodent.service;

import com.prodent.config.AppProperties;
import com.prodent.dto.request.LoginRequest;
import com.prodent.dto.request.ResetPasswordRequest;
import com.prodent.dto.request.SendOtpRequest;
import com.prodent.dto.request.VerifyCodeRequest;
import com.prodent.dto.response.AuthResponse;
import com.prodent.dto.response.UserResponse;
import com.prodent.entity.PhoneVerification;
import com.prodent.entity.RefreshToken;
import com.prodent.entity.User;
import com.prodent.entity.UserRole;
import com.prodent.exception.BadRequestException;
import com.prodent.exception.EntityNotFoundException;
import com.prodent.exception.RateLimitExceededException;
import com.prodent.exception.UnauthorizedException;
import com.prodent.repository.PhoneVerificationRepository;
import com.prodent.repository.RefreshTokenRepository;
import com.prodent.repository.UserRepository;
import com.prodent.repository.UserRoleRepository;
import com.prodent.security.RateLimiter;
import com.prodent.security.jwt.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PhoneVerificationRepository phoneVerificationRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final AppProperties appProperties;
    private final RateLimiter rateLimiter;

    @Transactional
    public Map<String, Object> sendOtp(SendOtpRequest request) {
        String phone = request.phone().trim();
        validatePhoneFormat(phone);

        if (!rateLimiter.isAllowed("otp:" + phone,
                appProperties.getRateLimit().getOtpMaxRequests(),
                appProperties.getRateLimit().getOtpWindowMinutes())) {
            throw new RateLimitExceededException("Too many OTP requests. Please try again later.");
        }

        String code = String.format("%06d", ThreadLocalRandom.current().nextInt(0, 1_000_000));

        PhoneVerification verification = PhoneVerification.builder()
                .phone(phone)
                .code(code)
                .verificationType(PhoneVerification.VerificationType.PHONE)
                .expiresAt(OffsetDateTime.now().plusMinutes(5))
                .build();
        phoneVerificationRepository.save(verification);

        // TODO: integrate SMS provider to send the code
        log.info("OTP code generated for phone: {} (code: {} - remove in production)", maskPhone(phone), code);

        Map<String, Object> result = new HashMap<>();
        result.put("maskedPhone", maskPhone(phone));
        result.put("expiresIn", 300);
        return result;
    }

    @Transactional
    public AuthResponse verifyCode(VerifyCodeRequest request) {
        String phone = request.phone().trim();
        String code = request.code().trim();

        List<PhoneVerification> verifications =
                phoneVerificationRepository.findByPhoneAndIsVerifiedFalseOrderByCreatedAtDesc(phone);

        if (verifications.isEmpty()) {
            throw new BadRequestException("No pending verification found for this phone number");
        }

        PhoneVerification verification = verifications.get(0);

        if (verification.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new BadRequestException("Verification code has expired");
        }

        if (verification.getAttempts() >= 5) {
            throw new BadRequestException("Too many verification attempts");
        }

        verification.setAttempts(verification.getAttempts() + 1);

        if (!verification.getCode().equals(code)) {
            phoneVerificationRepository.save(verification);
            throw new BadRequestException("Invalid verification code");
        }

        verification.setIsVerified(true);
        phoneVerificationRepository.save(verification);

        User user = userRepository.findByPhone(phone).orElseGet(() -> {
            User newUser = User.builder()
                    .phone(phone)
                    .firstName("User")
                    .lastName("")
                    .isVerified(true)
                    .build();
            newUser = userRepository.save(newUser);

            UserRole patientRole = UserRole.builder()
                    .user(newUser)
                    .role(UserRole.AppRole.PATIENT)
                    .build();
            userRoleRepository.save(patientRole);

            return newUser;
        });

        if (!Boolean.TRUE.equals(user.getIsVerified())) {
            user.setIsVerified(true);
            userRepository.save(user);
        }

        return generateAuthResponse(user);
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        String login = request.getEffectiveLogin();
        if (login == null || login.isBlank()) {
            throw new BadRequestException("Login (email or phone) is required");
        }
        login = login.trim();

        if (!rateLimiter.isAllowed("login:" + login,
                appProperties.getRateLimit().getLoginMaxAttempts(),
                appProperties.getRateLimit().getLoginLockMinutes())) {
            throw new RateLimitExceededException("Too many login attempts. Account temporarily locked.");
        }

        User user = userRepository.findByEmailOrPhone(login, login)
                .orElseThrow(() -> new UnauthorizedException("Invalid credentials"));

        if (user.getPasswordHash() == null || !passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new UnauthorizedException("Invalid credentials");
        }

        if (!Boolean.TRUE.equals(user.getIsActive())) {
            throw new UnauthorizedException("Account is deactivated");
        }

        user.setLastLoginAt(OffsetDateTime.now());
        userRepository.save(user);

        return generateAuthResponse(user);
    }

    @Transactional
    public AuthResponse refreshToken(String refreshToken) {
        if (!jwtTokenProvider.validateToken(refreshToken)) {
            throw new UnauthorizedException("Invalid refresh token");
        }

        String tokenHash = hashToken(refreshToken);
        RefreshToken storedToken = refreshTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new UnauthorizedException("Refresh token not found"));

        if (storedToken.getRevokedAt() != null) {
            throw new UnauthorizedException("Refresh token has been revoked");
        }

        if (storedToken.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new UnauthorizedException("Refresh token has expired");
        }

        // Revoke old refresh token
        storedToken.setRevokedAt(OffsetDateTime.now());
        refreshTokenRepository.save(storedToken);

        UUID userId = jwtTokenProvider.getUserIdFromToken(refreshToken);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User", userId));

        return generateAuthResponse(user);
    }

    @Transactional
    public void logout(UUID userId, String refreshToken) {
        if (refreshToken != null && !refreshToken.isBlank()) {
            // Revoke specific token
            String tokenHash = hashToken(refreshToken);
            refreshTokenRepository.findByTokenHash(tokenHash).ifPresent(token -> {
                token.setRevokedAt(OffsetDateTime.now());
                refreshTokenRepository.save(token);
            });
        } else {
            // No token provided — revoke ALL active refresh tokens for this user
            // This ensures logout actually invalidates the session
            refreshTokenRepository.revokeAllByUserId(userId, OffsetDateTime.now());
        }
        log.info("User {} logged out (refreshToken {})", userId, refreshToken != null ? "revoked" : "all revoked");
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        String phone = request.phone().trim();
        String code = request.code().trim();

        // Find unverified OTP entries for this phone, newest first
        List<PhoneVerification> verifications =
                phoneVerificationRepository.findByPhoneAndIsVerifiedFalseOrderByCreatedAtDesc(phone);

        PhoneVerification verification = verifications.stream()
                .filter(v -> v.getCode().equals(code))
                .findFirst()
                .orElseThrow(() -> new BadRequestException("Invalid verification code"));

        // Check expiry
        if (verification.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new BadRequestException("Verification code has expired");
        }

        // Check attempts
        if (verification.getAttempts() >= 5) {
            throw new BadRequestException("Too many verification attempts");
        }

        verification.setAttempts(verification.getAttempts() + 1);

        // Mark code as used
        verification.setIsVerified(true);
        phoneVerificationRepository.save(verification);

        // Now safe to reset password
        User user = userRepository.findByPhone(phone)
                .orElseThrow(() -> new EntityNotFoundException("User not found with phone: " + phone));

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);

        log.info("Password reset for user: {}", user.getId());
    }

    /**
     * Public entry point for registration flow — generates tokens without
     * going through the login rate-limiter.
     */
    @Transactional
    public AuthResponse generateAuthResponseForUser(User user) {
        return generateAuthResponse(user);
    }

    private AuthResponse generateAuthResponse(User user) {
        List<UserRole> roles = userRoleRepository.findByUserId(user.getId());
        List<String> roleNames = roles.stream()
                .map(r -> r.getRole().name())
                .toList();

        String accessToken = jwtTokenProvider.generateAccessToken(user.getId(), user.getEmail(), roleNames);
        String refreshTokenStr = jwtTokenProvider.generateRefreshToken(user.getId());

        RefreshToken refreshTokenEntity = RefreshToken.builder()
                .userId(user.getId())
                .tokenHash(hashToken(refreshTokenStr))
                .expiresAt(OffsetDateTime.now().plusSeconds(
                        appProperties.getJwt().getRefreshTokenExpiration() / 1000))
                .build();
        refreshTokenRepository.save(refreshTokenEntity);

        UserResponse userResponse = mapToUserResponse(user, roleNames);

        return new AuthResponse(
                accessToken,
                refreshTokenStr,
                appProperties.getJwt().getAccessTokenExpiration() / 1000,
                userResponse
        );
    }

    private UserResponse mapToUserResponse(User user, List<String> roles) {
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getPhone(),
                user.getFirstName(),
                user.getLastName(),
                user.getMiddleName(),
                user.getAvatarUrl(),
                user.getGender() != null ? user.getGender().name() : null,
                user.getDateOfBirth(),
                user.getLanguage(),
                user.getCountry(),
                roles,
                user.getIsVerified(),
                user.getCreatedAt()
        );
    }

    private void validatePhoneFormat(String phone) {
        if (!phone.startsWith("+998") || phone.length() != 13) {
            throw new BadRequestException("Invalid phone format. Must start with +998 and be 13 characters");
        }
    }

    private String maskPhone(String phone) {
        if (phone.length() < 7) return phone;
        return phone.substring(0, 4) + "***" + phone.substring(phone.length() - 4);
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes());
            return Base64.getEncoder().encodeToString(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("Failed to hash token", e);
        }
    }
}
