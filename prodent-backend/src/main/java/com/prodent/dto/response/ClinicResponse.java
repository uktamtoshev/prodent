package com.prodent.dto.response;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

public record ClinicResponse(
        UUID id,
        String name,
        String slug,
        String description,
        String logoUrl,
        String coverUrl,
        String phone,
        String email,
        String website,
        String address,
        String city,
        String country,
        BigDecimal latitude,
        BigDecimal longitude,
        Map<String, Object> workingHours,
        String subscriptionPlan,
        Boolean isVerified,
        BigDecimal rating,
        Integer reviewCount,
        OffsetDateTime createdAt
) {}
