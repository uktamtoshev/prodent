package com.prodent.service;

import com.prodent.dto.request.CreateDoctorProfileRequest;
import com.prodent.dto.response.DoctorResponse;
import com.prodent.dto.response.SpecialtyResponse;
import com.prodent.entity.Doctor;
import com.prodent.entity.Specialty;
import com.prodent.entity.User;
import com.prodent.exception.DuplicateEntityException;
import com.prodent.exception.EntityNotFoundException;
import com.prodent.repository.DoctorRepository;
import com.prodent.repository.SpecialtyRepository;
import com.prodent.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class DoctorService {

    private final DoctorRepository doctorRepository;
    private final UserRepository userRepository;
    private final SpecialtyRepository specialtyRepository;

    @Transactional
    public DoctorResponse createDoctorProfile(UUID userId, CreateDoctorProfileRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User", userId));

        if (doctorRepository.findByUserId(userId).isPresent()) {
            throw new DuplicateEntityException("Doctor profile already exists for user: " + userId);
        }

        Set<Specialty> specialties = new HashSet<>();
        if (request.specialtyIds() != null) {
            for (UUID specId : request.specialtyIds()) {
                Specialty s = specialtyRepository.findById(specId)
                        .orElseThrow(() -> new EntityNotFoundException("Specialty", specId));
                specialties.add(s);
            }
        }

        Doctor doctor = Doctor.builder()
                .user(user)
                .bio(request.bio())
                .experienceYears(request.experienceYears() != null ? request.experienceYears() : 0)
                .consultationPrice(request.consultationPrice())
                .specialties(specialties)
                .build();

        doctor = doctorRepository.save(doctor);
        log.info("Doctor profile created for user: {}", userId);
        return mapToResponse(doctor);
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "doctors", key = "#doctorId")
    public DoctorResponse getDoctor(UUID doctorId) {
        Doctor doctor = doctorRepository.findById(doctorId)
                .orElseThrow(() -> new EntityNotFoundException("Doctor", doctorId));
        return mapToResponse(doctor);
    }

    @Transactional(readOnly = true)
    public DoctorResponse getDoctorByUserId(UUID userId) {
        Doctor doctor = doctorRepository.findByUserId(userId)
                .orElseThrow(() -> new EntityNotFoundException("Doctor profile not found for user: " + userId));
        return mapToResponse(doctor);
    }

    @Transactional(readOnly = true)
    public Page<DoctorResponse> searchDoctors(String query, String specialty, String city, Pageable pageable) {
        if (query != null && !query.isBlank()) {
            return doctorRepository.search(query, pageable).map(this::mapToResponse);
        }
        return doctorRepository.findByIsVerifiedTrue(pageable).map(this::mapToResponse);
    }

    @Transactional(readOnly = true)
    public List<DoctorResponse> getTopRatedDoctors(int limit) {
        return doctorRepository.findTopRated(PageRequest.of(0, limit)).stream()
                .map(this::mapToResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<DoctorResponse> getDoctorsByClinic(UUID clinicId) {
        return doctorRepository.findByClinicId(clinicId).stream()
                .map(this::mapToResponse)
                .toList();
    }

    private DoctorResponse mapToResponse(Doctor doctor) {
        User user = doctor.getUser();
        List<SpecialtyResponse> specialties = doctor.getSpecialties().stream()
                .map(s -> new SpecialtyResponse(s.getId(), s.getNameRu(), s.getNameUz(), s.getNameEn(), s.getSlug(), s.getIcon()))
                .toList();

        return new DoctorResponse(
                doctor.getId(),
                user.getId(),
                user.getFirstName(),
                user.getLastName(),
                user.getAvatarUrl(),
                doctor.getBio(),
                doctor.getExperienceYears(),
                doctor.getConsultationPrice(),
                doctor.getCurrency(),
                specialties,
                doctor.getIsVerified(),
                doctor.getRating(),
                doctor.getReviewCount(),
                doctor.getIsAcceptingPatients()
        );
    }
}
