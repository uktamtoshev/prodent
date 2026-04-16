package com.prodent.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.Map;

public record CreateClinicRequest(
        @NotBlank(message = "Clinic name is required")
        @Size(max = 255, message = "Name must not exceed 255 characters")
        String name,

        String description,

        @Size(max = 20, message = "Phone must not exceed 20 characters")
        String phone,

        @Email(message = "Invalid email format")
        String email,

        @NotBlank(message = "Address is required")
        String address,

        @NotBlank(message = "City is required")
        @Size(max = 100, message = "City must not exceed 100 characters")
        String city,

        @Size(max = 5, message = "Country code must not exceed 5 characters")
        String country,

        Map<String, Object> workingHours
) {}
