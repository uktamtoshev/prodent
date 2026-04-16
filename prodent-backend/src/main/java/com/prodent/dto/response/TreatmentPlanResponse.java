package com.prodent.dto.response;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record TreatmentPlanResponse(
        UUID id,
        UUID patientId,
        String doctorName,
        String clinicName,
        String title,
        String description,
        String status,
        BigDecimal totalCost,
        String currency,
        List<TreatmentPlanItemResponse> items,
        OffsetDateTime createdAt
) {
    public record TreatmentPlanItemResponse(
            UUID id,
            UUID serviceId,
            Integer toothNumber,
            String description,
            Integer quantity,
            BigDecimal unitPrice,
            BigDecimal totalPrice,
            String status
    ) {}
}
