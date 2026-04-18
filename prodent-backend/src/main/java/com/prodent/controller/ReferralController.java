package com.prodent.controller;

import com.prodent.service.ReferralService;
import com.prodent.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/referral")
@RequiredArgsConstructor
public class ReferralController {

    private final ReferralService referralService;

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        UUID userId = SecurityUtils.getCurrentUserId();
        Map<String, Object> stats = referralService.getReferralStats(userId);
        return ResponseEntity.ok(stats);
    }

    @GetMapping("/code")
    public ResponseEntity<Map<String, String>> getCode() {
        UUID userId = SecurityUtils.getCurrentUserId();
        String code = referralService.getOrCreateReferralCode(userId);
        return ResponseEntity.ok(Map.of(
                "code", code,
                "link", "https://prodent.uz/auth?ref=" + code
        ));
    }
}
