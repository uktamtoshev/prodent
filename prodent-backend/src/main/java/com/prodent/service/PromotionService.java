package com.prodent.service;

import com.prodent.dto.request.CreatePromotionRequest;
import com.prodent.dto.response.PromotionResponse;
import com.prodent.entity.Promotion;
import com.prodent.entity.PromotionClick;
import com.prodent.exception.BadRequestException;
import com.prodent.exception.EntityNotFoundException;
import com.prodent.repository.PromotionClickRepository;
import com.prodent.repository.PromotionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PromotionService {

    private final PromotionRepository promotionRepository;
    private final PromotionClickRepository clickRepository;

    @Transactional
    public PromotionResponse create(CreatePromotionRequest req, UUID createdBy) {
        if (req.clinicId() == null && req.doctorId() == null) {
            throw new BadRequestException("Promotion must be linked to a clinic or a doctor");
        }
        if (req.validUntil() == null) {
            throw new BadRequestException("validUntil is required");
        }
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime from = req.validFrom() != null ? req.validFrom() : now;
        if (!req.validUntil().isAfter(from)) {
            throw new BadRequestException("validUntil must be after validFrom");
        }

        Promotion p = Promotion.builder()
                .title(req.title())
                .titleUz(req.titleUz())
                .titleEn(req.titleEn())
                .description(req.description())
                .descriptionUz(req.descriptionUz())
                .descriptionEn(req.descriptionEn())
                .terms(req.terms())
                .imageUrl(req.imageUrl())
                .badgeLabel(req.badgeLabel())
                .ctaLabel(req.ctaLabel())
                .category(req.category() != null ? req.category() : "other")
                .serviceId(req.serviceId())
                .discountType(parseDiscountType(req.discountType()))
                .discount(req.discount() != null ? req.discount() : 0)
                .discountAmount(req.discountAmount())
                .price(req.price() != null ? req.price() : BigDecimal.ZERO)
                .oldPrice(req.oldPrice() != null ? req.oldPrice() : BigDecimal.ZERO)
                .currency(req.currency() != null ? req.currency() : "UZS")
                .clinicId(req.clinicId())
                .doctorId(req.doctorId())
                .targetCities(req.targetCities())
                .targetDistricts(req.targetDistricts())
                .targetAudience(req.targetAudience() != null ? req.targetAudience() : "ALL")
                .validFrom(from)
                .validUntil(req.validUntil())
                .status(parseStatus(req.status()))
                .active(req.active() != null ? req.active() : true)
                .isFeatured(req.isFeatured() != null ? req.isFeatured() : false)
                .priority(req.priority() != null ? req.priority() : 0)
                .maxImpressions(req.maxImpressions())
                .maxBookings(req.maxBookings())
                .createdBy(createdBy)
                .build();

        p = promotionRepository.save(p);
        log.info("Promotion created: {} by {}", p.getId(), createdBy);
        return PromotionResponse.from(p);
    }

    @Transactional
    public PromotionResponse update(UUID id, CreatePromotionRequest req) {
        Promotion p = promotionRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Promotion", id));

        if (req.title() != null) p.setTitle(req.title());
        if (req.titleUz() != null) p.setTitleUz(req.titleUz());
        if (req.titleEn() != null) p.setTitleEn(req.titleEn());
        if (req.description() != null) p.setDescription(req.description());
        if (req.descriptionUz() != null) p.setDescriptionUz(req.descriptionUz());
        if (req.descriptionEn() != null) p.setDescriptionEn(req.descriptionEn());
        if (req.terms() != null) p.setTerms(req.terms());
        if (req.imageUrl() != null) p.setImageUrl(req.imageUrl());
        if (req.badgeLabel() != null) p.setBadgeLabel(req.badgeLabel());
        if (req.ctaLabel() != null) p.setCtaLabel(req.ctaLabel());
        if (req.category() != null) p.setCategory(req.category());
        if (req.serviceId() != null) p.setServiceId(req.serviceId());
        if (req.discountType() != null) p.setDiscountType(parseDiscountType(req.discountType()));
        if (req.discount() != null) p.setDiscount(req.discount());
        if (req.discountAmount() != null) p.setDiscountAmount(req.discountAmount());
        if (req.price() != null) p.setPrice(req.price());
        if (req.oldPrice() != null) p.setOldPrice(req.oldPrice());
        if (req.currency() != null) p.setCurrency(req.currency());
        // Allow explicitly clearing clinic/doctor by sending the other
        if (req.clinicId() != null || req.doctorId() != null) {
            p.setClinicId(req.clinicId());
            p.setDoctorId(req.doctorId());
        }
        if (req.targetCities() != null) p.setTargetCities(req.targetCities());
        if (req.targetDistricts() != null) p.setTargetDistricts(req.targetDistricts());
        if (req.targetAudience() != null) p.setTargetAudience(req.targetAudience());
        if (req.validFrom() != null) p.setValidFrom(req.validFrom());
        if (req.validUntil() != null) p.setValidUntil(req.validUntil());
        if (req.status() != null) p.setStatus(parseStatus(req.status()));
        if (req.active() != null) p.setActive(req.active());
        if (req.isFeatured() != null) p.setIsFeatured(req.isFeatured());
        if (req.priority() != null) p.setPriority(req.priority());
        if (req.maxImpressions() != null) p.setMaxImpressions(req.maxImpressions());
        if (req.maxBookings() != null) p.setMaxBookings(req.maxBookings());

        if (p.getClinicId() == null && p.getDoctorId() == null) {
            throw new BadRequestException("Promotion must remain linked to a clinic or a doctor");
        }
        if (!p.getValidUntil().isAfter(p.getValidFrom())) {
            throw new BadRequestException("validUntil must be after validFrom");
        }

        p = promotionRepository.save(p);
        return PromotionResponse.from(p);
    }

    @Transactional
    public PromotionResponse setStatus(UUID id, String status) {
        Promotion p = promotionRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Promotion", id));
        p.setStatus(parseStatus(status));
        p.setActive(p.getStatus() == Promotion.Status.ACTIVE);
        return PromotionResponse.from(promotionRepository.save(p));
    }

    @Transactional
    public void delete(UUID id) {
        if (!promotionRepository.existsById(id)) {
            throw new EntityNotFoundException("Promotion", id);
        }
        promotionRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public Page<PromotionResponse> listAdmin(Promotion.Status status,
                                             String category,
                                             UUID clinicId,
                                             UUID doctorId,
                                             Pageable pageable) {
        return promotionRepository.searchAdmin(status, category, clinicId, doctorId, pageable)
                .map(PromotionResponse::from);
    }

    @Transactional(readOnly = true)
    public PromotionResponse getById(UUID id) {
        return promotionRepository.findById(id)
                .map(PromotionResponse::from)
                .orElseThrow(() -> new EntityNotFoundException("Promotion", id));
    }

    @Transactional(readOnly = true)
    public List<PromotionResponse> listPublic(String category, int limit) {
        Pageable pageable = PageRequest.of(0, Math.max(1, Math.min(limit, 100)));
        return promotionRepository.findActiveForPublic(OffsetDateTime.now(), category, pageable).stream()
                .map(PromotionResponse::from)
                .toList();
    }

    @Transactional
    public void trackEvent(UUID promotionId, String eventType, UUID userId,
                           String ip, String userAgent, String referrer) {
        if (!promotionRepository.existsById(promotionId)) {
            throw new EntityNotFoundException("Promotion", promotionId);
        }
        String type = eventType == null ? "CLICK" : eventType.toUpperCase();
        if (!type.equals("CLICK") && !type.equals("IMPRESSION") && !type.equals("BOOKING")) {
            throw new BadRequestException("Invalid event type: " + eventType);
        }

        clickRepository.save(PromotionClick.builder()
                .promotionId(promotionId)
                .userId(userId)
                .eventType(type)
                .ipAddress(ip)
                .userAgent(userAgent)
                .referrer(referrer)
                .build());

        switch (type) {
            case "CLICK"      -> promotionRepository.incrementClicks(promotionId);
            case "IMPRESSION" -> promotionRepository.incrementImpressions(promotionId);
            default -> { /* BOOKING is incremented via appointment service */ }
        }
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getStats() {
        long total = promotionRepository.count();
        long active = promotionRepository.countByStatus(Promotion.Status.ACTIVE);
        long draft = promotionRepository.countByStatus(Promotion.Status.DRAFT);
        long paused = promotionRepository.countByStatus(Promotion.Status.PAUSED);
        long expired = promotionRepository.countByStatus(Promotion.Status.EXPIRED);
        return Map.of(
                "total", total,
                "active", active,
                "draft", draft,
                "paused", paused,
                "expired", expired
        );
    }

    @Transactional
    public int expireOutdated() {
        return promotionRepository.expireOutdated(OffsetDateTime.now());
    }

    private Promotion.Status parseStatus(String s) {
        if (s == null || s.isBlank()) return Promotion.Status.DRAFT;
        try {
            return Promotion.Status.valueOf(s.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Invalid status: " + s);
        }
    }

    private Promotion.DiscountType parseDiscountType(String s) {
        if (s == null || s.isBlank()) return Promotion.DiscountType.PERCENT;
        try {
            return Promotion.DiscountType.valueOf(s.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Invalid discount type: " + s);
        }
    }
}
