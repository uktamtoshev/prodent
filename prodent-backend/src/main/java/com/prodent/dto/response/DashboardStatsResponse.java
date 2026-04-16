package com.prodent.dto.response;

import java.math.BigDecimal;

public record DashboardStatsResponse(
        long totalPatients,
        long totalAppointments,
        long completedToday,
        BigDecimal revenue,
        long pendingAppointments
) {}
