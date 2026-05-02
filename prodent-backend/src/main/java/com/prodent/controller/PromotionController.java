package com.prodent.controller;

import com.prodent.dto.request.CreatePromotionRequest;
import com.prodent.dto.response.PromotionResponse;
import com.prodent.entity.Promotion;
import com.prodent.service.PromotionService;
import com.prodent.util.SecurityUtils;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class PromotionController {

    private final PromotionService promotionService;

    // ── Admin endpoints ──────────────────────────────────────────────

    @PostMapping("/admin/promotions")
    @PreAuthorize("hasRole('ADMIN') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<PromotionResponse> createPromotion(@Valid @RequestBody CreatePromotionRequest request) {
        UUID createdBy;
        try {
            createdBy = SecurityUtils.getCurrentUserId();
        } catch (Exception e) {
            createdBy = null;
        }
        PromotionResponse response = promotionService.create(request, createdBy);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/admin/promotions/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<PromotionResponse> updatePromotion(@PathVariable UUID id,
                                                             @RequestBody CreatePromotionRequest request) {
        return ResponseEntity.ok(promotionService.update(id, request));
    }

    @PatchMapping("/admin/promotions/{id}/status")
    @PreAuthorize("hasRole('ADMIN') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<PromotionResponse> changeStatus(@PathVariable UUID id,
                                                          @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(promotionService.setStatus(id, body.get("status")));
    }

    @DeleteMapping("/admin/promotions/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<Void> deletePromotion(@PathVariable UUID id) {
        promotionService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/admin/promotions")
    @PreAuthorize("hasRole('ADMIN') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<Page<PromotionResponse>> listPromotions(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) UUID clinicId,
            @RequestParam(required = false) UUID doctorId,
            Pageable pageable) {
        Promotion.Status statusEnum = null;
        if (status != null && !status.isBlank()) {
            try {
                statusEnum = Promotion.Status.valueOf(status.toUpperCase());
            } catch (IllegalArgumentException ignored) {}
        }
        return ResponseEntity.ok(promotionService.listAdmin(statusEnum, category, clinicId, doctorId, pageable));
    }

    @GetMapping("/admin/promotions/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<PromotionResponse> getPromotion(@PathVariable UUID id) {
        return ResponseEntity.ok(promotionService.getById(id));
    }

    @GetMapping("/admin/promotions/stats")
    @PreAuthorize("hasRole('ADMIN') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<Map<String, Object>> stats() {
        return ResponseEntity.ok(promotionService.getStats());
    }

    @PostMapping("/admin/promotions/expire-outdated")
    @PreAuthorize("hasRole('ADMIN') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<Map<String, Object>> expireOutdated() {
        int affected = promotionService.expireOutdated();
        return ResponseEntity.ok(Map.of("expired", affected));
    }

    // ── Public endpoints ─────────────────────────────────────────────

    @GetMapping("/public/promotions")
    public ResponseEntity<java.util.List<PromotionResponse>> listPublic(
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "12") int limit) {
        return ResponseEntity.ok(promotionService.listPublic(category, limit));
    }

    @PostMapping("/public/promotions/{id}/track")
    public ResponseEntity<Void> track(@PathVariable UUID id,
                                      @RequestBody(required = false) Map<String, String> body,
                                      HttpServletRequest request) {
        String eventType = body != null ? body.getOrDefault("eventType", "CLICK") : "CLICK";
        UUID userId = null;
        try {
            userId = SecurityUtils.getCurrentUserId();
        } catch (Exception ignored) {}
        promotionService.trackEvent(id, eventType, userId,
                request.getRemoteAddr(),
                request.getHeader("User-Agent"),
                request.getHeader("Referer"));
        return ResponseEntity.accepted().build();
    }
}
