package com.prodent.dto.response;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record UserResponse(
        UUID id,
        String email,
        String phone,
        String firstName,
        String lastName,
        String middleName,
        String avatarUrl,
        String gender,
        LocalDate dateOfBirth,
        String language,
        String country,
        List<String> roles,
        Boolean isVerified,
        OffsetDateTime createdAt
) {}
