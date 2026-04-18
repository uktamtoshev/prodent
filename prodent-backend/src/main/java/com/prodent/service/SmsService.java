package com.prodent.service;

import com.prodent.config.AppProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/**
 * SMS delivery via Playmobile (smsxabar.uz) Broker API.
 *
 * API spec: POST https://send.smsxabar.uz/broker-api/send
 * Auth: Basic login:password
 * Body: { "messages": [{ "recipient": "+998901234567", "message-id": "unique-id", "sms": { "originator": "PRODENT", "content": { "text": "..." } } }] }
 *
 * In dry-run mode (app.sms.dry-run=true), the message is logged instead of sent.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SmsService {

    private final AppProperties appProperties;
    private final RestTemplate restTemplate = new RestTemplate();

    @Async("asyncExecutor")
    public void sendSms(String phone, String text) {
        AppProperties.Sms smsConfig = appProperties.getSms();

        if (smsConfig.isDryRun()) {
            log.info("[SMS DRY-RUN] to={} text={}", maskPhone(phone), text);
            return;
        }

        if (smsConfig.getLogin() == null || smsConfig.getLogin().isBlank()
                || smsConfig.getPassword() == null || smsConfig.getPassword().isBlank()) {
            log.warn("[SMS] Credentials not configured — skipping send to {}", maskPhone(phone));
            return;
        }

        try {
            String messageId = "otp-" + System.currentTimeMillis() + "-" + phone.hashCode();

            Map<String, Object> payload = Map.of(
                    "messages", new Object[]{
                            Map.of(
                                    "recipient", phone,
                                    "message-id", messageId,
                                    "sms", Map.of(
                                            "originator", "PRODENT",
                                            "content", Map.of("text", text)
                                    )
                            )
                    }
            );

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBasicAuth(smsConfig.getLogin(), smsConfig.getPassword());

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    smsConfig.getApiUrl(),
                    HttpMethod.POST,
                    request,
                    String.class
            );

            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("[SMS] Sent to {} (messageId={})", maskPhone(phone), messageId);
            } else {
                log.error("[SMS] Failed to send to {} — status={}, body={}",
                        maskPhone(phone), response.getStatusCode(), response.getBody());
            }
        } catch (Exception e) {
            log.error("[SMS] Error sending to {}: {}", maskPhone(phone), e.getMessage(), e);
        }
    }

    /**
     * Send OTP code via SMS.
     */
    public void sendOtp(String phone, String code) {
        String text = "PRODENT: Ваш код подтверждения: " + code + ". Не сообщайте его никому.";
        sendSms(phone, text);
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 7) return "***";
        return phone.substring(0, 4) + "***" + phone.substring(phone.length() - 4);
    }
}
