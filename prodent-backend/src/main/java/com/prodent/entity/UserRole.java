package com.prodent.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "user_roles", uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "role", "clinic_id"}))
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class UserRole {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "app_role")
    private AppRole role;

    @Column(name = "clinic_id")
    private UUID clinicId;

    @Column(name = "granted_at", nullable = false)
    @Builder.Default
    private OffsetDateTime grantedAt = OffsetDateTime.now();

    @Column(name = "granted_by")
    private UUID grantedBy;

    public enum AppRole {
        SUPER_ADMIN, ADMIN, MODERATOR, CLINIC_ADMIN,
        DOCTOR, PATIENT, ASSISTANT, ACCOUNTANT, CLINIC_MANAGER
    }
}
