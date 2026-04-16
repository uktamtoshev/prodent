package com.prodent.repository;

import com.prodent.entity.ClinicReview;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface ClinicReviewRepository extends JpaRepository<ClinicReview, UUID> {

    Page<ClinicReview> findByClinicId(UUID clinicId, Pageable pageable);

    Page<ClinicReview> findByClinicIdAndIsApprovedTrue(UUID clinicId, Pageable pageable);

    @Query("SELECT COALESCE(AVG(r.rating), 0) FROM ClinicReview r WHERE r.clinicId = :clinicId AND r.isApproved = true")
    Double averageRatingByClinicId(@Param("clinicId") UUID clinicId);
}
