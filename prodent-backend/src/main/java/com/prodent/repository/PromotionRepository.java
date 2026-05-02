package com.prodent.repository;

import com.prodent.entity.Promotion;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface PromotionRepository extends JpaRepository<Promotion, UUID> {

    @Query("""
        SELECT p FROM Promotion p
        WHERE (:status IS NULL OR p.status = :status)
          AND (:category IS NULL OR p.category = :category)
          AND (:clinicId IS NULL OR p.clinicId = :clinicId)
          AND (:doctorId IS NULL OR p.doctorId = :doctorId)
        ORDER BY p.isFeatured DESC, p.priority DESC, p.createdAt DESC
    """)
    Page<Promotion> searchAdmin(@Param("status") Promotion.Status status,
                                @Param("category") String category,
                                @Param("clinicId") UUID clinicId,
                                @Param("doctorId") UUID doctorId,
                                Pageable pageable);

    @Query("""
        SELECT p FROM Promotion p
        WHERE p.active = TRUE
          AND p.status = com.prodent.entity.Promotion$Status.ACTIVE
          AND p.validFrom <= :now
          AND p.validUntil >= :now
          AND (:category IS NULL OR p.category = :category)
        ORDER BY p.isFeatured DESC, p.priority DESC, p.discount DESC, p.createdAt DESC
    """)
    List<Promotion> findActiveForPublic(@Param("now") OffsetDateTime now,
                                        @Param("category") String category,
                                        Pageable pageable);

    long countByStatus(Promotion.Status status);

    @Modifying
    @Query("UPDATE Promotion p SET p.impressions = p.impressions + 1 WHERE p.id = :id")
    void incrementImpressions(@Param("id") UUID id);

    @Modifying
    @Query("UPDATE Promotion p SET p.clicks = p.clicks + 1 WHERE p.id = :id")
    void incrementClicks(@Param("id") UUID id);

    @Modifying
    @Query("""
        UPDATE Promotion p
        SET p.status = com.prodent.entity.Promotion$Status.EXPIRED
        WHERE p.status = com.prodent.entity.Promotion$Status.ACTIVE
          AND p.validUntil < :now
    """)
    int expireOutdated(@Param("now") OffsetDateTime now);
}
