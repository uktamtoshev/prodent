package com.prodent.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "virtual_accounts")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class VirtualAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(name = "owner_type", nullable = false, length = 50)
    private String ownerType;

    @Column(name = "clinic_id")
    private UUID clinicId;

    @Column(nullable = false)
    @Builder.Default
    private BigDecimal balance = BigDecimal.ZERO;

    @Column(length = 3)
    @Builder.Default
    private String currency = "UZS";

    @Version
    @Column(name = "version")
    @Builder.Default
    private Long version = 0L;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
