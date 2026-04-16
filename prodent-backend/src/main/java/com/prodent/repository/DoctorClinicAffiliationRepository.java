package com.prodent.repository;

import com.prodent.entity.DoctorClinicAffiliation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DoctorClinicAffiliationRepository extends JpaRepository<DoctorClinicAffiliation, UUID> {

    List<DoctorClinicAffiliation> findByDoctorId(UUID doctorId);

    List<DoctorClinicAffiliation> findByClinicId(UUID clinicId);

    Optional<DoctorClinicAffiliation> findByDoctorIdAndClinicId(UUID doctorId, UUID clinicId);

    List<DoctorClinicAffiliation> findByClinicIdAndIsActiveTrue(UUID clinicId);
}
