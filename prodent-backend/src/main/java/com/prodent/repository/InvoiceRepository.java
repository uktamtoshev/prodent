package com.prodent.repository;

import com.prodent.entity.Invoice;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface InvoiceRepository extends JpaRepository<Invoice, UUID> {

    Page<Invoice> findByClinicId(UUID clinicId, Pageable pageable);

    Page<Invoice> findByPatientId(UUID patientId, Pageable pageable);

    Optional<Invoice> findByInvoiceNumber(String invoiceNumber);

    List<Invoice> findByClinicIdAndStatus(UUID clinicId, Invoice.InvoiceStatus status);
}
