package com.prodent.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record CreateMedicalRecordRequest(
        @NotNull(message = "Patient ID is required")
        UUID patientId,

        @NotNull(message = "Clinic ID is required")
        UUID clinicId,

        UUID appointmentId,

        @NotBlank(message = "Diagnosis is required")
        String diagnosis,

        @NotBlank(message = "Treatment is required")
        String treatment,

        String notes
) {}
