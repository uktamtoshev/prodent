package com.prodent.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Registration request. At least one of email or phone must be provided
 * (validated in the controller; cross-field constraint would need a class-level validator).
 */
public record RegisterRequest(
        @Email(message = "Invalid email format")
        @Size(max = 255, message = "Email must not exceed 255 characters")
        String email,

        @Pattern(regexp = "^\\+998\\d{9}$", message = "Phone must be in format +998XXXXXXXXX")
        String phone,

        @NotBlank(message = "Password is required")
        @Size(min = 12, max = 100, message = "Password must be between 12 and 100 characters")
        String password,

        @Size(max = 200, message = "Full name must not exceed 200 characters")
        String full_name,

        // UTM attribution (optional, sent by frontend from sessionStorage)
        @Size(max = 100) String utm_source,
        @Size(max = 100) String utm_medium,
        @Size(max = 200) String utm_campaign
) {}
