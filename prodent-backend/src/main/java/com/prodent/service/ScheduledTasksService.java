package com.prodent.service;

import com.prodent.entity.Appointment;
import com.prodent.entity.Clinic;
import com.prodent.entity.Doctor;
import com.prodent.entity.Notification;
import com.prodent.repository.AppointmentRepository;
import com.prodent.repository.ClinicRepository;
import com.prodent.repository.DoctorRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * Scheduled background tasks for MVP operations:
 * - Appointment reminders (24h before)
 * - Review requests (2h after completion)
 * - Subscription dunning (7, 3, 1 day before expiry)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ScheduledTasksService {

    private final AppointmentRepository appointmentRepository;
    private final DoctorRepository doctorRepository;
    private final ClinicRepository clinicRepository;
    private final NotificationService notificationService;
    private final SmsService smsService;

    // ─── 1. Appointment reminders — runs every hour ─────────────

    @Scheduled(cron = "0 0 * * * *") // every hour at :00
    public void sendAppointmentReminders() {
        LocalDate tomorrow = LocalDate.now().plusDays(1);
        List<Appointment> appointments = appointmentRepository.findConfirmedByDate(tomorrow);

        int sent = 0;
        for (Appointment appt : appointments) {
            try {
                // In-app notification to patient
                notificationService.sendNotification(
                        appt.getPatientId(),
                        Notification.NotificationType.REMINDER,
                        "Напоминание о визите",
                        "Ваш приём завтра, " + appt.getAppointmentDate()
                                + " в " + appt.getStartTime()
                                + ". Клиника: " + appt.getClinic().getName(),
                        Map.of("appointmentId", appt.getId().toString(),
                               "type", "appointment_reminder")
                );

                // SMS reminder to patient — only if we have their phone
                // (phone lookup would need userRepository, but keeping it simple for MVP:
                //  the SmsService handles missing credentials gracefully)

                sent++;
            } catch (Exception e) {
                log.error("Failed to send reminder for appointment {}: {}", appt.getId(), e.getMessage());
            }
        }

        if (sent > 0) {
            log.info("[Scheduler] Sent {} appointment reminders for {}", sent, tomorrow);
        }
    }

    // ─── 2. Review requests — runs every hour ───────────────────

    @Scheduled(cron = "0 30 * * * *") // every hour at :30
    public void sendReviewRequests() {
        // Find appointments completed 2–3 hours ago
        OffsetDateTime from = OffsetDateTime.now().minusHours(3);
        OffsetDateTime to = OffsetDateTime.now().minusHours(2);

        List<Appointment> completed = appointmentRepository.findCompletedBetween(from, to);

        int sent = 0;
        for (Appointment appt : completed) {
            try {
                String doctorName = appt.getDoctor() != null && appt.getDoctor().getUser() != null
                        ? appt.getDoctor().getUser().getFullName()
                        : "вашего врача";

                notificationService.sendNotification(
                        appt.getPatientId(),
                        Notification.NotificationType.SYSTEM,
                        "Оставьте отзыв",
                        "Как прошёл приём у " + doctorName + "? "
                                + "Ваш отзыв поможет другим пациентам.",
                        Map.of("appointmentId", appt.getId().toString(),
                               "doctorId", appt.getDoctor().getId().toString(),
                               "type", "review_request")
                );
                sent++;
            } catch (Exception e) {
                log.error("Failed to send review request for appointment {}: {}", appt.getId(), e.getMessage());
            }
        }

        if (sent > 0) {
            log.info("[Scheduler] Sent {} review requests", sent);
        }
    }

    // ─── 3. Subscription dunning — runs daily at 09:00 ─────────

    @Scheduled(cron = "0 0 9 * * *") // daily at 09:00
    public void sendSubscriptionDunning() {
        int totalSent = 0;

        for (int daysAhead : new int[]{7, 3, 1}) {
            OffsetDateTime from = OffsetDateTime.now().plusDays(daysAhead).withHour(0).withMinute(0).withSecond(0).withNano(0);
            OffsetDateTime to = from.plusDays(1);

            // Doctors
            List<Doctor> doctors = doctorRepository.findWithExpiringSubscription(from, to);
            for (Doctor doctor : doctors) {
                try {
                    String msg = daysAhead == 1
                            ? "Ваша подписка истекает завтра! Продлите, чтобы не потерять доступ к функциям."
                            : "Ваша подписка истекает через " + daysAhead + " дней. Продлите на выгодных условиях.";

                    notificationService.sendNotification(
                            doctor.getUser().getId(),
                            Notification.NotificationType.SYSTEM,
                            "Подписка истекает",
                            msg,
                            Map.of("type", "subscription_dunning",
                                   "daysLeft", daysAhead,
                                   "entityType", "doctor",
                                   "entityId", doctor.getId().toString())
                    );
                    totalSent++;
                } catch (Exception e) {
                    log.error("Failed dunning for doctor {}: {}", doctor.getId(), e.getMessage());
                }
            }

            // Clinics
            List<Clinic> clinics = clinicRepository.findWithExpiringSubscription(from, to);
            for (Clinic clinic : clinics) {
                try {
                    String msg = daysAhead == 1
                            ? "Подписка клиники «" + clinic.getName() + "» истекает завтра!"
                            : "Подписка клиники «" + clinic.getName() + "» истекает через " + daysAhead + " дней.";

                    notificationService.sendNotification(
                            clinic.getOwnerId(),
                            Notification.NotificationType.SYSTEM,
                            "Подписка клиники истекает",
                            msg,
                            Map.of("type", "subscription_dunning",
                                   "daysLeft", daysAhead,
                                   "entityType", "clinic",
                                   "entityId", clinic.getId().toString())
                    );
                    totalSent++;
                } catch (Exception e) {
                    log.error("Failed dunning for clinic {}: {}", clinic.getId(), e.getMessage());
                }
            }
        }

        if (totalSent > 0) {
            log.info("[Scheduler] Sent {} subscription dunning notifications", totalSent);
        }
    }
}
