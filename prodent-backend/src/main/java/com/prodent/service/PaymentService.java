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

    /**
     * Handle payment provider callback. Called from PaymentController after
     * signature verification has passed.
     *
     * Flow: find pending tx → mark COMPLETED → credit virtual account balance.
     * Idempotent: if tx is already COMPLETED, returns silently.
     */
    @Transactional
    public void handleCallback(String provider, Map<String, Object> payload) {
        // Extract referenceId — each provider uses a different field name
        String referenceId = extractReferenceId(provider, payload);
        if (referenceId == null) {
            log.warn("Payment callback missing referenceId for provider: {}", provider);
            throw new BadRequestException("Missing transaction reference");
        }

        // 1. Find the pending transaction
        VirtualAccountTransaction tx = transactionRepository.findByReferenceId(referenceId)
                .orElseThrow(() -> {
                    log.warn("Payment callback: no transaction found for referenceId={}", referenceId);
                    return new BadRequestException("Transaction not found: " + referenceId);
                });

        // 2. Idempotency: already processed
        if (tx.getPaymentStatus() == VirtualAccountTransaction.PaymentStatus.COMPLETED) {
            log.info("Payment callback: tx {} already completed, skipping", referenceId);
            return;
        }

        if (tx.getPaymentStatus() != VirtualAccountTransaction.PaymentStatus.PENDING) {
            log.warn("Payment callback: tx {} in unexpected status {}", referenceId, tx.getPaymentStatus());
            return;
        }

        // 3. Credit the virtual account (optimistic lock via @Version)
        VirtualAccount account = tx.getAccount();
        BigDecimal newBalance = account.getBalance().add(tx.getAmount());
        account.setBalance(newBalance);
        virtualAccountRepository.save(account);

        // 4. Update transaction
        tx.setPaymentStatus(VirtualAccountTransaction.PaymentStatus.COMPLETED);
        tx.setBalanceAfter(newBalance);
        transactionRepository.save(tx);

        log.info("Payment callback: tx {} completed. Provider={}, amount={}, newBalance={}",
                referenceId, provider, tx.getAmount(), newBalance);
    }

    private String extractReferenceId(String provider, Map<String, Object> payload) {
        return switch (provider.toLowerCase()) {
            case "payme" -> {
                // PayMe sends params.account.transaction or id field
                Object params = payload.get("params");
                if (params instanceof Map<?, ?> p) {
                    Object account = p.get("account");
                    if (account instanceof Map<?, ?> acc) {
                        Object tx = acc.get("transaction");
                        if (tx != null) yield tx.toString();
                    }
                }
                yield payload.get("referenceId") != null ? payload.get("referenceId").toString() : null;
            }
            case "click" -> {
                Object mt = payload.get("merchant_trans_id");
                yield mt != null ? mt.toString() : null;
            }
            case "uzum" -> {
                Object ti = payload.get("transactionId");
                yield ti != null ? ti.toString() : null;
            }
            default -> {
                Object ri = payload.get("referenceId");
                yield ri != null ? ri.toString() : null;
            }
        };
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
