package com.prodent.controller;

import com.prodent.dto.response.ClinicResponse;
import com.prodent.dto.response.DoctorResponse;
import com.prodent.dto.response.UserResponse;
import com.prodent.entity.AuditLog;
import com.prodent.entity.Clinic;
import com.prodent.entity.Doctor;
import com.prodent.entity.UserRole;
import com.prodent.exception.EntityNotFoundException;
import com.prodent.repository.AuditLogRepository;
import com.prodent.repository.ClinicRepository;
import com.prodent.repository.DoctorRepository;
import com.prodent.service.ClinicService;
import com.prodent.service.DashboardService;
import com.prodent.service.DoctorService;
import com.prodent.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin")
@PreAuthorize("hasRole('ADMIN') or hasRole('SUPER_ADMIN')")
@RequiredArgsConstructor
public class AdminController {

    private final UserService userService;
    private final ClinicService clinicService;
    private final DoctorService doctorService;
    private final DashboardService dashboardService;
    private final ClinicRepository clinicRepository;
    private final DoctorRepository doctorRepository;
    private final AuditLogRepository auditLogRepository;

    @GetMapping("/users")
    public ResponseEntity<Page<UserResponse>> listUsers(Pageable pageable) {
        Page<UserResponse> result = userService.searchUsers("", pageable);
        return ResponseEntity.ok(result);
    }

    @PutMapping("/users/{id}/roles")
    public ResponseEntity<Void> assignRole(@PathVariable UUID id,
                                           @RequestBody Map<String, String> body) {
        String roleName = body.get("role");
        UUID clinicId = body.containsKey("clinicId") ? UUID.fromString(body.get("clinicId")) : null;
        UserRole.AppRole role = UserRole.AppRole.valueOf(roleName.toUpperCase());
        userService.assignRole(id, role, clinicId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/clinics")
    public ResponseEntity<Page<ClinicResponse>> listAllClinics(Pageable pageable) {
        Page<ClinicResponse> result = clinicService.listClinics(null, null, pageable);
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

    @GetMapping("/doctors")
    public ResponseEntity<Page<DoctorResponse>> listAllDoctors(Pageable pageable) {
        Page<DoctorResponse> result = doctorService.searchDoctors(null, null, null, pageable);
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

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getSystemStats() {
        Map<String, Object> stats = dashboardService.getAdminDashboard();
        return ResponseEntity.ok(stats);
    }

    @GetMapping("/audit-logs")
    public ResponseEntity<Page<AuditLog>> getAuditLogs(@org.springframework.web.bind.annotation.RequestParam(required = false) String entityType,
                                                       @org.springframework.web.bind.annotation.RequestParam(required = false) UUID entityId,
                                                       Pageable pageable) {
        if (entityType != null && entityId != null) {
            Page<AuditLog> logs = auditLogRepository.findByEntityTypeAndEntityId(entityType, entityId, pageable);
            return ResponseEntity.ok(logs);
        }
        Page<AuditLog> logs = auditLogRepository.findAll(pageable);
        return ResponseEntity.ok(logs);
    }
}
