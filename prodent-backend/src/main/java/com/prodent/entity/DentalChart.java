package com.prodent.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "dental_charts")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class DentalChart {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "patient_id", nullable = false)
    private UUID patientId;

    @Column(name = "doctor_id", nullable = false)
    private UUID doctorId;

    @Column(name = "clinic_id", nullable = false)
    private UUID clinicId;

    @Column(name = "tooth_number", nullable = false)
    private Integer toothNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ToothCondition condition;

    @Column(columnDefinition = "text")
    private String diagnosis;

    @Column(columnDefinition = "text")
    private String treatment;

    @Column(columnDefinition = "text")
    private String notes;

    @CreationTimestamp
    @Column(name = "recorded_at", nullable = false, updatable = false)
    private OffsetDateTime recordedAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public enum ToothCondition {
        HEALTHY, CARIES, FILLING, CROWN, MISSING, IMPLANT,
        ROOT_CANAL, BRIDGE, VENEER, EXTRACTION_NEEDED
    }
}
