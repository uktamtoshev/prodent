package com.prodent.controller;

import com.prodent.dto.request.PaymentTopupRequest;
import com.prodent.entity.VirtualAccountTransaction;
import com.prodent.service.PaymentService;
import com.prodent.util.SecurityUtils;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;

    @PostMapping("/topup")
    public ResponseEntity<Map<String, Object>> createTopup(@Valid @RequestBody PaymentTopupRequest request) {
        UUID userId = SecurityUtils.getCurrentUserId();
        Map<String, Object> result = paymentService.createTopup(userId, request);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/callback/{provider}")
    public ResponseEntity<Void> handleCallback(@PathVariable String provider,
                                               @RequestBody Map<String, Object> payload) {
        paymentService.handleCallback(provider, payload);
        return ResponseEntity.ok().build();
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
