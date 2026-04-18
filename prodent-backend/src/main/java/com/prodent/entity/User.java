package com.prodent.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;

@Entity
@Table(name = "users")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(unique = true)
    private String email;

    @Column(unique = true, length = 20)
    private String phone;

    @Column(name = "password_hash")
    private String passwordHash;

    @Column(name = "first_name", nullable = false, length = 100)
    private String firstName;

    @Column(name = "last_name", nullable = false, length = 100)
    private String lastName;

    @Column(name = "middle_name", length = 100)
    private String middleName;

    @Column(name = "avatar_url", length = 500)
    private String avatarUrl;

    @Enumerated(EnumType.STRING)
    @Column(columnDefinition = "gender")
    private Gender gender;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "is_verified", nullable = false)
    @Builder.Default
    private Boolean isVerified = false;

    @Column(nullable = false, length = 5)
    @Builder.Default
    private String language = "ru";

    @Column(nullable = false, length = 5)
    @Builder.Default
    private String country = "UZ";

    @Column(name = "email_unsubscribed", nullable = false)
    @Builder.Default
    private Boolean emailUnsubscribed = false;

    // Referral
    @Column(name = "referral_code", unique = true, length = 20)
    private String referralCode;

    @Column(name = "invited_by")
    private UUID invitedBy;

    // UTM attribution (captured at registration)
    @Column(name = "utm_source", length = 100)
    private String utmSource;

    @Column(name = "utm_medium", length = 100)
    private String utmMedium;

    @Column(name = "utm_campaign", length = 200)
    private String utmCampaign;

    @Column(name = "last_login_at")
    private OffsetDateTime lastLoginAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @OneToMany(mappedBy = "user", fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @Builder.Default
    private Set<UserRole> roles = new HashSet<>();

    public String getFullName() {
        return firstName + " " + lastName;
    }

    public enum Gender {
        MALE, FEMALE
    }
}
