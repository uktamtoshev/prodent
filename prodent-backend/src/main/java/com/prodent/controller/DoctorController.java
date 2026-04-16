package com.prodent.controller;

import com.prodent.dto.request.CreateDoctorProfileRequest;
import com.prodent.dto.response.DoctorResponse;
import com.prodent.service.DoctorService;
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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/doctors")
@RequiredArgsConstructor
public class DoctorController {

    private final DoctorService doctorService;

    @PostMapping("/profile")
    public ResponseEntity<DoctorResponse> createDoctorProfile(@Valid @RequestBody CreateDoctorProfileRequest request) {
        UUID userId = SecurityUtils.getCurrentUserId();
        DoctorResponse response = doctorService.createDoctorProfile(userId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<DoctorResponse> getDoctor(@PathVariable UUID id) {
        DoctorResponse response = doctorService.getDoctor(id);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/search")
    public ResponseEntity<Page<DoctorResponse>> searchDoctors(@RequestParam(required = false) String query,
                                                              @RequestParam(required = false) String specialty,
                                                              @RequestParam(required = false) String city,
                                                              Pageable pageable) {
        Page<DoctorResponse> result = doctorService.searchDoctors(query, specialty, city, pageable);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/top-rated")
    public ResponseEntity<List<DoctorResponse>> getTopRated(@RequestParam(defaultValue = "10") int limit) {
        List<DoctorResponse> doctors = doctorService.getTopRatedDoctors(limit);
        return ResponseEntity.ok(doctors);
    }

    @GetMapping("/me")
    @PreAuthorize("hasRole('DOCTOR')")
    public ResponseEntity<DoctorResponse> getMyProfile() {
        UUID userId = SecurityUtils.getCurrentUserId();
        DoctorResponse response = doctorService.getDoctorByUserId(userId);
        return ResponseEntity.ok(response);
    }
}
