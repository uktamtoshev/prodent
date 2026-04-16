package com.prodent.controller;

import com.prodent.dto.request.CreateTreatmentPlanRequest;
import com.prodent.dto.response.TreatmentPlanResponse;
import com.prodent.entity.TreatmentPlan;
import com.prodent.entity.TreatmentPlanItem;
import com.prodent.service.TreatmentPlanService;
import com.prodent.util.SecurityUtils;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
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
@RequestMapping("/api/v1/treatment-plans")
@RequiredArgsConstructor
public class TreatmentPlanController {

    private final TreatmentPlanService treatmentPlanService;

    @PostMapping
    @PreAuthorize("hasRole('DOCTOR')")
    public ResponseEntity<TreatmentPlanResponse> createPlan(@Valid @RequestBody CreateTreatmentPlanRequest request) {
        UUID userId = SecurityUtils.getCurrentUserId();
        TreatmentPlanResponse response = treatmentPlanService.createPlan(userId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/patient/{patientId}")
    public ResponseEntity<List<TreatmentPlanResponse>> getPatientPlans(@PathVariable UUID patientId) {
        List<TreatmentPlanResponse> plans = treatmentPlanService.getPatientPlans(patientId);
        return ResponseEntity.ok(plans);
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<TreatmentPlanResponse> updateStatus(@PathVariable UUID id,
                                                              @RequestParam String status) {
        TreatmentPlan.PlanStatus planStatus = TreatmentPlan.PlanStatus.valueOf(status.toUpperCase());
        TreatmentPlanResponse response = treatmentPlanService.updatePlanStatus(id, planStatus);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/items/{itemId}/status")
    public ResponseEntity<Void> updateItemStatus(@PathVariable UUID itemId,
                                                 @RequestParam String status) {
        TreatmentPlanItem.ItemStatus itemStatus = TreatmentPlanItem.ItemStatus.valueOf(status.toUpperCase());
        treatmentPlanService.updateItemStatus(itemId, itemStatus);
        return ResponseEntity.ok().build();
    }
}
