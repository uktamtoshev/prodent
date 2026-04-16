package com.prodent.controller;

import com.prodent.dto.request.LoginRequest;
import com.prodent.dto.request.ResetPasswordRequest;
import com.prodent.dto.request.SendOtpRequest;
import com.prodent.dto.request.VerifyCodeRequest;
import com.prodent.dto.response.AuthResponse;
import com.prodent.dto.response.UserResponse;
import com.prodent.entity.User;
import com.prodent.entity.UserRole;
import com.prodent.repository.UserRepository;
import com.prodent.repository.UserRoleRepository;
import com.prodent.security.CustomUserDetails;
import com.prodent.service.AuthService;
import com.prodent.util.SecurityUtils;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final PasswordEncoder passwordEncoder;

    @PostMapping("/send-otp")
    public ResponseEntity<Map<String, Object>> sendOtp(@Valid @RequestBody SendOtpRequest request) {
        Map<String, Object> result = authService.sendOtp(request);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/verify-code")
    public ResponseEntity<AuthResponse> verifyCode(@Valid @RequestBody VerifyCodeRequest request) {
        AuthResponse response = authService.verifyCode(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, Object> body) {
        String email = (String) body.get("email");
        String password = (String) body.get("password");
        String fullName = (String) body.get("full_name");
        String phone = (String) body.get("phone");

        if (email == null && phone == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Email or phone is required"));
        }
        if (password == null || password.length() < 6) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Password must be at least 6 characters"));
        }

        // Check if user already exists
        if (email != null && userRepository.findByEmail(email.trim()).isPresent()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "User with this email already exists"));
        }
        if (phone != null && userRepository.findByPhone(phone.trim()).isPresent()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "User with this phone already exists"));
        }

        User user = new User();
        if (email != null) user.setEmail(email.trim());
        if (phone != null) user.setPhone(phone.trim());
        user.setPasswordHash(passwordEncoder.encode(password));

        if (fullName != null && !fullName.isBlank()) {
            String[] parts = fullName.trim().split("\\s+", 2);
            user.setFirstName(parts[0]);
            user.setLastName(parts.length > 1 ? parts[1] : "");
        } else {
            user.setFirstName(email != null ? email.split("@")[0] : "User");
            user.setLastName("");
        }

        user.setIsActive(true);
        user.setIsVerified(false);
        user.setLanguage("ru");
        user.setCountry("UZ");

        User saved = userRepository.save(user);

        // Assign default PATIENT role
        UserRole role = new UserRole();
        role.setUser(saved);
        role.setRole(UserRole.AppRole.PATIENT);
        userRoleRepository.save(role);

        // Generate auth response
        AuthResponse response = authService.login(
                new LoginRequest(email != null ? email : phone, null, password));
        return ResponseEntity.status(201).body(response);
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refreshToken(@RequestBody Map<String, String> body) {
        String refreshToken = body.get("refreshToken");
        AuthResponse response = authService.refreshToken(refreshToken);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout() {
        authService.logout(SecurityUtils.getCurrentUserId(), null);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/set-password")
    public ResponseEntity<Map<String, Object>> setPassword(@RequestBody Map<String, String> body) {
        String phone = body.get("phone");
        String password = body.get("password");

        if (phone == null || password == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "phone and password are required"));
        }

        User user = userRepository.findByPhone(phone.trim())
                .orElse(null);

        if (user == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "User not found"));
        }

        if (user.getPasswordHash() != null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Password already set. Use reset-password instead."));
        }

        user.setPasswordHash(passwordEncoder.encode(password));
        userRepository.save(user);

        return ResponseEntity.ok(Map.of("success", true));
    }

    @PostMapping("/send-reset-code")
    public ResponseEntity<Map<String, Object>> sendResetCode(@RequestBody Map<String, String> body) {
        String phone = body.get("phone");

        if (phone == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "phone is required"));
        }

        // Reuse the existing send-otp logic
        SendOtpRequest otpRequest = new SendOtpRequest(phone.trim());
        Map<String, Object> result = authService.sendOtp(otpRequest);

        return ResponseEntity.ok(result);
    }

    @PostMapping("/resend-code")
    public ResponseEntity<Map<String, Object>> resendCode(@RequestBody Map<String, String> body) {
        String phone = body.get("phone");

        if (phone == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "phone is required"));
        }

        // Reuse the existing send-otp logic for resending
        SendOtpRequest otpRequest = new SendOtpRequest(phone.trim());
        Map<String, Object> result = authService.sendOtp(otpRequest);

        return ResponseEntity.ok(result);
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser() {
        try {
            CustomUserDetails currentUser = SecurityUtils.getCurrentUser();
            User user = userRepository.findById(currentUser.getId())
                    .orElse(null);

            if (user == null) {
                return ResponseEntity.status(401).body(Map.of("error", "User not found"));
            }

            List<UserRole> roles = userRoleRepository.findByUserId(user.getId());
            List<String> roleNames = roles.stream()
                    .map(r -> r.getRole().name())
                    .toList();

            UserResponse response = new UserResponse(
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
                    roleNames,
                    user.getIsVerified(),
                    user.getCreatedAt()
            );

            return ResponseEntity.ok(response);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
    }
}
