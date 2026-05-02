package com.prodent.repository;

import com.prodent.entity.PromotionClick;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface PromotionClickRepository extends JpaRepository<PromotionClick, UUID> {

    long countByPromotionIdAndEventType(UUID promotionId, String eventType);
}
