package com.prodent.service;

import com.prodent.dto.request.CreateTreatmentPlanRequest;
import com.prodent.dto.request.TreatmentPlanItemRequest;
import com.prodent.dto.response.TreatmentPlanResponse;
import com.prodent.entity.Clinic;
import com.prodent.entity.Doctor;
import com.prodent.entity.TreatmentPlan;
import com.prodent.entity.TreatmentPlanItem;
import com.prodent.exception.EntityNotFoundException;
import com.prodent.repository.ClinicRepository;
import com.prodent.repository.DoctorRepository;
import com.prodent.repository.TreatmentPlanRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class TreatmentPlanService {

    private final TreatmentPlanRepository treatmentPlanRepository;
    private final DoctorRepository doctorRepository;
    private final ClinicRepository clinicRepository;

    @Transactional
    public TreatmentPlanResponse createPlan(UUID doctorId, CreateTreatmentPlanRequest request) {
        doctorRepository.findById(doctorId)
                .orElseThrow(() -> new EntityNotFoundException("Doctor", doctorId));

        TreatmentPlan plan = TreatmentPlan.builder()
                .patientId(request.patientId())
                .doctorId(doctorId)
                .clinicId(request.clinicId())
                .title(request.title())
                .description(request.description())
                .build();

        List<TreatmentPlanItem> items = new ArrayList<>();
        BigDecimal totalCost = BigDecimal.ZERO;

        int sortOrder = 0;
        for (TreatmentPlanItemRequest itemReq : request.items()) {
            int qty = itemReq.quantity() != null ? itemReq.quantity() : 1;
            BigDecimal itemTotal = itemReq.unitPrice().multiply(BigDecimal.valueOf(qty));

            TreatmentPlanItem item = TreatmentPlanItem.builder()
                    .treatmentPlan(plan)
                    .serviceId(itemReq.serviceId())
                    .toothNumber(itemReq.toothNumber())
                    .description(itemReq.description())
                    .quantity(qty)
                    .unitPrice(itemReq.unitPrice())
                    .totalPrice(itemTotal)
                    .sortOrder(sortOrder++)
                    .build();

            items.add(item);
            totalCost = totalCost.add(itemTotal);
        }

        plan.setItems(items);
        plan.setTotalCost(totalCost);

        plan = treatmentPlanRepository.save(plan);
        log.info("Treatment plan created: {} by doctor: {} for patient: {}", plan.getId(), doctorId, request.patientId());
        return mapToResponse(plan);
    }

    @Transactional(readOnly = true)
    public List<TreatmentPlanResponse> getPatientPlans(UUID patientId) {
        return treatmentPlanRepository.findByPatientId(patientId, org.springframework.data.domain.Pageable.unpaged())
                .map(this::mapToResponse)
                .getContent();
    }

    @Transactional
    public TreatmentPlanResponse updatePlanStatus(UUID planId, TreatmentPlan.PlanStatus status) {
        TreatmentPlan plan = treatmentPlanRepository.findById(planId)
                .orElseThrow(() -> new EntityNotFoundException("TreatmentPlan", planId));

        plan.setStatus(status);
        if (status == TreatmentPlan.PlanStatus.IN_PROGRESS && plan.getApprovedAt() == null) {
            plan.setApprovedAt(OffsetDateTime.now());
        }

        plan = treatmentPlanRepository.save(plan);
        log.info("Treatment plan {} status updated to {}", planId, status);
        return mapToResponse(plan);
    }

    @Transactional
    public void updateItemStatus(UUID itemId, TreatmentPlanItem.ItemStatus status) {
        // Find the item across all plans
        // Since TreatmentPlanItem doesn't have its own repository, we need to search
        List<TreatmentPlan> allPlans = treatmentPlanRepository.findAll();
        for (TreatmentPlan plan : allPlans) {
            for (TreatmentPlanItem item : plan.getItems()) {
                if (item.getId().equals(itemId)) {
                    item.setStatus(status);
                    if (status == TreatmentPlanItem.ItemStatus.COMPLETED) {
                        item.setCompletedAt(OffsetDateTime.now());
                    }
                    treatmentPlanRepository.save(plan);
                    log.info("Treatment plan item {} status updated to {}", itemId, status);
                    return;
                }
            }
        }
        throw new EntityNotFoundException("TreatmentPlanItem", itemId);
    }

    private TreatmentPlanResponse mapToResponse(TreatmentPlan plan) {
        String doctorName = doctorRepository.findById(plan.getDoctorId())
                .map(d -> d.getUser().getFullName())
                .orElse("Unknown");

        String clinicName = clinicRepository.findById(plan.getClinicId())
                .map(Clinic::getName)
                .orElse("Unknown");

        List<TreatmentPlanResponse.TreatmentPlanItemResponse> itemResponses = plan.getItems().stream()
                .map(item -> new TreatmentPlanResponse.TreatmentPlanItemResponse(
                        item.getId(),
                        item.getServiceId(),
                        item.getToothNumber(),
                        item.getDescription(),
                        item.getQuantity(),
                        item.getUnitPrice(),
                        item.getTotalPrice(),
                        item.getStatus().name()
                ))
                .toList();

        return new TreatmentPlanResponse(
                plan.getId(),
                plan.getPatientId(),
                doctorName,
                clinicName,
                plan.getTitle(),
                plan.getDescription(),
                plan.getStatus().name(),
                plan.getTotalCost(),
                plan.getCurrency(),
                itemResponses,
                plan.getCreatedAt()
        );
    }
}
