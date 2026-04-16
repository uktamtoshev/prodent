package com.prodent.dto.response;

import java.time.OffsetDateTime;
import java.util.UUID;

public record MedicalRecordResponse(
        UUID id,
        UUID patientId,
        UUID doctorId,
        String doctorName,
        UUID clinicId,
        String clinicName,
        UUID appointmentId,
        String diagnosis,
        String treatment,
        String notes,
        OffsetDateTime createdAt
) {}
