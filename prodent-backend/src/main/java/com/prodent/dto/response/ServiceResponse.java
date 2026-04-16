package com.prodent.dto.response;

import java.math.BigDecimal;
import java.util.UUID;

public record ServiceResponse(
        UUID id,
        String nameRu,
        String nameUz,
        String nameEn,
        String category,
        BigDecimal price,
        String currency,
        Integer duration,
        String description,
        Boolean isActive
) {}
