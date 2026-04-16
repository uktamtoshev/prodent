package com.prodent.controller;

import com.prodent.dto.request.CreateMedicalRecordRequest;
import com.prodent.dto.response.MedicalRecordResponse;
import com.prodent.service.MedicalRecordService;
import com.prodent.util.SecurityUtils;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/medical-records")
@RequiredArgsConstructor
public class MedicalRecordController {

    private final MedicalRecordService medicalRecordService;

    @PostMapping
    @PreAuthorize("hasRole('DOCTOR')")
    public ResponseEntity<MedicalRecordResponse> createRecord(@Valid @RequestBody CreateMedicalRecordRequest request) {
        UUID userId = SecurityUtils.getCurrentUserId();
        MedicalRecordResponse response = medicalRecordService.createRecord(userId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/patient/{patientId}")
    public ResponseEntity<List<MedicalRecordResponse>> getPatientRecords(@PathVariable UUID patientId) {
        UUID requesterId = SecurityUtils.getCurrentUserId();
        List<MedicalRecordResponse> records = medicalRecordService.getPatientRecords(patientId, requesterId);
        return ResponseEntity.ok(records);
    }

    @GetMapping("/{id}")
    public ResponseEntity<MedicalRecordResponse> getRecord(@PathVariable UUID id) {
        MedicalRecordResponse response = medicalRecordService.getRecord(id);
        return ResponseEntity.ok(response);
    }
}
