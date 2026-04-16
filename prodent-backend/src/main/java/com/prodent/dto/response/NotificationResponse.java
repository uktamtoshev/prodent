package com.prodent.dto.response;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

public record NotificationResponse(
        UUID id,
        String type,
        String title,
        String message,
        Map<String, Object> metadata,
        Boolean isRead,
        OffsetDateTime createdAt
) {}
