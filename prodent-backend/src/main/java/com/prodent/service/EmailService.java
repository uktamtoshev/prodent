package com.prodent.service;

import com.prodent.config.AppProperties;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.util.Map;

/**
 * Email delivery service using Spring Mail + Thymeleaf templates.
 *
 * Templates live in src/main/resources/templates/email/*.html.
 * In dry-run mode (app.email.dry-run=true), emails are logged instead of sent.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;
    private final TemplateEngine templateEngine;
    private final AppProperties appProperties;

    /**
     * Send an HTML email rendered from a Thymeleaf template.
     *
     * @param to         recipient email address
     * @param subject    email subject
     * @param template   template name (without path prefix or .html suffix), e.g. "welcome"
     * @param variables  template variables
     */
    @Async("asyncExecutor")
    public void sendTemplateEmail(String to, String subject, String template, Map<String, Object> variables) {
        if (to == null || to.isBlank()) {
            log.debug("[Email] Skipping — no recipient address");
            return;
        }

        AppProperties.Email cfg = appProperties.getEmail();

        // Inject common variables
        Context ctx = new Context();
        ctx.setVariables(variables);
        ctx.setVariable("baseUrl", cfg.getBaseUrl());
        ctx.setVariable("unsubscribeUrl", cfg.getBaseUrl() + "/profile?tab=notifications");

        String html = templateEngine.process("email/" + template, ctx);

        if (cfg.isDryRun()) {
            log.info("[Email DRY-RUN] to={} subject=\"{}\" template={}", to, subject, template);
            return;
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(cfg.getFromAddress(), cfg.getFromName());
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(html, true);

            mailSender.send(message);
            log.info("[Email] Sent to={} subject=\"{}\"", to, subject);
        } catch (MessagingException e) {
            log.error("[Email] Failed to send to={}: {}", to, e.getMessage(), e);
        } catch (Exception e) {
            log.error("[Email] Unexpected error sending to={}: {}", to, e.getMessage(), e);
        }
    }

    // ─── Convenience methods ────────────────────────────────────

    public void sendWelcome(String to, String userName) {
        sendTemplateEmail(to, "Добро пожаловать в PRODENT!", "welcome",
                Map.of("userName", userName));
    }

    public void sendAppointmentConfirmation(String to, String patientName, String doctorName,
                                             String clinicName, String date, String time) {
        sendTemplateEmail(to, "Запись подтверждена — " + date, "appointment-confirmation",
                Map.of("patientName", patientName,
                       "doctorName", doctorName,
                       "clinicName", clinicName,
                       "date", date,
                       "time", time));
    }

    public void sendPaymentReceipt(String to, String patientName, String amount, String description) {
        sendTemplateEmail(to, "Чек оплаты — PRODENT", "payment-receipt",
                Map.of("patientName", patientName,
                       "amount", amount,
                       "description", description));
    }

    public void sendOnboardingDay3(String to, String userName) {
        sendTemplateEmail(to, "3 совета для начала работы с PRODENT", "onboarding-day3",
                Map.of("userName", userName));
    }

    public void sendOnboardingDay7(String to, String userName) {
        sendTemplateEmail(to, "Попробуйте премиум-функции PRODENT", "onboarding-day7",
                Map.of("userName", userName));
    }
}
