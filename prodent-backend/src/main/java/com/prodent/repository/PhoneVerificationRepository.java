package com.prodent.repository;

import com.prodent.entity.PhoneVerification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface PhoneVerificationRepository extends JpaRepository<PhoneVerification, UUID> {

    List<PhoneVerification> findByPhoneAndIsVerifiedFalseOrderByCreatedAtDesc(String phone);

    @Query("SELECT COUNT(pv) FROM PhoneVerification pv WHERE pv.phone = :phone AND pv.createdAt >= :since")
    long countRecentByPhone(@Param("phone") String phone, @Param("since") OffsetDateTime since);
}
