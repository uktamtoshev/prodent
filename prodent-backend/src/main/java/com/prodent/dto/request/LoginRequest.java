package com.prodent.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
        String login,

        // Frontend sends "email" field, backend uses "login"
        @JsonProperty("email")
        String email,

        @NotBlank(message = "Password is required")
        String password
) {
    /**
     * Returns the effective login identifier.
     * Prefers 'login' field, falls back to 'email' field.
     */
    public String getEffectiveLogin() {
        if (login != null && !login.isBlank()) return login;
        if (email != null && !email.isBlank()) return email;
        return null;
    }
}
