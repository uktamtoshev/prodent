package com.prodent.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "specialties")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Specialty {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "name_ru", nullable = false)
    private String nameRu;

    @Column(name = "name_uz", nullable = false)
    private String nameUz;

    @Column(name = "name_en", nullable = false)
    private String nameEn;

    @Column(name = "name_kz")
    private String nameKz;

    @Column(name = "name_kg")
    private String nameKg;

    @Column(nullable = false, unique = true)
    private String slug;

    @Column(length = 100)
    private String icon;
}
