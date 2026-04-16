package com.prodent.controller;

import com.prodent.dto.request.CreateClinicRequest;
import com.prodent.dto.request.UpdateClinicRequest;
import com.prodent.dto.response.ClinicResponse;
import com.prodent.dto.response.DoctorResponse;
import com.prodent.dto.response.ServiceResponse;
import com.prodent.dto.response.UserResponse;
import com.prodent.service.ClinicService;
import com.prodent.service.DoctorService;
import com.prodent.service.ServiceManagementService;
import com.prodent.util.SecurityUtils;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/clinics")
@RequiredArgsConstructor
public class ClinicController {

    private final ClinicService clinicService;
    private final DoctorService doctorService;
    private final ServiceManagementService serviceManagementService;

    @PostMapping
    public ResponseEntity<ClinicResponse> createClinic(@Valid @RequestBody CreateClinicRequest request) {
        UUID userId = SecurityUtils.getCurrentUserId();
        ClinicResponse response = clinicService.createClinic(userId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ClinicResponse> getClinic(@PathVariable UUID id) {
        ClinicResponse response = clinicService.getClinic(id);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/slug/{slug}")
    public ResponseEntity<ClinicResponse> getClinicBySlug(@PathVariable String slug) {
        ClinicResponse response = clinicService.getClinicBySlug(slug);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('CLINIC_ADMIN')")
    public ResponseEntity<ClinicResponse> updateClinic(@PathVariable UUID id,
                                                       @Valid @RequestBody UpdateClinicRequest request) {
        UUID userId = SecurityUtils.getCurrentUserId();
        ClinicResponse response = clinicService.updateClinic(id, userId, request);
        return ResponseEntity.ok(response);
    }

    @GetMapping
    public ResponseEntity<Page<ClinicResponse>> listClinics(@RequestParam(required = false) String city,
                                                            @RequestParam(required = false) String country,
                                                            Pageable pageable) {
        Page<ClinicResponse> result = clinicService.listClinics(city, country, pageable);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/search")
    public ResponseEntity<Page<ClinicResponse>> searchClinics(@RequestParam String q, Pageable pageable) {
        Page<ClinicResponse> result = clinicService.searchClinics(q, pageable);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{id}/members")
    public ResponseEntity<List<UserResponse>> getClinicMembers(@PathVariable UUID id) {
        List<UserResponse> members = clinicService.getClinicMembers(id);
        return ResponseEntity.ok(members);
    }

    @GetMapping("/{id}/doctors")
    public ResponseEntity<List<DoctorResponse>> getClinicDoctors(@PathVariable UUID id) {
        List<DoctorResponse> doctors = doctorService.getDoctorsByClinic(id);
        return ResponseEntity.ok(doctors);
    }

    @GetMapping("/{id}/services")
    public ResponseEntity<List<ServiceResponse>> getClinicServices(@PathVariable UUID id) {
        List<ServiceResponse> services = serviceManagementService.getClinicServices(id);
        return ResponseEntity.ok(services);
    }
}
