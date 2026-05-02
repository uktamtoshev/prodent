package com.prodent.controller;

import com.prodent.dto.response.ClinicResponse;
import com.prodent.dto.response.DoctorResponse;
import com.prodent.entity.AuditLog;
import com.prodent.entity.Clinic;
import com.prodent.entity.Doctor;
import com.prodent.exception.EntityNotFoundException;
import com.prodent.repository.AuditLogRepository;
import com.prodent.repository.ClinicRepository;
import com.prodent.repository.DoctorRepository;
import com.prodent.service.ClinicService;
import com.prodent.service.DoctorService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Moderation endpoints — for the MODERATOR role.
 *
 * <p>Subset of {@link AdminController} that does NOT include user-management
 * (assign role, list users) or system stats. MODERATOR can:
 * <ul>
 *   <li>List and verify clinics</li>
 *   <li>List and verify doctors</li>
 *   <li>Read audit logs</li>
 * </ul>
 *
 * <p>SUPER_ADMIN and ADMIN are also allowed to all moderator endpoints (so the
 * moderator UI can be reused under the admin role).
 *
 * <p>For doc/security: see {@code docs/roles.md} matrix row "Реклама/Отзывы/Блог".
 */
@RestController
@RequestMapping("/api/v1/moderator")
@PreAuthorize("hasAnyRole('MODERATOR', 'ADMIN', 'SUPER_ADMIN')")
@RequiredArgsConstructor
public class ModeratorController {

    private final ClinicService clinicService;
    private final DoctorService doctorService;
    private final ClinicRepository clinicRepository;
    private final DoctorRepository doctorRepository;
    private final AuditLogRepository auditLogRepository;

    @GetMapping("/clinics")
    public ResponseEntity<Page<ClinicResponse>> listClinics(
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String country,
            Pageable pageable) {
        Page<ClinicResponse> result = clinicService.listClinics(city, country, pageable);
        return ResponseEntity.ok(result);
    }

    @PutMapping("/clinics/{id}/verify")
    public ResponseEntity<Void> verifyClinic(@PathVariable UUID id) {
        Clinic clinic = clinicRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Clinic", id));
        clinic.setIsVerified(true);
        clinicRepository.save(clinic);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/clinics/{id}/reject")
    public ResponseEntity<Void> rejectClinic(@PathVariable UUID id,
                                             @RequestBody(required = false) java.util.Map<String, String> body) {
        Clinic clinic = clinicRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Clinic", id));
        clinic.setIsVerified(false);
        // reason can be persisted later via audit; kept lean here
        clinicRepository.save(clinic);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/doctors")
    public ResponseEntity<Page<DoctorResponse>> listDoctors(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String specialty,
            @RequestParam(required = false) String city,
            Pageable pageable) {
        Page<DoctorResponse> result = doctorService.searchDoctors(query, specialty, city, pageable);
        return ResponseEntity.ok(result);
    }

    @PutMapping("/doctors/{id}/verify")
    public ResponseEntity<Void> verifyDoctor(@PathVariable UUID id) {
        Doctor doctor = doctorRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Doctor", id));
        doctor.setIsVerified(true);
        doctorRepository.save(doctor);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/doctors/{id}/reject")
    public ResponseEntity<Void> rejectDoctor(@PathVariable UUID id,
                                             @RequestBody(required = false) java.util.Map<String, String> body) {
        Doctor doctor = doctorRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Doctor", id));
        doctor.setIsVerified(false);
        doctorRepository.save(doctor);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/audit-logs")
    public ResponseEntity<Page<AuditLog>> auditLogs(
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) UUID entityId,
            Pageable pageable) {
        if (entityType != null && entityId != null) {
            return ResponseEntity.ok(auditLogRepository.findByEntityTypeAndEntityId(entityType, entityId, pageable));
        }
        return ResponseEntity.ok(auditLogRepository.findAll(pageable));
    }
}
