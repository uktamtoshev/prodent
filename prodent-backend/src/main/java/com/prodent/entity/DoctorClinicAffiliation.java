package com.prodent.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "doctor_clinic_affiliations",
        uniqueConstraints = @UniqueConstraint(columnNames = {"doctor_id", "clinic_id"}))
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class DoctorClinicAffiliation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "doctor_id", nullable = false)
    private Doctor doctor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "clinic_id", nullable = false)
    private Clinic clinic;

    @Enumerated(EnumType.STRING)
    @Column(name = "cooperation_type", nullable = false, columnDefinition = "cooperation_type")
    @Builder.Default
    private CooperationType cooperationType = CooperationType.STAFF_DOCTOR;

    @Column(name = "salary_percent")
    private BigDecimal salaryPercent;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "started_at", nullable = false)
    @Builder.Default
    private OffsetDateTime startedAt = OffsetDateTime.now();

    @Column(name = "ended_at")
    private OffsetDateTime endedAt;

    public enum CooperationType {
        STAFF_DOCTOR, CHAIR_RENTAL
    }
}
