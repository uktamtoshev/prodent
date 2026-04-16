package com.prodent.repository;

import com.prodent.entity.AdCampaign;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AdCampaignRepository extends JpaRepository<AdCampaign, UUID> {

    List<AdCampaign> findByOwnerId(UUID ownerId);

    List<AdCampaign> findByClinicId(UUID clinicId);

    List<AdCampaign> findByStatus(AdCampaign.CampaignStatus status);
}
