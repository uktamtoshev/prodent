package com.prodent.controller;

import com.prodent.dto.request.CreateAppointmentRequest;
import com.prodent.dto.response.AppointmentResponse;
import com.prodent.entity.Appointment;
import com.prodent.entity.Doctor;
import com.prodent.exception.EntityNotFoundException;
import com.prodent.repository.DoctorRepository;
import com.prodent.service.AppointmentService;
import com.prodent.util.SecurityUtils;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/appointments")
@RequiredArgsConstructor
public class AppointmentController {

    private final AppointmentService appointmentService;
    private final DoctorRepository doctorRepository;

    @PostMapping
    public ResponseEntity<AppointmentResponse> createAppointment(@Valid @RequestBody CreateAppointmentRequest request) {
        UUID patientId = SecurityUtils.getCurrentUserId();
        AppointmentResponse response = appointmentService.createAppointment(patientId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<AppointmentResponse> getAppointment(@PathVariable UUID id) {
        AppointmentResponse response = appointmentService.getAppointment(id);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/my")
    public ResponseEntity<Page<AppointmentResponse>> getMyAppointments(Pageable pageable) {
        UUID patientId = SecurityUtils.getCurrentUserId();
        Page<AppointmentResponse> result = appointmentService.getPatientAppointments(patientId, pageable);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/doctor")
    @PreAuthorize("hasRole('DOCTOR')")
    public ResponseEntity<List<AppointmentResponse>> getDoctorAppointments(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        UUID userId = SecurityUtils.getCurrentUserId();
        // S-14 fix: resolve Doctor entity from current user's ID
        Doctor doctor = doctorRepository.findByUserId(userId)
                .orElseThrow(() -> new EntityNotFoundException("Doctor profile not found for user: " + userId));
        List<AppointmentResponse> result = appointmentService.getDoctorAppointments(doctor.getId(), date);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/clinic/{clinicId}")
    @PreAuthorize("hasRole('CLINIC_ADMIN')")
    public ResponseEntity<Page<AppointmentResponse>> getClinicAppointments(
            @PathVariable UUID clinicId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            Pageable pageable) {
        Page<AppointmentResponse> result = appointmentService.getClinicAppointments(clinicId, date, pageable);
        return ResponseEntity.ok(result);
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<AppointmentResponse> updateStatus(@PathVariable UUID id,
                                                            @RequestParam String status) {
        UUID userId = SecurityUtils.getCurrentUserId();
        Appointment.AppointmentStatus appointmentStatus = Appointment.AppointmentStatus.valueOf(status.toUpperCase());
        AppointmentResponse response = appointmentService.updateStatus(id, appointmentStatus, userId);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}/cancel")
    public ResponseEntity<AppointmentResponse> cancelAppointment(@PathVariable UUID id,
                                                                 @RequestBody Map<String, String> body) {
        UUID userId = SecurityUtils.getCurrentUserId();
        String reason = body.get("reason");
        AppointmentResponse response = appointmentService.cancelAppointment(id, userId, reason);
        return ResponseEntity.ok(response);
    }
}
