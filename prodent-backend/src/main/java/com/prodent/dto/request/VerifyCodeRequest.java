package com.prodent.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record VerifyCodeRequest(
        @NotBlank(message = "Phone is required")
        String phone,

        @NotBlank(message = "Verification code is required")
        @Size(min = 4, max = 10, message = "Code must be between 4 and 10 characters")
        String code
) {}
