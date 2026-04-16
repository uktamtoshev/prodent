package com.prodent.service;

import com.prodent.config.AppProperties;
import com.prodent.dto.request.PaymentTopupRequest;
import com.prodent.entity.VirtualAccount;
import com.prodent.entity.VirtualAccountTransaction;
import com.prodent.exception.BadRequestException;
import com.prodent.exception.EntityNotFoundException;
import com.prodent.repository.VirtualAccountRepository;
import com.prodent.repository.VirtualAccountTransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentService {

    private final VirtualAccountRepository virtualAccountRepository;
    private final VirtualAccountTransactionRepository transactionRepository;
    private final AppProperties appProperties;

    @Transactional
    public Map<String, Object> createTopup(UUID userId, PaymentTopupRequest request) {
        VirtualAccount account = getOrCreateAccount(userId);

        String transactionId = UUID.randomUUID().toString();

        VirtualAccountTransaction transaction = VirtualAccountTransaction.builder()
                .account(account)
                .amount(request.amount())
                .balanceAfter(account.getBalance()) // Will be updated on callback
                .transactionType("TOPUP")
                .description("Top-up via " + request.provider())
                .referenceId(transactionId)
                .paymentProvider(request.provider())
                .paymentStatus(VirtualAccountTransaction.PaymentStatus.PENDING)
                .build();

        transactionRepository.save(transaction);

        // Generate payment URL based on provider
        String paymentUrl = generatePaymentUrl(request.provider(), transactionId, request.amount());

        Map<String, Object> result = new HashMap<>();
        result.put("paymentUrl", paymentUrl);
        result.put("transactionId", transactionId);
        result.put("provider", request.provider());
        result.put("amount", request.amount());

        log.info("Payment topup initiated: user={}, amount={}, provider={}", userId, request.amount(), request.provider());
        return result;
    }

    @Transactional
    public void handleCallback(String provider, Map<String, Object> payload) {
        String referenceId = (String) payload.get("referenceId");
        if (referenceId == null) {
            log.warn("Payment callback missing referenceId for provider: {}", provider);
            return;
        }

        // Find the pending transaction
        // Since we don't have findByReferenceId, search through recent transactions
        // In production, add a repository method for this
        log.info("Processing payment callback from {}: {}", provider, payload);

        // TODO: Implement provider-specific callback handling for PayMe, Click, Uzum
        // 1. Verify signature/hash from provider
        // 2. Find transaction by referenceId
        // 3. Update transaction status
        // 4. Credit the virtual account balance
    }

    @Transactional(readOnly = true)
    public BigDecimal getBalance(UUID userId) {
        return virtualAccountRepository.findByOwnerIdAndOwnerType(userId, "USER")
                .map(VirtualAccount::getBalance)
                .orElse(BigDecimal.ZERO);
    }

    @Transactional(readOnly = true)
    public Page<VirtualAccountTransaction> getTransactions(UUID userId, Pageable pageable) {
        VirtualAccount account = virtualAccountRepository.findByOwnerIdAndOwnerType(userId, "USER")
                .orElseThrow(() -> new EntityNotFoundException("Virtual account not found for user: " + userId));

        return transactionRepository.findByAccountIdOrderByCreatedAtDesc(account.getId(), pageable);
    }

    private VirtualAccount getOrCreateAccount(UUID userId) {
        return virtualAccountRepository.findByOwnerIdAndOwnerType(userId, "USER")
                .orElseGet(() -> {
                    VirtualAccount newAccount = VirtualAccount.builder()
                            .ownerId(userId)
                            .ownerType("USER")
                            .build();
                    return virtualAccountRepository.save(newAccount);
                });
    }

    private String generatePaymentUrl(String provider, String transactionId, BigDecimal amount) {
        return switch (provider.toLowerCase()) {
            case "payme" -> {
                var payme = appProperties.getPayment().getPayme();
                yield String.format("https://checkout.paycom.uz/%s?amount=%s&transaction=%s",
                        payme.getMerchantId(), amount.multiply(BigDecimal.valueOf(100)).toBigInteger(), transactionId);
            }
            case "click" -> {
                var click = appProperties.getPayment().getClick();
                yield String.format("https://my.click.uz/services/pay?service_id=%s&merchant_id=%s&amount=%s&transaction_param=%s",
                        click.getServiceId(), click.getMerchantId(), amount, transactionId);
            }
            case "uzum" -> {
                var uzum = appProperties.getPayment().getUzum();
                yield String.format("https://www.uzumbank.uz/pay?merchantId=%s&amount=%s&transactionId=%s",
                        uzum.getMerchantId(), amount, transactionId);
            }
            default -> throw new BadRequestException("Unsupported payment provider: " + provider);
        };
    }
}
