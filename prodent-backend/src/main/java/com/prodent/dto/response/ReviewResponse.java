package com.prodent.dto.response;

import java.time.OffsetDateTime;
import java.util.UUID;

public record ReviewResponse(
        UUID id,
        String patientName,
        Integer rating,
        String comment,
        OffsetDateTime createdAt
) {}
