package com.prodent.controller;

import com.prodent.dto.response.ReviewResponse;
import com.prodent.service.ReviewService;
import com.prodent.util.SecurityUtils;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/reviews")
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewService reviewService;

    @PostMapping("/doctor/{doctorId}")
    public ResponseEntity<ReviewResponse> addDoctorReview(@PathVariable UUID doctorId,
                                                          @RequestParam @Min(1) @Max(5) int rating,
                                                          @RequestParam(required = false) String comment) {
        UUID patientId = SecurityUtils.getCurrentUserId();
        ReviewResponse response = reviewService.addDoctorReview(patientId, doctorId, rating, comment);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/clinic/{clinicId}")
    public ResponseEntity<ReviewResponse> addClinicReview(@PathVariable UUID clinicId,
                                                          @RequestParam @Min(1) @Max(5) int rating,
                                                          @RequestParam(required = false) String comment) {
        UUID patientId = SecurityUtils.getCurrentUserId();
        ReviewResponse response = reviewService.addClinicReview(patientId, clinicId, rating, comment);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/doctor/{doctorId}")
    public ResponseEntity<Page<ReviewResponse>> getDoctorReviews(@PathVariable UUID doctorId, Pageable pageable) {
        Page<ReviewResponse> result = reviewService.getDoctorReviews(doctorId, pageable);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/clinic/{clinicId}")
    public ResponseEntity<Page<ReviewResponse>> getClinicReviews(@PathVariable UUID clinicId, Pageable pageable) {
        Page<ReviewResponse> result = reviewService.getClinicReviews(clinicId, pageable);
        return ResponseEntity.ok(result);
    }
}
