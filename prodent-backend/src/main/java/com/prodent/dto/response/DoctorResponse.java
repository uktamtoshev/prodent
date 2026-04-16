package com.prodent.dto.response;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record DoctorResponse(
        UUID id,
        UUID userId,
        String firstName,
        String lastName,
        String avatarUrl,
        String bio,
        Integer experienceYears,
        BigDecimal consultationPrice,
        String currency,
        List<SpecialtyResponse> specialties,
        Boolean isVerified,
        BigDecimal rating,
        Integer reviewCount,
        Boolean isAcceptingPatients
) {}
