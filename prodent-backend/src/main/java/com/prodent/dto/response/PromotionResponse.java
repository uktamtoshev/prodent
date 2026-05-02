package com.prodent.dto.response;

import com.prodent.entity.Promotion;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record PromotionResponse(
        UUID id,
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
        String category,
        UUID serviceId,
        String discountType,
        Integer discount,
        BigDecimal discountAmount,
        BigDecimal price,
        BigDecimal oldPrice,
        String currency,
        UUID clinicId,
        UUID doctorId,
        List<String> targetCities,
        List<String> targetDistricts,
        String targetAudience,
        OffsetDateTime validFrom,
        OffsetDateTime validUntil,
        String status,
        Boolean active,
        Boolean isFeatured,
        Integer priority,
        Integer maxImpressions,
        Integer maxBookings,
        Long impressions,
        Long clicks,
        Integer bookings,
        Double ctr,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
    public static PromotionResponse from(Promotion p) {
        long imp = p.getImpressions() == null ? 0L : p.getImpressions();
        long cl = p.getClicks() == null ? 0L : p.getClicks();
        double ctr = imp > 0 ? (cl * 100.0) / imp : 0.0;
        return new PromotionResponse(
                p.getId(),
                p.getTitle(), p.getTitleUz(), p.getTitleEn(),
                p.getDescription(), p.getDescriptionUz(), p.getDescriptionEn(),
                p.getTerms(),
                p.getImageUrl(),
                p.getBadgeLabel(), p.getCtaLabel(),
                p.getCategory(),
                p.getServiceId(),
                p.getDiscountType() != null ? p.getDiscountType().name() : "PERCENT",
                p.getDiscount(), p.getDiscountAmount(),
                p.getPrice(), p.getOldPrice(), p.getCurrency(),
                p.getClinicId(), p.getDoctorId(),
                p.getTargetCities(), p.getTargetDistricts(), p.getTargetAudience(),
                p.getValidFrom(), p.getValidUntil(),
                p.getStatus() != null ? p.getStatus().name() : "DRAFT",
                p.getActive(), p.getIsFeatured(),
                p.getPriority(), p.getMaxImpressions(), p.getMaxBookings(),
                imp, cl, p.getBookings(), Math.round(ctr * 100.0) / 100.0,
                p.getCreatedAt(), p.getUpdatedAt()
        );
    }
}
