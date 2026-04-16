package com.prodent.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.util.UUID;

public record TreatmentPlanItemRequest(
        UUID serviceId,

        Integer toothNumber,

        @NotBlank(message = "Description is required")
        String description,

        @Positive(message = "Quantity must be positive")
        Integer quantity,

        @NotNull(message = "Unit price is required")
        @Positive(message = "Unit price must be positive")
        BigDecimal unitPrice
) {}
