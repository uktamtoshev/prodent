package com.prodent.service;

import com.prodent.dto.request.UpdateProfileRequest;
import com.prodent.dto.response.UserResponse;
import com.prodent.entity.User;
import com.prodent.entity.UserRole;
import com.prodent.exception.DuplicateEntityException;
import com.prodent.exception.EntityNotFoundException;
import com.prodent.repository.UserRepository;
import com.prodent.repository.UserRoleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;

    @Transactional(readOnly = true)
    public UserResponse getProfile(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User", userId));
        return mapToResponse(user);
    }

    @Transactional
    public UserResponse updateProfile(UUID userId, UpdateProfileRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User", userId));

        if (request.firstName() != null) user.setFirstName(request.firstName());
        if (request.lastName() != null) user.setLastName(request.lastName());
        if (request.middleName() != null) user.setMiddleName(request.middleName());
        if (request.email() != null) {
            if (!request.email().equals(user.getEmail()) && userRepository.existsByEmail(request.email())) {
                throw new DuplicateEntityException("User", "email", request.email());
            }
            user.setEmail(request.email());
        }
        if (request.dateOfBirth() != null) user.setDateOfBirth(request.dateOfBirth());
        if (request.gender() != null) user.setGender(User.Gender.valueOf(request.gender().toUpperCase()));
        if (request.language() != null) user.setLanguage(request.language());
        if (request.avatarUrl() != null) user.setAvatarUrl(request.avatarUrl());

        user = userRepository.save(user);
        return mapToResponse(user);
    }

    @Transactional(readOnly = true)
    public List<String> getUserRoles(UUID userId) {
        return userRoleRepository.findByUserId(userId).stream()
                .map(r -> r.getRole().name())
                .toList();
    }

    @Transactional
    public void assignRole(UUID userId, UserRole.AppRole role, UUID clinicId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User", userId));

        boolean exists = userRoleRepository.findByUserId(userId).stream()
                .anyMatch(r -> r.getRole() == role && Objects.equals(r.getClinicId(), clinicId));

        if (exists) {
            log.info("User {} already has role {} for clinic {}", userId, role, clinicId);
            return;
        }

        UserRole userRole = UserRole.builder()
                .user(user)
                .role(role)
                .clinicId(clinicId)
                .build();
        userRoleRepository.save(userRole);
        log.info("Assigned role {} to user {} for clinic {}", role, userId, clinicId);
    }

    @Transactional(readOnly = true)
    public Page<UserResponse> searchUsers(String query, Pageable pageable) {
        return userRepository.searchByName(query, pageable)
                .map(this::mapToResponse);
    }

    private UserResponse mapToResponse(User user) {
        List<String> roles = userRoleRepository.findByUserId(user.getId()).stream()
                .map(r -> r.getRole().name())
                .toList();

        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getPhone(),
                user.getFirstName(),
                user.getLastName(),
                user.getMiddleName(),
                user.getAvatarUrl(),
                user.getGender() != null ? user.getGender().name() : null,
                user.getDateOfBirth(),
                user.getLanguage(),
                user.getCountry(),
                roles,
                user.getIsVerified(),
                user.getCreatedAt()
        );
    }

}
