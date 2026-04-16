package com.prodent.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "services")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Service {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "clinic_id", nullable = false)
    private UUID clinicId;

    @Column(name = "name_ru", nullable = false)
    private String nameRu;

    @Column(name = "name_uz")
    private String nameUz;

    @Column(name = "name_en")
    private String nameEn;

    @Column(length = 100)
    private String category;

    @Column(nullable = false)
    private BigDecimal price;

    @Column(length = 3)
    @Builder.Default
    private String currency = "UZS";

    @Builder.Default
    private Integer duration = 30;

    private String description;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
