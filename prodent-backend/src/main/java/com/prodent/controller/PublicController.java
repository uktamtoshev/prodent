package com.prodent.controller;

import com.prodent.dto.response.ClinicResponse;
import com.prodent.dto.response.DoctorResponse;
import com.prodent.dto.response.SpecialtyResponse;
import com.prodent.entity.BlogPost;
import com.prodent.repository.BlogPostRepository;
import com.prodent.repository.SpecialtyRepository;
import com.prodent.service.ClinicService;
import com.prodent.service.DoctorService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/public")
@RequiredArgsConstructor
public class PublicController {

    private final ClinicService clinicService;
    private final DoctorService doctorService;
    private final SpecialtyRepository specialtyRepository;
    private final BlogPostRepository blogPostRepository;

    @GetMapping("/clinics")
    public ResponseEntity<Page<ClinicResponse>> listClinics(@RequestParam(required = false) String city,
                                                            @RequestParam(required = false) String country,
                                                            Pageable pageable) {
        Page<ClinicResponse> result = clinicService.listClinics(city, country, pageable);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/clinics/{slug}")
    public ResponseEntity<ClinicResponse> getClinicBySlug(@PathVariable String slug) {
        ClinicResponse response = clinicService.getClinicBySlug(slug);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/doctors/search")
    public ResponseEntity<Page<DoctorResponse>> searchDoctors(@RequestParam(required = false) String query,
                                                              @RequestParam(required = false) String specialty,
                                                              @RequestParam(required = false) String city,
                                                              Pageable pageable) {
        Page<DoctorResponse> result = doctorService.searchDoctors(query, specialty, city, pageable);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/doctors/top")
    public ResponseEntity<List<DoctorResponse>> getTopDoctors(@RequestParam(defaultValue = "10") int limit) {
        List<DoctorResponse> doctors = doctorService.getTopRatedDoctors(limit);
        return ResponseEntity.ok(doctors);
    }

    @GetMapping("/doctors/{id}")
    public ResponseEntity<DoctorResponse> getDoctorProfile(@PathVariable UUID id) {
        DoctorResponse response = doctorService.getDoctor(id);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/specialties")
    public ResponseEntity<List<SpecialtyResponse>> listSpecialties() {
        List<SpecialtyResponse> specialties = specialtyRepository.findAll().stream()
                .map(s -> new SpecialtyResponse(s.getId(), s.getNameRu(), s.getNameUz(), s.getNameEn(), s.getSlug(), s.getIcon()))
                .toList();
        return ResponseEntity.ok(specialties);
    }

    @GetMapping("/blog")
    public ResponseEntity<Page<BlogPost>> listBlogPosts(Pageable pageable) {
        Page<BlogPost> posts = blogPostRepository.findByIsPublishedTrueOrderByPublishedAtDesc(pageable);
        return ResponseEntity.ok(posts);
    }

    @GetMapping("/blog/{slug}")
    public ResponseEntity<BlogPost> getBlogPost(@PathVariable String slug) {
        BlogPost post = blogPostRepository.findBySlug(slug)
                .orElseThrow(() -> new com.prodent.exception.EntityNotFoundException("BlogPost not found with slug: " + slug));
        return ResponseEntity.ok(post);
    }
}
