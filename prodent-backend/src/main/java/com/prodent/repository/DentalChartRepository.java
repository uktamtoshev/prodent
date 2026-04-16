package com.prodent.repository;

import com.prodent.entity.DentalChart;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DentalChartRepository extends JpaRepository<DentalChart, UUID> {

    List<DentalChart> findByPatientId(UUID patientId);

    Optional<DentalChart> findByPatientIdAndToothNumber(UUID patientId, Integer toothNumber);

    @Query("SELECT dc FROM DentalChart dc WHERE dc.patientId = :patientId ORDER BY dc.recordedAt DESC")
    List<DentalChart> findLatestByPatientId(@Param("patientId") UUID patientId);
}
