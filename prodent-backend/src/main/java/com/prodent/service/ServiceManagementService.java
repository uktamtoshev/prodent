package com.prodent.service;

import com.prodent.dto.request.CreateServiceRequest;
import com.prodent.dto.response.ServiceResponse;
import com.prodent.exception.EntityNotFoundException;
import com.prodent.repository.ClinicRepository;
import com.prodent.repository.ServiceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ServiceManagementService {

    private final ServiceRepository serviceRepository;
    private final ClinicRepository clinicRepository;

    @Transactional
    @CacheEvict(value = "services", key = "#clinicId")
    public ServiceResponse createService(UUID clinicId, CreateServiceRequest request) {
        clinicRepository.findById(clinicId)
                .orElseThrow(() -> new EntityNotFoundException("Clinic", clinicId));

        com.prodent.entity.Service service = com.prodent.entity.Service.builder()
                .clinicId(clinicId)
                .nameRu(request.nameRu())
                .nameUz(request.nameUz())
                .nameEn(request.nameEn())
                .category(request.category())
                .price(request.price())
                .duration(request.duration() != null ? request.duration() : 30)
                .description(request.description())
                .build();

        service = serviceRepository.save(service);
        log.info("Service created: {} for clinic: {}", service.getId(), clinicId);
        return mapToResponse(service);
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "services", key = "#clinicId")
    public List<ServiceResponse> getClinicServices(UUID clinicId) {
        return serviceRepository.findByClinicIdAndIsActiveTrue(clinicId).stream()
                .map(this::mapToResponse)
                .toList();
    }

    @Transactional
    public ServiceResponse updateService(UUID serviceId, CreateServiceRequest request) {
        com.prodent.entity.Service service = serviceRepository.findById(serviceId)
                .orElseThrow(() -> new EntityNotFoundException("Service", serviceId));

        if (request.nameRu() != null) service.setNameRu(request.nameRu());
        if (request.nameUz() != null) service.setNameUz(request.nameUz());
        if (request.nameEn() != null) service.setNameEn(request.nameEn());
        if (request.category() != null) service.setCategory(request.category());
        if (request.price() != null) service.setPrice(request.price());
        if (request.duration() != null) service.setDuration(request.duration());
        if (request.description() != null) service.setDescription(request.description());

        service = serviceRepository.save(service);
        log.info("Service updated: {}", serviceId);
        return mapToResponse(service);
    }

    @Transactional
    public void deleteService(UUID serviceId) {
        com.prodent.entity.Service service = serviceRepository.findById(serviceId)
                .orElseThrow(() -> new EntityNotFoundException("Service", serviceId));

        service.setIsActive(false);
        serviceRepository.save(service);
        log.info("Service soft-deleted: {}", serviceId);
    }

    private ServiceResponse mapToResponse(com.prodent.entity.Service service) {
        return new ServiceResponse(
                service.getId(),
                service.getNameRu(),
                service.getNameUz(),
                service.getNameEn(),
                service.getCategory(),
                service.getPrice(),
                service.getCurrency(),
                service.getDuration(),
                service.getDescription(),
                service.getIsActive()
        );
    }
}
