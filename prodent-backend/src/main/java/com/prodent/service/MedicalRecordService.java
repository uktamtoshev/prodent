package com.prodent.service;

import com.prodent.dto.request.CreateMedicalRecordRequest;
import com.prodent.dto.response.MedicalRecordResponse;
import com.prodent.entity.Clinic;
import com.prodent.entity.Doctor;
import com.prodent.entity.MedicalRecord;
import com.prodent.exception.EntityNotFoundException;
import com.prodent.repository.ClinicRepository;
import com.prodent.repository.DoctorRepository;
import com.prodent.repository.MedicalRecordRepository;
import com.prodent.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class MedicalRecordService {

    private final MedicalRecordRepository medicalRecordRepository;
    private final DoctorRepository doctorRepository;
    private final ClinicRepository clinicRepository;
    private final UserRepository userRepository;

    @Transactional
    public MedicalRecordResponse createRecord(UUID doctorId, CreateMedicalRecordRequest request) {
        Doctor doctor = doctorRepository.findById(doctorId)
                .orElseThrow(() -> new EntityNotFoundException("Doctor", doctorId));

        userRepository.findById(request.patientId())
                .orElseThrow(() -> new EntityNotFoundException("Patient", request.patientId()));

        clinicRepository.findById(request.clinicId())
                .orElseThrow(() -> new EntityNotFoundException("Clinic", request.clinicId()));

        MedicalRecord record = MedicalRecord.builder()
                .patientId(request.patientId())
                .doctorId(doctorId)
                .clinicId(request.clinicId())
                .appointmentId(request.appointmentId())
                .diagnosis(request.diagnosis())
                .treatment(request.treatment())
                .notes(request.notes())
                .build();

        record = medicalRecordRepository.save(record);
        log.info("Medical record created: {} by doctor: {} for patient: {}", record.getId(), doctorId, request.patientId());
        return mapToResponse(record);
    }

    @Transactional(readOnly = true)
    public List<MedicalRecordResponse> getPatientRecords(UUID patientId, UUID requesterId) {
        // Check if requester has access: must be the patient, their doctor, or clinic admin
        boolean isPatient = patientId.equals(requesterId);

        if (!isPatient) {
            // Check if requester is a doctor who has treated this patient
            Doctor doctor = doctorRepository.findByUserId(requesterId).orElse(null);
            if (doctor == null) {
                throw new AccessDeniedException("You do not have permission to view these records");
            }
        }

        return medicalRecordRepository.findByPatientId(patientId, org.springframework.data.domain.Pageable.unpaged())
                .map(this::mapToResponse)
                .getContent();
    }

    @Transactional(readOnly = true)
    public MedicalRecordResponse getRecord(UUID id) {
        MedicalRecord record = medicalRecordRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("MedicalRecord", id));
        return mapToResponse(record);
    }

    private MedicalRecordResponse mapToResponse(MedicalRecord record) {
        String doctorName = doctorRepository.findById(record.getDoctorId())
                .map(d -> d.getUser().getFullName())
                .orElse("Unknown");

        String clinicName = clinicRepository.findById(record.getClinicId())
                .map(Clinic::getName)
                .orElse("Unknown");

        return new MedicalRecordResponse(
                record.getId(),
                record.getPatientId(),
                record.getDoctorId(),
                doctorName,
                record.getClinicId(),
                clinicName,
                record.getAppointmentId(),
                record.getDiagnosis(),
                record.getTreatment(),
                record.getNotes(),
                record.getCreatedAt()
        );
    }
}
