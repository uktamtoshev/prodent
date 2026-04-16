package com.prodent.repository;

import com.prodent.entity.Service;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ServiceRepository extends JpaRepository<Service, UUID> {

    List<Service> findByClinicId(UUID clinicId);

    List<Service> findByClinicIdAndIsActiveTrue(UUID clinicId);

    List<Service> findByClinicIdAndCategory(UUID clinicId, String category);
}
