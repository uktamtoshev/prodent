package com.prodent.repository;

import com.prodent.entity.Clinic;
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
public interface ClinicRepository extends JpaRepository<Clinic, UUID> {

    Optional<Clinic> findBySlug(String slug);

    List<Clinic> findByOwnerId(UUID ownerId);

    List<Clinic> findByCity(String city);

    List<Clinic> findByCityAndCountry(String city, String country);

    @Query("SELECT c FROM Clinic c WHERE LOWER(c.name) LIKE LOWER(CONCAT('%', :query, '%'))")
    Page<Clinic> searchByName(@Param("query") String query, Pageable pageable);

    Page<Clinic> findByIsVerifiedTrueAndIsActiveTrue(Pageable pageable);

    @Query("SELECT c.country, COUNT(c) FROM Clinic c GROUP BY c.country")
    List<Object[]> countByCountry();

    /** Clinics whose subscription expires between from and to */
    @Query("SELECT c FROM Clinic c WHERE c.subscriptionExpiresAt BETWEEN :from AND :to")
    List<Clinic> findWithExpiringSubscription(@Param("from") OffsetDateTime from, @Param("to") OffsetDateTime to);
}
