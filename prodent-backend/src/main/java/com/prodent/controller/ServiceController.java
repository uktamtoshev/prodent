package com.prodent.controller;

import com.prodent.dto.request.CreateServiceRequest;
import com.prodent.dto.response.ServiceResponse;
import com.prodent.service.ServiceManagementService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/clinics/{clinicId}/services")
@RequiredArgsConstructor
public class ServiceController {

    private final ServiceManagementService serviceManagementService;

    @PostMapping
    @PreAuthorize("hasRole('CLINIC_ADMIN')")
    public ResponseEntity<ServiceResponse> createService(@PathVariable UUID clinicId,
                                                         @Valid @RequestBody CreateServiceRequest request) {
        ServiceResponse response = serviceManagementService.createService(clinicId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<ServiceResponse>> getServices(@PathVariable UUID clinicId) {
        List<ServiceResponse> services = serviceManagementService.getClinicServices(clinicId);
        return ResponseEntity.ok(services);
    }

    @PutMapping("/{serviceId}")
    @PreAuthorize("hasRole('CLINIC_ADMIN')")
    public ResponseEntity<ServiceResponse> updateService(@PathVariable UUID clinicId,
                                                         @PathVariable UUID serviceId,
                                                         @Valid @RequestBody CreateServiceRequest request) {
        ServiceResponse response = serviceManagementService.updateService(serviceId, request);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{serviceId}")
    @PreAuthorize("hasRole('CLINIC_ADMIN')")
    public ResponseEntity<Void> deleteService(@PathVariable UUID clinicId,
                                              @PathVariable UUID serviceId) {
        serviceManagementService.deleteService(serviceId);
        return ResponseEntity.noContent().build();
    }
}
