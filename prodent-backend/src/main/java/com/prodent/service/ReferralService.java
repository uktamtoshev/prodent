package com.prodent.service;

import com.prodent.entity.Notification;
import com.prodent.entity.User;
import com.prodent.entity.VirtualAccount;
import com.prodent.entity.VirtualAccountTransaction;
import com.prodent.repository.UserRepository;
import com.prodent.repository.VirtualAccountRepository;
import com.prodent.repository.VirtualAccountTransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Referral system: each user gets a unique code. When a new user
 * registers with that code, both get a bonus on their virtual account.
 *
 * Bonus amounts (configurable later via admin):
 *   - Referrer: 50,000 UZS
 *   - Referred (new user): 20,000 UZS
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReferralService {

    private static final BigDecimal REFERRER_BONUS = new BigDecimal("50000");
    private static final BigDecimal REFERRED_BONUS = new BigDecimal("20000");

    private final UserRepository userRepository;
    private final VirtualAccountRepository virtualAccountRepository;
    private final VirtualAccountTransactionRepository transactionRepository;
    private final NotificationService notificationService;
    private final JdbcTemplate jdbcTemplate;

    /**
     * Generate or return existing referral code for a user.
     */
    @Transactional
    public String getOrCreateReferralCode(UUID userId) {
        User user = userRepository.findById(userId).orElseThrow();
        if (user.getReferralCode() != null) {
            return user.getReferralCode();
        }

        // Generate unique 8-char alphanumeric code
        String code;
        int attempts = 0;
        do {
            code = generateCode();
            attempts++;
        } while (userRepository.existsByReferralCode(code) && attempts < 10);

        user.setReferralCode(code);
        userRepository.save(user);
        return code;
    }

    /**
     * Process referral at registration: link inviter, credit bonuses.
     * Called from AuthController.register when referral_code is provided.
     */
    @Transactional
    public void processReferral(UUID newUserId, String referralCode) {
        if (referralCode == null || referralCode.isBlank()) return;

        User referrer = userRepository.findByReferralCode(referralCode.trim()).orElse(null);
        if (referrer == null) {
            log.warn("Invalid referral code: {}", referralCode);
            return;
        }

        // Prevent self-referral
        if (referrer.getId().equals(newUserId)) return;

        User newUser = userRepository.findById(newUserId).orElse(null);
        if (newUser == null) return;

        // Link
        newUser.setInvitedBy(referrer.getId());
        userRepository.save(newUser);

        // Credit bonuses
        creditBonus(referrer.getId(), REFERRER_BONUS, "Реферальный бонус за приглашение " + newUser.getFirstName());
        creditBonus(newUserId, REFERRED_BONUS, "Бонус за регистрацию по приглашению");

        // Log to referral_bonuses table
        jdbcTemplate.update(
                "INSERT INTO referral_bonuses (referrer_id, referred_id, bonus_amount, status, credited_at) " +
                "VALUES (?, ?, ?, 'CREDITED', NOW()) ON CONFLICT DO NOTHING",
                referrer.getId(), newUserId, REFERRER_BONUS);

        // Notify referrer
        notificationService.sendNotification(
                referrer.getId(),
                Notification.NotificationType.SYSTEM,
                "Новый реферал!",
                newUser.getFirstName() + " зарегистрировался по вашей ссылке. Вам начислено " +
                        REFERRER_BONUS.toPlainString() + " UZS.",
                Map.of("type", "referral_bonus", "referredUserId", newUserId.toString())
        );

        log.info("Referral processed: {} invited {} (bonuses: {}+{} UZS)",
                referrer.getId(), newUserId, REFERRER_BONUS, REFERRED_BONUS);
    }

    /**
     * Get referral stats for a user.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getReferralStats(UUID userId) {
        String code = getOrCreateReferralCode(userId);

        Integer invitedCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM users WHERE invited_by = ?",
                Integer.class, userId);

        BigDecimal totalEarned = jdbcTemplate.queryForObject(
                "SELECT COALESCE(SUM(bonus_amount), 0) FROM referral_bonuses WHERE referrer_id = ? AND status = 'CREDITED'",
                BigDecimal.class, userId);

        return Map.of(
                "referralCode", code,
                "referralLink", "https://prodent.uz/auth?ref=" + code,
                "invitedCount", invitedCount != null ? invitedCount : 0,
                "totalEarned", totalEarned != null ? totalEarned : BigDecimal.ZERO
        );
    }

    // ─── Helpers ────────────────────────────────────────────

    private void creditBonus(UUID userId, BigDecimal amount, String description) {
        VirtualAccount account = virtualAccountRepository.findByOwnerIdAndOwnerType(userId, "USER")
                .orElseGet(() -> {
                    VirtualAccount a = VirtualAccount.builder().ownerId(userId).ownerType("USER").build();
                    return virtualAccountRepository.save(a);
                });

        BigDecimal newBalance = account.getBalance().add(amount);
        account.setBalance(newBalance);
        virtualAccountRepository.save(account);

        VirtualAccountTransaction tx = VirtualAccountTransaction.builder()
                .account(account)
                .amount(amount)
                .balanceAfter(newBalance)
                .transactionType("REFERRAL_BONUS")
                .description(description)
                .paymentStatus(VirtualAccountTransaction.PaymentStatus.COMPLETED)
                .build();
        transactionRepository.save(tx);
    }

    private String generateCode() {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity
        StringBuilder sb = new StringBuilder(8);
        for (int i = 0; i < 8; i++) {
            sb.append(chars.charAt(ThreadLocalRandom.current().nextInt(chars.length())));
        }
        return sb.toString();
    }
}
