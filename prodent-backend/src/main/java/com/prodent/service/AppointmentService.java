package com.prodent.service;

import com.prodent.dto.request.CreateAppointmentRequest;
import com.prodent.dto.response.AppointmentResponse;
import com.prodent.entity.Appointment;
import com.prodent.entity.Clinic;
import com.prodent.entity.Doctor;
import com.prodent.entity.Notification;
import com.prodent.entity.User;
import com.prodent.exception.BadRequestException;
import com.prodent.exception.EntityNotFoundException;
import com.prodent.repository.AppointmentRepository;
import com.prodent.repository.ClinicRepository;
import com.prodent.repository.DoctorRepository;
import com.prodent.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AppointmentService {

    private final AppointmentRepository appointmentRepository;
    private final DoctorRepository doctorRepository;
    private final ClinicRepository clinicRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    @Transactional
    public AppointmentResponse createAppointment(UUID patientId, CreateAppointmentRequest request) {
        Doctor doctor = doctorRepository.findById(request.doctorId())
                .orElseThrow(() -> new EntityNotFoundException("Doctor", request.doctorId()));
        Clinic clinic = clinicRepository.findById(request.clinicId())
                .orElseThrow(() -> new EntityNotFoundException("Clinic", request.clinicId()));

        LocalTime endTime = request.startTime().plusMinutes(30); // default 30 min

        // Validate no time conflicts
        List<Appointment> existingAppointments = appointmentRepository
                .findByDoctorIdAndAppointmentDateAndStatus(
                        request.doctorId(), request.appointmentDate(), Appointment.AppointmentStatus.CONFIRMED);

        boolean hasConflict = existingAppointments.stream().anyMatch(existing ->
                request.startTime().isBefore(existing.getEndTime()) &&
                        endTime.isAfter(existing.getStartTime()));

        if (hasConflict) {
            throw new BadRequestException("Time slot is already booked for this doctor");
        }

        Appointment appointment = Appointment.builder()
                .patientId(patientId)
                .doctor(doctor)
                .clinic(clinic)
                .serviceId(request.serviceId())
                .appointmentDate(request.appointmentDate())
                .startTime(request.startTime())
                .endTime(endTime)
                .notes(request.notes())
                .status(Appointment.AppointmentStatus.PENDING)
                .build();

        appointment = appointmentRepository.save(appointment);

        // Send notification to doctor
        notificationService.sendNotification(
                doctor.getUser().getId(),
                Notification.NotificationType.APPOINTMENT,
                "New Appointment Request",
                "You have a new appointment request for " + request.appointmentDate(),
                Map.of("appointmentId", appointment.getId().toString())
        );

        log.info("Appointment created: {} for patient: {} with doctor: {}", appointment.getId(), patientId, request.doctorId());
        return mapToResponse(appointment);
    }

    @Transactional(readOnly = true)
    public AppointmentResponse getAppointment(UUID id) {
        Appointment appointment = appointmentRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Appointment", id));
        return mapToResponse(appointment);
    }

    @Transactional(readOnly = true)
    public Page<AppointmentResponse> getPatientAppointments(UUID patientId, Pageable pageable) {
        return appointmentRepository.findByPatientId(patientId, pageable).map(this::mapToResponse);
    }

    @Transactional(readOnly = true)
    public List<AppointmentResponse> getDoctorAppointments(UUID doctorId, LocalDate date) {
        Doctor doctor = doctorRepository.findById(doctorId)
                .orElseThrow(() -> new EntityNotFoundException("Doctor", doctorId));

        return appointmentRepository.findByDoctorIdAndAppointmentDateAndStatus(
                        doctorId, date, Appointment.AppointmentStatus.CONFIRMED).stream()
                .map(this::mapToResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public Page<AppointmentResponse> getClinicAppointments(UUID clinicId, LocalDate date, Pageable pageable) {
        return appointmentRepository.findByClinicId(clinicId, pageable).map(this::mapToResponse);
    }

    @Transactional
    public AppointmentResponse updateStatus(UUID appointmentId, Appointment.AppointmentStatus status, UUID userId) {
        Appointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new EntityNotFoundException("Appointment", appointmentId));

        appointment.setStatus(status);

        switch (status) {
            case CONFIRMED -> appointment.setConfirmedAt(OffsetDateTime.now());
            case COMPLETED -> appointment.setCompletedAt(OffsetDateTime.now());
            case CANCELLED -> appointment.setCancelledAt(OffsetDateTime.now());
            default -> { /* no additional timestamp updates */ }
        }

        appointment = appointmentRepository.save(appointment);

        // Notify patient about status change
        notificationService.sendNotification(
                appointment.getPatientId(),
                Notification.NotificationType.APPOINTMENT,
                "Appointment " + status.name(),
                "Your appointment status has been updated to " + status.name(),
                Map.of("appointmentId", appointmentId.toString(), "status", status.name())
        );

        log.info("Appointment {} status updated to {} by user {}", appointmentId, status, userId);
        return mapToResponse(appointment);
    }

    @Transactional
    public AppointmentResponse cancelAppointment(UUID id, UUID userId, String reason) {
        Appointment appointment = appointmentRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Appointment", id));

        appointment.setStatus(Appointment.AppointmentStatus.CANCELLED);
        appointment.setCancelReason(reason);
        appointment.setCancelledAt(OffsetDateTime.now());
        appointment = appointmentRepository.save(appointment);

        // Notify relevant parties
        UUID notifyUserId = appointment.getPatientId().equals(userId)
                ? appointment.getDoctor().getUser().getId()
                : appointment.getPatientId();

        notificationService.sendNotification(
                notifyUserId,
                Notification.NotificationType.APPOINTMENT,
                "Appointment Cancelled",
                "An appointment has been cancelled. Reason: " + (reason != null ? reason : "Not specified"),
                Map.of("appointmentId", id.toString())
        );

        log.info("Appointment {} cancelled by user {} with reason: {}", id, userId, reason);
        return mapToResponse(appointment);
    }

    private AppointmentResponse mapToResponse(Appointment appointment) {
        User patient = userRepository.findById(appointment.getPatientId()).orElse(null);
        String patientName = patient != null ? patient.getFullName() : "Unknown";

        Doctor doctor = appointment.getDoctor();
        String doctorName = doctor.getUser().getFullName();

        Clinic clinic = appointment.getClinic();

        return new AppointmentResponse(
                appointment.getId(),
                appointment.getPatientId(),
                patientName,
                doctor.getId(),
                doctorName,
                clinic.getId(),
                clinic.getName(),
                appointment.getServiceId(),
                appointment.getAppointmentDate(),
                appointment.getStartTime(),
                appointment.getEndTime(),
                appointment.getStatus().name(),
                appointment.getNotes(),
                appointment.getTotalPrice(),
                appointment.getCurrency(),
                appointment.getCreatedAt()
        );
    }
}
