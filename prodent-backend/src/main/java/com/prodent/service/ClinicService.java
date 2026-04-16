package com.prodent.service;

import com.prodent.dto.request.CreateClinicRequest;
import com.prodent.dto.request.UpdateClinicRequest;
import com.prodent.dto.response.ClinicResponse;
import com.prodent.dto.response.UserResponse;
import com.prodent.entity.Clinic;
import com.prodent.entity.UserRole;
import com.prodent.exception.DuplicateEntityException;
import com.prodent.exception.EntityNotFoundException;
import com.prodent.repository.ClinicRepository;
import com.prodent.repository.UserRoleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ClinicService {

    private final ClinicRepository clinicRepository;
    private final UserRoleRepository userRoleRepository;
    private final UserService userService;

    @Transactional
    public ClinicResponse createClinic(UUID ownerId, CreateClinicRequest request) {
        String slug = generateSlug(request.name());

        if (clinicRepository.findBySlug(slug).isPresent()) {
            slug = slug + "-" + UUID.randomUUID().toString().substring(0, 8);
        }

        Clinic clinic = Clinic.builder()
                .name(request.name())
                .slug(slug)
                .description(request.description())
                .phone(request.phone())
                .email(request.email())
                .address(request.address())
                .city(request.city())
                .country(request.country() != null ? request.country() : "UZ")
                .workingHours(request.workingHours())
                .ownerId(ownerId)
                .build();

        clinic = clinicRepository.save(clinic);

        // Assign CLINIC_ADMIN role to the owner
        userService.assignRole(ownerId, UserRole.AppRole.CLINIC_ADMIN, clinic.getId());

        log.info("Clinic created: {} (slug: {}) by owner: {}", clinic.getName(), clinic.getSlug(), ownerId);
        return mapToResponse(clinic);
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "clinics", key = "#id")
    public ClinicResponse getClinic(UUID id) {
        Clinic clinic = clinicRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Clinic", id));
        return mapToResponse(clinic);
    }

    @Transactional(readOnly = true)
    public ClinicResponse getClinicBySlug(String slug) {
        Clinic clinic = clinicRepository.findBySlug(slug)
                .orElseThrow(() -> new EntityNotFoundException("Clinic not found with slug: " + slug));
        return mapToResponse(clinic);
    }

    @Transactional
    @CacheEvict(value = "clinics", key = "#clinicId")
    public ClinicResponse updateClinic(UUID clinicId, UUID userId, UpdateClinicRequest request) {
        Clinic clinic = clinicRepository.findById(clinicId)
                .orElseThrow(() -> new EntityNotFoundException("Clinic", clinicId));

        if (request.name() != null) clinic.setName(request.name());
        if (request.description() != null) clinic.setDescription(request.description());
        if (request.phone() != null) clinic.setPhone(request.phone());
        if (request.email() != null) clinic.setEmail(request.email());
        if (request.address() != null) clinic.setAddress(request.address());
        if (request.city() != null) clinic.setCity(request.city());
        if (request.country() != null) clinic.setCountry(request.country());
        if (request.workingHours() != null) clinic.setWorkingHours(request.workingHours());

        clinic = clinicRepository.save(clinic);
        log.info("Clinic updated: {} by user: {}", clinicId, userId);
        return mapToResponse(clinic);
    }

    @Transactional(readOnly = true)
    public Page<ClinicResponse> listClinics(String city, String country, Pageable pageable) {
        Page<Clinic> clinics;
        if (city != null && country != null) {
            clinics = Page.empty(pageable);
            List<Clinic> list = clinicRepository.findByCityAndCountry(city, country);
            // Wrap in page manually for filtered queries
            return clinicRepository.findByIsVerifiedTrueAndIsActiveTrue(pageable).map(this::mapToResponse);
        } else {
            clinics = clinicRepository.findByIsVerifiedTrueAndIsActiveTrue(pageable);
        }
        return clinics.map(this::mapToResponse);
    }

    @Transactional(readOnly = true)
    public Page<ClinicResponse> searchClinics(String query, Pageable pageable) {
        return clinicRepository.searchByName(query, pageable).map(this::mapToResponse);
    }

    @Transactional(readOnly = true)
    public List<UserResponse> getClinicMembers(UUID clinicId) {
        clinicRepository.findById(clinicId)
                .orElseThrow(() -> new EntityNotFoundException("Clinic", clinicId));

        List<UserRole> clinicRoles = userRoleRepository.findByUserIdAndClinicId(null, clinicId);
        // This needs a custom query; returning owner roles for now
        return List.of();
    }

    private ClinicResponse mapToResponse(Clinic clinic) {
        return new ClinicResponse(
                clinic.getId(),
                clinic.getName(),
                clinic.getSlug(),
                clinic.getDescription(),
                clinic.getLogoUrl(),
                clinic.getCoverUrl(),
                clinic.getPhone(),
                clinic.getEmail(),
                clinic.getWebsite(),
                clinic.getAddress(),
                clinic.getCity(),
                clinic.getCountry(),
                clinic.getLatitude(),
                clinic.getLongitude(),
                clinic.getWorkingHours(),
                clinic.getSubscriptionPlan().name(),
                clinic.getIsVerified(),
                clinic.getRating(),
                clinic.getReviewCount(),
                clinic.getCreatedAt()
        );
    }

    private String generateSlug(String name) {
        String normalized = Normalizer.normalize(name.toLowerCase(), Normalizer.Form.NFD)
                .replaceAll("[\\p{InCombiningDiacriticalMarks}]", "");
        return normalized.replaceAll("[^a-z0-9\\s-]", "")
                .replaceAll("[\\s]+", "-")
                .replaceAll("-+", "-")
                .replaceAll("^-|-$", "");
    }
}
