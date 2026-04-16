package com.prodent.dto.request;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public record CreateAppointmentRequest(
        @NotNull(message = "Doctor ID is required")
        UUID doctorId,

        @NotNull(message = "Clinic ID is required")
        UUID clinicId,

        UUID serviceId,

        @NotNull(message = "Appointment date is required")
        LocalDate appointmentDate,

        @NotNull(message = "Start time is required")
        LocalTime startTime,

        String notes
) {}
