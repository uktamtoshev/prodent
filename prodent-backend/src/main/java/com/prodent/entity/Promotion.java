package com.prodent.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "promotions")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Promotion {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String title;

    @Column(name = "title_uz")
    private String titleUz;

    @Column(name = "title_en")
    private String titleEn;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "description_uz", columnDefinition = "text")
    private String descriptionUz;

    @Column(name = "description_en", columnDefinition = "text")
    private String descriptionEn;

    @Column(columnDefinition = "text")
    private String terms;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    @Column(name = "badge_label", length = 50)
    private String badgeLabel;

    @Column(name = "cta_label", length = 80)
    private String ctaLabel;

    @Column(nullable = false)
    @Builder.Default
    private String category = "other";

    @Column(name = "service_id")
    private UUID serviceId;

    @Enumerated(EnumType.STRING)
    @Column(name = "discount_type", nullable = false)
    @Builder.Default
    private DiscountType discountType = DiscountType.PERCENT;

    @Column(nullable = false)
    @Builder.Default
    private Integer discount = 0;

    @Column(name = "discount_amount")
    private BigDecimal discountAmount;

    @Column(nullable = false)
    @Builder.Default
    private BigDecimal price = BigDecimal.ZERO;

    @Column(name = "old_price", nullable = false)
    @Builder.Default
    private BigDecimal oldPrice = BigDecimal.ZERO;

    @Column(nullable = false, length = 3)
    @Builder.Default
    private String currency = "UZS";

    @Column(name = "clinic_id")
    private UUID clinicId;

    @Column(name = "doctor_id")
    private UUID doctorId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "target_cities", columnDefinition = "jsonb")
    private List<String> targetCities;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "target_districts", columnDefinition = "jsonb")
    private List<String> targetDistricts;

    @Column(name = "target_audience", length = 20)
    @Builder.Default
    private String targetAudience = "ALL";

    @Column(name = "valid_from", nullable = false)
    @Builder.Default
    private OffsetDateTime validFrom = OffsetDateTime.now();

    @Column(name = "valid_until", nullable = false)
    private OffsetDateTime validUntil;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Status status = Status.DRAFT;

    @Column(nullable = false)
    @Builder.Default
    private Boolean active = true;

    @Column(name = "is_featured", nullable = false)
    @Builder.Default
    private Boolean isFeatured = false;

    @Column(nullable = false)
    @Builder.Default
    private Integer priority = 0;

    @Column(name = "max_impressions")
    private Integer maxImpressions;

    @Column(name = "max_bookings")
    private Integer maxBookings;

    @Column(nullable = false)
    @Builder.Default
    private Long impressions = 0L;

    @Column(nullable = false)
    @Builder.Default
    private Long clicks = 0L;

    @Column(nullable = false)
    @Builder.Default
    private Integer bookings = 0;

    @Column(name = "created_by")
    private UUID createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public enum Status { DRAFT, ACTIVE, PAUSED, EXPIRED, ARCHIVED }

    public enum DiscountType { PERCENT, FIXED }
}
