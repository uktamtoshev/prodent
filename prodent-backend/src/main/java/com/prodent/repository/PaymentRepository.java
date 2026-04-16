package com.prodent.repository;

import com.prodent.entity.Payment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, UUID> {

    Page<Payment> findByClinicId(UUID clinicId, Pageable pageable);

    Page<Payment> findByPatientId(UUID patientId, Pageable pageable);

    List<Payment> findByClinicIdAndStatus(UUID clinicId, Payment.PaymentStatus status);
}
