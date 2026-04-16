package com.prodent.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record CreateTreatmentPlanRequest(
        @NotNull(message = "Patient ID is required")
        UUID patientId,

        @NotNull(message = "Clinic ID is required")
        UUID clinicId,

        @NotBlank(message = "Title is required")
        @Size(max = 255, message = "Title must not exceed 255 characters")
        String title,

        String description,

        @Valid
        @NotNull(message = "Items are required")
        @Size(min = 1, message = "At least one item is required")
        List<TreatmentPlanItemRequest> items
) {}
