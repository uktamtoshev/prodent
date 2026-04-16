package com.prodent.repository;

import com.prodent.entity.DoctorSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface DoctorScheduleRepository extends JpaRepository<DoctorSchedule, UUID> {

    List<DoctorSchedule> findByDoctorIdAndClinicId(UUID doctorId, UUID clinicId);

    List<DoctorSchedule> findByDoctorIdAndClinicIdAndDayOfWeek(UUID doctorId, UUID clinicId, Integer dayOfWeek);
}
