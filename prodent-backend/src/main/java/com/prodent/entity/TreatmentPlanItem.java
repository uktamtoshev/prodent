package com.prodent.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "treatment_plan_items")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class TreatmentPlanItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "treatment_plan_id", nullable = false)
    private TreatmentPlan treatmentPlan;

    @Column(name = "service_id")
    private UUID serviceId;

    @Column(name = "tooth_number")
    private Integer toothNumber;

    @Column(nullable = false)
    private String description;

    @Builder.Default
    private Integer quantity = 1;

    @Column(name = "unit_price", nullable = false)
    private BigDecimal unitPrice;

    @Column(name = "total_price", nullable = false)
    private BigDecimal totalPrice;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private ItemStatus status = ItemStatus.PLANNED;

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;

    @Column(name = "sort_order")
    @Builder.Default
    private Integer sortOrder = 0;

    public enum ItemStatus {
        PLANNED, IN_PROGRESS, COMPLETED, CANCELLED
    }
}
