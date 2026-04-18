package com.prodent.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.prodent.config.AppProperties;
import com.prodent.dto.request.PaymentTopupRequest;
import com.prodent.entity.VirtualAccountTransaction;
import com.prodent.service.PaymentService;
import com.prodent.util.PaymentSignatureVerifier;
import com.prodent.util.SecurityUtils;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/v1/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;
    private final AppProperties appProperties;

    @PostMapping("/topup")
    public ResponseEntity<Map<String, Object>> createTopup(@Valid @RequestBody PaymentTopupRequest request) {
        UUID userId = SecurityUtils.getCurrentUserId();
        Map<String, Object> result = paymentService.createTopup(userId, request);
        return ResponseEntity.ok(result);
    }

    /**
     * Payment provider callback. This endpoint is called by Payme/Click/Uzum
     * servers — NOT by our frontend. Signature is verified before processing.
     *
     * The endpoint is permitAll in SecurityConfig (payment providers don't
     * send JWT). Security is enforced via provider-specific signature checks.
     */
    @PostMapping("/callback/{provider}")
    public ResponseEntity<?> handleCallback(
            @PathVariable String provider,
            @RequestBody String rawBody,
            HttpServletRequest request) {

        // 1. Verify signature based on provider
        boolean signatureValid = switch (provider.toLowerCase()) {
            case "payme" -> {
                String authHeader = request.getHeader("Authorization");
                var cfg = appProperties.getPayment().getPayme();
                yield PaymentSignatureVerifier.verifyPayme(authHeader, cfg.getMerchantId(), cfg.getSecretKey());
            }
            case "click" -> {
                try {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> payload = new ObjectMapper().readValue(rawBody, Map.class);
                    var cfg = appProperties.getPayment().getClick();
                    yield PaymentSignatureVerifier.verifyClick(payload, cfg.getSecretKey());
                } catch (Exception e) {
                    yield false;
                }
            }
            case "uzum" -> {
                String signature = request.getHeader("X-Signature");
                var cfg = appProperties.getPayment().getUzum();
                yield PaymentSignatureVerifier.verifyUzum(rawBody, signature, cfg.getSecretKey());
            }
            default -> {
                log.warn("Unknown payment provider callback: {}", provider);
                yield false;
            }
        };

        if (!signatureValid) {
            log.warn("Payment callback REJECTED: invalid signature for provider={}", provider);
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Invalid signature"));
        }

        // 2. Parse body and delegate to service
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> payload = new ObjectMapper().readValue(rawBody, Map.class);
            paymentService.handleCallback(provider, payload);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.error("Payment callback error for provider={}: {}", provider, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/balance")
    public ResponseEntity<Map<String, BigDecimal>> getBalance() {
        UUID userId = SecurityUtils.getCurrentUserId();
        BigDecimal balance = paymentService.getBalance(userId);
        return ResponseEntity.ok(Map.of("balance", balance));
    }

    @GetMapping("/transactions")
    public ResponseEntity<Page<VirtualAccountTransaction>> getTransactions(Pageable pageable) {
        UUID userId = SecurityUtils.getCurrentUserId();
        Page<VirtualAccountTransaction> result = paymentService.getTransactions(userId, pageable);
        return ResponseEntity.ok(result);
    }
}
