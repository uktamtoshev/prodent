package com.prodent.service;

import com.prodent.dto.response.NotificationResponse;
import com.prodent.entity.Notification;
import com.prodent.exception.EntityNotFoundException;
import com.prodent.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional
    @Async("asyncExecutor")
    public void sendNotification(UUID userId, Notification.NotificationType type,
                                 String title, String message, Map<String, Object> metadata) {
        Notification notification = Notification.builder()
                .userId(userId)
                .type(type)
                .title(title)
                .message(message)
                .metadata(metadata)
                .build();

        notification = notificationRepository.save(notification);

        // Send via WebSocket
        try {
            NotificationResponse response = mapToResponse(notification);
            messagingTemplate.convertAndSendToUser(
                    userId.toString(), "/queue/notifications", response);
        } catch (Exception e) {
            log.warn("Failed to send WebSocket notification to user {}: {}", userId, e.getMessage());
        }

        log.debug("Notification sent to user {}: {}", userId, title);
    }

    @Transactional(readOnly = true)
    public Page<NotificationResponse> getUserNotifications(UUID userId, Pageable pageable) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable)
                .map(this::mapToResponse);
    }

    @Transactional(readOnly = true)
    public long getUnreadCount(UUID userId) {
        return notificationRepository.countByUserIdAndIsReadFalse(userId);
    }

    @Transactional
    public void markAsRead(UUID notificationId, UUID userId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new EntityNotFoundException("Notification", notificationId));

        if (!notification.getUserId().equals(userId)) {
            throw new EntityNotFoundException("Notification", notificationId);
        }

        notification.setIsRead(true);
        notification.setReadAt(OffsetDateTime.now());
        notificationRepository.save(notification);
    }

    @Transactional
    public void markAllAsRead(UUID userId) {
        notificationRepository.markAllAsRead(userId);
    }

    private NotificationResponse mapToResponse(Notification notification) {
        return new NotificationResponse(
                notification.getId(),
                notification.getType().name(),
                notification.getTitle(),
                notification.getMessage(),
                notification.getMetadata(),
                notification.getIsRead(),
                notification.getCreatedAt()
        );
    }
}
