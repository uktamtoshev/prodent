package com.prodent.repository;

import com.prodent.entity.DoctorReview;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface DoctorReviewRepository extends JpaRepository<DoctorReview, UUID> {

    Page<DoctorReview> findByDoctorId(UUID doctorId, Pageable pageable);

    Page<DoctorReview> findByDoctorIdAndIsApprovedTrue(UUID doctorId, Pageable pageable);

    @Query("SELECT COALESCE(AVG(r.rating), 0) FROM DoctorReview r WHERE r.doctorId = :doctorId AND r.isApproved = true")
    Double averageRatingByDoctorId(@Param("doctorId") UUID doctorId);
}
