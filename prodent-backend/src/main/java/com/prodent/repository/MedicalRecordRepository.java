package com.prodent.repository;

import com.prodent.entity.MedicalRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface MedicalRecordRepository extends JpaRepository<MedicalRecord, UUID> {

    Page<MedicalRecord> findByPatientId(UUID patientId, Pageable pageable);

    Page<MedicalRecord> findByDoctorId(UUID doctorId, Pageable pageable);

    Page<MedicalRecord> findByClinicId(UUID clinicId, Pageable pageable);

    Page<MedicalRecord> findByPatientIdAndClinicId(UUID patientId, UUID clinicId, Pageable pageable);
}
