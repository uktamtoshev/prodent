package com.prodent.dto.request;

import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record CreateDoctorProfileRequest(
        String bio,

        @PositiveOrZero(message = "Experience years must be zero or positive")
        Integer experienceYears,

        @Positive(message = "Consultation price must be positive")
        BigDecimal consultationPrice,

        List<UUID> specialtyIds
) {}
