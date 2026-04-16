package com.prodent.repository;

import com.prodent.entity.VirtualAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface VirtualAccountRepository extends JpaRepository<VirtualAccount, UUID> {

    List<VirtualAccount> findByOwnerId(UUID ownerId);

    Optional<VirtualAccount> findByOwnerIdAndOwnerType(UUID ownerId, String ownerType);

    Optional<VirtualAccount> findByOwnerIdAndOwnerTypeAndClinicId(UUID ownerId, String ownerType, UUID clinicId);
}
