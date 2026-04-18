package com.prodent;

import com.prodent.dto.request.LoginRequest;
import com.prodent.dto.request.ResetPasswordRequest;
import com.prodent.dto.request.SendOtpRequest;
import com.prodent.dto.request.VerifyCodeRequest;
import com.prodent.dto.response.AuthResponse;
import com.prodent.entity.PhoneVerification;
import com.prodent.entity.User;
import com.prodent.entity.UserRole;
import com.prodent.exception.BadRequestException;
import com.prodent.exception.UnauthorizedException;
import com.prodent.repository.PhoneVerificationRepository;
import com.prodent.repository.UserRepository;
import com.prodent.repository.UserRoleRepository;
import com.prodent.service.AuthService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class AuthServiceTest extends BaseIntegrationTest {

    @Autowired AuthService authService;
    @Autowired UserRepository userRepository;
    @Autowired UserRoleRepository userRoleRepository;
    @Autowired PhoneVerificationRepository phoneVerificationRepository;
    @Autowired PasswordEncoder passwordEncoder;

    // ─── OTP ────────────────────────────────────────────────

    @Test
    void sendOtp_validPhone_returnsExpiresIn() {
        Map<String, Object> result = authService.sendOtp(new SendOtpRequest("+998901234567"));
        assertNotNull(result.get("maskedPhone"));
        assertEquals(300, result.get("expiresIn"));
    }

    @Test
    void sendOtp_invalidPhone_throws() {
        assertThrows(BadRequestException.class, () ->
                authService.sendOtp(new SendOtpRequest("+123456")));
    }

    // ─── Verify Code ────────────────────────────────────────

    @Test
    void verifyCode_validCode_returnsAuthResponse() {
        String phone = "+998901111111";
        authService.sendOtp(new SendOtpRequest(phone));

        // Get the code from DB (in test we can peek)
        PhoneVerification v = phoneVerificationRepository
                .findByPhoneAndIsVerifiedFalseOrderByCreatedAtDesc(phone).get(0);

        AuthResponse response = authService.verifyCode(new VerifyCodeRequest(phone, v.getCode()));
        assertNotNull(response.accessToken());
        assertNotNull(response.refreshToken());
        assertNotNull(response.user());
    }

    @Test
    void verifyCode_wrongCode_throws() {
        String phone = "+998902222222";
        authService.sendOtp(new SendOtpRequest(phone));

        assertThrows(BadRequestException.class, () ->
                authService.verifyCode(new VerifyCodeRequest(phone, "000000")));
    }

    // ─── Login ──────────────────────────────────────────────

    @Test
    void login_validCredentials_returnsTokens() {
        // Create a user with password
        User user = User.builder()
                .phone("+998903333333")
                .email("login-test@prodent.uz")
                .firstName("Test")
                .lastName("User")
                .passwordHash(passwordEncoder.encode("SuperSecretPass12"))
                .isActive(true)
                .isVerified(true)
                .build();
        user = userRepository.save(user);
        UserRole role = UserRole.builder().user(user).role(UserRole.AppRole.PATIENT).build();
        userRoleRepository.save(role);

        AuthResponse response = authService.login(
                new LoginRequest("login-test@prodent.uz", null, "SuperSecretPass12"));

        assertNotNull(response.accessToken());
        assertNotNull(response.user());
        assertEquals(user.getId(), response.user().id());
    }

    @Test
    void login_wrongPassword_throws() {
        User user = User.builder()
                .phone("+998904444444")
                .email("wrong-pass@prodent.uz")
                .firstName("Test")
                .lastName("User")
                .passwordHash(passwordEncoder.encode("CorrectPassword12"))
                .isActive(true)
                .isVerified(true)
                .build();
        userRepository.save(user);

        assertThrows(UnauthorizedException.class, () ->
                authService.login(new LoginRequest("wrong-pass@prodent.uz", null, "WrongPassword12")));
    }

    @Test
    void login_deactivatedUser_throws() {
        User user = User.builder()
                .phone("+998905555555")
                .email("deactivated@prodent.uz")
                .firstName("Test")
                .lastName("User")
                .passwordHash(passwordEncoder.encode("Password12345"))
                .isActive(false)
                .isVerified(true)
                .build();
        userRepository.save(user);

        assertThrows(UnauthorizedException.class, () ->
                authService.login(new LoginRequest("deactivated@prodent.uz", null, "Password12345")));
    }

    // ─── Reset Password (S-1 fix validation) ────────────────

    @Test
    void resetPassword_withoutValidOtp_throws() {
        // Create user
        User user = User.builder()
                .phone("+998906666666")
                .firstName("Reset")
                .lastName("Test")
                .passwordHash(passwordEncoder.encode("OldPassword1234"))
                .isActive(true)
                .build();
        userRepository.save(user);

        // Try to reset without sending OTP first — should throw
        assertThrows(BadRequestException.class, () ->
                authService.resetPassword(new ResetPasswordRequest("+998906666666", "123456", "NewPassword1234")));
    }

    @Test
    void resetPassword_withValidOtp_changesPassword() {
        String phone = "+998907777777";
        User user = User.builder()
                .phone(phone)
                .firstName("Reset2")
                .lastName("Test2")
                .passwordHash(passwordEncoder.encode("OldPassword1234"))
                .isActive(true)
                .build();
        userRepository.save(user);

        // Send OTP
        authService.sendOtp(new SendOtpRequest(phone));
        PhoneVerification v = phoneVerificationRepository
                .findByPhoneAndIsVerifiedFalseOrderByCreatedAtDesc(phone).get(0);

        // Reset with valid code
        authService.resetPassword(new ResetPasswordRequest(phone, v.getCode(), "NewPassword1234"));

        // Verify new password works
        User updated = userRepository.findByPhone(phone).orElseThrow();
        assertTrue(passwordEncoder.matches("NewPassword1234", updated.getPasswordHash()));
    }

    @Test
    void resetPassword_withExpiredOtp_throws() {
        String phone = "+998908888888";
        User user = User.builder()
                .phone(phone)
                .firstName("Expired")
                .lastName("Test")
                .passwordHash(passwordEncoder.encode("OldPassword1234"))
                .isActive(true)
                .build();
        userRepository.save(user);

        // Create an expired verification directly
        PhoneVerification expired = PhoneVerification.builder()
                .phone(phone)
                .code("999999")
                .verificationType(PhoneVerification.VerificationType.PHONE)
                .expiresAt(java.time.OffsetDateTime.now().minusMinutes(10))
                .build();
        phoneVerificationRepository.save(expired);

        assertThrows(BadRequestException.class, () ->
                authService.resetPassword(new ResetPasswordRequest(phone, "999999", "NewPassword1234")));
    }

    // ─── Refresh Token ──────────────────────────────────────

    @Test
    void refreshToken_valid_returnsNewTokens() {
        String phone = "+998909999999";
        authService.sendOtp(new SendOtpRequest(phone));
        PhoneVerification v = phoneVerificationRepository
                .findByPhoneAndIsVerifiedFalseOrderByCreatedAtDesc(phone).get(0);

        AuthResponse first = authService.verifyCode(new VerifyCodeRequest(phone, v.getCode()));

        AuthResponse refreshed = authService.refreshToken(first.refreshToken());
        assertNotNull(refreshed.accessToken());
        assertNotEquals(first.accessToken(), refreshed.accessToken());
    }

    @Test
    void refreshToken_afterLogout_throws() {
        String phone = "+998900000001";
        authService.sendOtp(new SendOtpRequest(phone));
        PhoneVerification v = phoneVerificationRepository
                .findByPhoneAndIsVerifiedFalseOrderByCreatedAtDesc(phone).get(0);

        AuthResponse auth = authService.verifyCode(new VerifyCodeRequest(phone, v.getCode()));

        // Logout (revoke all tokens)
        authService.logout(auth.user().id(), null);

        // Refresh should fail
        assertThrows(UnauthorizedException.class, () ->
                authService.refreshToken(auth.refreshToken()));
    }
}
