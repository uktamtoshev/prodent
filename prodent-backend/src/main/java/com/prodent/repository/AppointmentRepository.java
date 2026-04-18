package com.prodent.repository;

import com.prodent.entity.Appointment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface AppointmentRepository extends JpaRepository<Appointment, UUID> {

    Page<Appointment> findByPatientId(UUID patientId, Pageable pageable);

    Page<Appointment> findByDoctorId(UUID doctorId, Pageable pageable);

    Page<Appointment> findByClinicId(UUID clinicId, Pageable pageable);

    List<Appointment> findByClinicIdAndAppointmentDate(UUID clinicId, LocalDate appointmentDate);

    List<Appointment> findByDoctorIdAndAppointmentDateAndStatus(UUID doctorId, LocalDate appointmentDate, Appointment.AppointmentStatus status);

    List<Appointment> findByDoctorIdAndAppointmentDate(UUID doctorId, LocalDate appointmentDate);

    long countByClinicIdAndStatus(UUID clinicId, Appointment.AppointmentStatus status);

    boolean existsByDoctorIdAndPatientId(UUID doctorId, UUID patientId);

    @Query("SELECT a FROM Appointment a WHERE a.appointmentDate >= CURRENT_DATE " +
           "AND a.status IN (com.prodent.entity.Appointment.AppointmentStatus.PENDING, " +
           "com.prodent.entity.Appointment.AppointmentStatus.CONFIRMED) " +
           "AND a.patientId = :patientId ORDER BY a.appointmentDate ASC, a.startTime ASC")
    List<Appointment> findUpcoming(@Param("patientId") UUID patientId);

    /** Appointments tomorrow with CONFIRMED status — for 24h reminders */
    @Query("SELECT a FROM Appointment a WHERE a.appointmentDate = :date " +
           "AND a.status = com.prodent.entity.Appointment.AppointmentStatus.CONFIRMED")
    List<Appointment> findConfirmedByDate(@Param("date") LocalDate date);

    /** Appointments completed recently — for review requests */
    @Query("SELECT a FROM Appointment a WHERE a.status = com.prodent.entity.Appointment.AppointmentStatus.COMPLETED " +
           "AND a.completedAt BETWEEN :from AND :to")
    List<Appointment> findCompletedBetween(@Param("from") OffsetDateTime from, @Param("to") OffsetDateTime to);
}
