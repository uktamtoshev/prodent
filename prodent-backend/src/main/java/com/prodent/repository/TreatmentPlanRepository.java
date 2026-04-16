package com.prodent.repository;

import com.prodent.entity.TreatmentPlan;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface TreatmentPlanRepository extends JpaRepository<TreatmentPlan, UUID> {

    Page<TreatmentPlan> findByPatientId(UUID patientId, Pageable pageable);

    Page<TreatmentPlan> findByDoctorId(UUID doctorId, Pageable pageable);

    Page<TreatmentPlan> findByClinicId(UUID clinicId, Pageable pageable);

    List<TreatmentPlan> findByPatientIdAndStatus(UUID patientId, TreatmentPlan.PlanStatus status);
}
