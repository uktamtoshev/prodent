package com.prodent.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record CreatePromotionRequest(
        @NotBlank(message = "Title is required")
        String title,
        String titleUz,
        String titleEn,

        String description,
        String descriptionUz,
        String descriptionEn,

        String terms,
        String imageUrl,
        String badgeLabel,
        String ctaLabel,

        @NotBlank(message = "Category is required")
        String category,

        UUID serviceId,

        String discountType,             // PERCENT | FIXED

        @Min(0) @Max(100)
        Integer discount,

        @PositiveOrZero
        BigDecimal discountAmount,

        @NotNull(message = "Price is required")
        @PositiveOrZero
        BigDecimal price,

        @PositiveOrZero
        BigDecimal oldPrice,

        String currency,

        UUID clinicId,
        UUID doctorId,

        List<String> targetCities,
        List<String> targetDistricts,
        String targetAudience,

        OffsetDateTime validFrom,

        @NotNull(message = "Valid-until date is required")
        OffsetDateTime validUntil,

        String status,                   // DRAFT|ACTIVE|PAUSED|EXPIRED|ARCHIVED
        Boolean active,
        Boolean isFeatured,

        @Min(0)
        Integer priority,

        Integer maxImpressions,
        Integer maxBookings
) {}
