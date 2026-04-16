package com.prodent.controller;

import com.prodent.dto.response.DashboardStatsResponse;
import com.prodent.service.DashboardService;
import com.prodent.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/clinic/{clinicId}")
    @PreAuthorize("hasRole('CLINIC_ADMIN')")
    public ResponseEntity<DashboardStatsResponse> getClinicDashboard(@PathVariable UUID clinicId) {
        DashboardStatsResponse response = dashboardService.getClinicDashboard(clinicId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/doctor")
    @PreAuthorize("hasRole('DOCTOR')")
    public ResponseEntity<DashboardStatsResponse> getDoctorDashboard() {
        UUID userId = SecurityUtils.getCurrentUserId();
        DashboardStatsResponse response = dashboardService.getDoctorDashboard(userId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/admin")
    @PreAuthorize("hasRole('ADMIN') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<Map<String, Object>> getAdminDashboard() {
        Map<String, Object> stats = dashboardService.getAdminDashboard();
        return ResponseEntity.ok(stats);
    }
}
