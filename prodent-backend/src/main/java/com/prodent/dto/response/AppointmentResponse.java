package com.prodent.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.UUID;

public record AppointmentResponse(
        UUID id,
        UUID patientId,
        String patientName,
        UUID doctorId,
        String doctorName,
        UUID clinicId,
        String clinicName,
        UUID serviceId,
        LocalDate appointmentDate,
        LocalTime startTime,
        LocalTime endTime,
        String status,
        String notes,
        BigDecimal totalPrice,
        String currency,
        OffsetDateTime createdAt
) {}
