package com.prodent.dto.response;

import java.time.OffsetDateTime;
import java.util.Map;

public record ApiError(
        int status,
        String message,
        OffsetDateTime timestamp,
        Map<String, String> errors
) {}
