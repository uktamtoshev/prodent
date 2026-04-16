package com.prodent.dto.request;

import jakarta.validation.constraints.NotBlank;

public record SendOtpRequest(
        @NotBlank(message = "Phone is required")
        String phone
) {}
