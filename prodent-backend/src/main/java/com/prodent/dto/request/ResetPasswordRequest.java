package com.prodent.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ResetPasswordRequest(
        @NotBlank(message = "Phone is required")
        String phone,

        @NotBlank(message = "Verification code is required")
        String code,

        @NotBlank(message = "New password is required")
        @Size(min = 12, max = 100, message = "Password must be between 12 and 100 characters")
        String newPassword
) {}
