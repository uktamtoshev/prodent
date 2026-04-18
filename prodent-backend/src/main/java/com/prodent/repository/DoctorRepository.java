package com.prodent.repository;

import com.prodent.entity.Doctor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DoctorRepository extends JpaRepository<Doctor, UUID> {

    Optional<Doctor> findByUserId(UUID userId);

    Page<Doctor> findByIsVerifiedTrue(Pageable pageable);

    @Query("SELECT d FROM Doctor d JOIN d.user u LEFT JOIN d.specialties s " +
           "WHERE LOWER(CONCAT(u.firstName, ' ', u.lastName)) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "OR LOWER(s.nameRu) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "OR LOWER(s.nameUz) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "OR LOWER(s.nameEn) LIKE LOWER(CONCAT('%', :query, '%'))")
    Page<Doctor> search(@Param("query") String query, Pageable pageable);

    @Query("SELECT d FROM Doctor d ORDER BY d.rating DESC")
    List<Doctor> findTopRated(Pageable pageable);

    @Query("SELECT d FROM Doctor d JOIN d.affiliations a WHERE a.clinic.id = :clinicId AND a.isActive = true")
    List<Doctor> findByClinicId(@Param("clinicId") UUID clinicId);

    /** Doctors whose subscription expires between from and to */
    @Query("SELECT d FROM Doctor d WHERE d.subscriptionExpiresAt BETWEEN :from AND :to")
    List<Doctor> findWithExpiringSubscription(@Param("from") OffsetDateTime from, @Param("to") OffsetDateTime to);
}
