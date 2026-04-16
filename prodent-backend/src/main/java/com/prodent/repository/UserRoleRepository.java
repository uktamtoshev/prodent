package com.prodent.repository;

import com.prodent.entity.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRoleRepository extends JpaRepository<UserRole, UUID> {

    List<UserRole> findByUserId(UUID userId);

    List<UserRole> findByUserIdAndClinicId(UUID userId, UUID clinicId);

    List<UserRole> findByUserIdAndRole(UUID userId, UserRole.AppRole role);

    boolean existsByUserIdAndRole(UUID userId, UserRole.AppRole role);

    void deleteByUserIdAndRoleAndClinicId(UUID userId, UserRole.AppRole role, UUID clinicId);
}
