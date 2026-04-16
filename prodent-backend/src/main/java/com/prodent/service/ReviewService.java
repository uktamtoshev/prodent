package com.prodent.service;

import com.prodent.dto.response.ReviewResponse;
import com.prodent.entity.Clinic;
import com.prodent.entity.ClinicReview;
import com.prodent.entity.Doctor;
import com.prodent.entity.DoctorReview;
import com.prodent.entity.User;
import com.prodent.exception.EntityNotFoundException;
import com.prodent.repository.ClinicRepository;
import com.prodent.repository.ClinicReviewRepository;
import com.prodent.repository.DoctorRepository;
import com.prodent.repository.DoctorReviewRepository;
import com.prodent.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReviewService {

    private final DoctorReviewRepository doctorReviewRepository;
    private final ClinicReviewRepository clinicReviewRepository;
    private final DoctorRepository doctorRepository;
    private final ClinicRepository clinicRepository;
    private final UserRepository userRepository;

    @Transactional
    public ReviewResponse addDoctorReview(UUID patientId, UUID doctorId, int rating, String comment) {
        Doctor doctor = doctorRepository.findById(doctorId)
                .orElseThrow(() -> new EntityNotFoundException("Doctor", doctorId));

        DoctorReview review = DoctorReview.builder()
                .doctorId(doctorId)
                .patientId(patientId)
                .rating(rating)
                .comment(comment)
                .build();

        review = doctorReviewRepository.save(review);

        // Update doctor average rating
        Double avgRating = doctorReviewRepository.averageRatingByDoctorId(doctorId);
        doctor.setRating(BigDecimal.valueOf(avgRating).setScale(2, RoundingMode.HALF_UP));
        doctor.setReviewCount(doctor.getReviewCount() + 1);
        doctorRepository.save(doctor);

        log.info("Doctor review added: doctor={}, patient={}, rating={}", doctorId, patientId, rating);
        return mapDoctorReviewToResponse(review);
    }

    @Transactional
    public ReviewResponse addClinicReview(UUID patientId, UUID clinicId, int rating, String comment) {
        Clinic clinic = clinicRepository.findById(clinicId)
                .orElseThrow(() -> new EntityNotFoundException("Clinic", clinicId));

        ClinicReview review = ClinicReview.builder()
                .clinicId(clinicId)
                .patientId(patientId)
                .rating(rating)
                .comment(comment)
                .build();

        review = clinicReviewRepository.save(review);

        // Update clinic average rating
        Double avgRating = clinicReviewRepository.averageRatingByClinicId(clinicId);
        clinic.setRating(BigDecimal.valueOf(avgRating).setScale(2, RoundingMode.HALF_UP));
        clinic.setReviewCount(clinic.getReviewCount() + 1);
        clinicRepository.save(clinic);

        log.info("Clinic review added: clinic={}, patient={}, rating={}", clinicId, patientId, rating);
        return mapClinicReviewToResponse(review);
    }

    @Transactional(readOnly = true)
    public Page<ReviewResponse> getDoctorReviews(UUID doctorId, Pageable pageable) {
        return doctorReviewRepository.findByDoctorIdAndIsApprovedTrue(doctorId, pageable)
                .map(this::mapDoctorReviewToResponse);
    }

    @Transactional(readOnly = true)
    public Page<ReviewResponse> getClinicReviews(UUID clinicId, Pageable pageable) {
        return clinicReviewRepository.findByClinicIdAndIsApprovedTrue(clinicId, pageable)
                .map(this::mapClinicReviewToResponse);
    }

    private ReviewResponse mapDoctorReviewToResponse(DoctorReview review) {
        String patientName = userRepository.findById(review.getPatientId())
                .map(User::getFullName)
                .orElse("Anonymous");

        return new ReviewResponse(
                review.getId(),
                patientName,
                review.getRating(),
                review.getComment(),
                review.getCreatedAt()
        );
    }

    private ReviewResponse mapClinicReviewToResponse(ClinicReview review) {
        String patientName = userRepository.findById(review.getPatientId())
                .map(User::getFullName)
                .orElse("Anonymous");

        return new ReviewResponse(
                review.getId(),
                patientName,
                review.getRating(),
                review.getComment(),
                review.getCreatedAt()
        );
    }
}
