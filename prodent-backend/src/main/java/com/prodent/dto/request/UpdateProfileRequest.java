package com.prodent.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record UpdateProfileRequest(
        @Size(max = 100, message = "First name must not exceed 100 characters")
        String firstName,

        @Size(max = 100, message = "Last name must not exceed 100 characters")
        String lastName,

        @Size(max = 100, message = "Middle name must not exceed 100 characters")
        String middleName,

        @Email(message = "Invalid email format")
        String email,

        LocalDate dateOfBirth,

        String gender,

        @Size(max = 5, message = "Language must not exceed 5 characters")
        String language,

        @Size(max = 500, message = "Avatar URL must not exceed 500 characters")
        String avatarUrl
) {}
