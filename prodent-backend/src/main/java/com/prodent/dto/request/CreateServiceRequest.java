package com.prodent.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

public record CreateServiceRequest(
        @NotBlank(message = "Russian name is required")
        String nameRu,

        String nameUz,

        String nameEn,

        String category,

        @NotNull(message = "Price is required")
        @Positive(message = "Price must be positive")
        BigDecimal price,

        @Positive(message = "Duration must be positive")
        Integer duration,

        String description
) {}
