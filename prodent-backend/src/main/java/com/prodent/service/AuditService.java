package com.prodent.service;

import com.prodent.entity.AuditLog;
import com.prodent.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    @Async("asyncExecutor")
    @Transactional
    public void log(UUID userId, String action, String entityType, UUID entityId,
                    Object oldValues, Object newValues, String ip, String userAgent) {
        try {
            AuditLog auditLog = AuditLog.builder()
                    .userId(userId)
                    .action(action)
                    .entityType(entityType)
                    .entityId(entityId)
                    .oldValues(oldValues instanceof Map ? castToMap(oldValues) : null)
                    .newValues(newValues instanceof Map ? castToMap(newValues) : null)
                    .ipAddress(ip)
                    .userAgent(userAgent)
                    .build();

            auditLogRepository.save(auditLog);
            log.debug("Audit log: user={} action={} entity={}:{}", userId, action, entityType, entityId);
        } catch (Exception e) {
            log.error("Failed to save audit log", e);
        }
    }

    @Transactional(readOnly = true)
    public Page<AuditLog> getAuditLogs(String entityType, UUID entityId, Pageable pageable) {
        return auditLogRepository.findByEntityTypeAndEntityId(entityType, entityId, pageable);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> castToMap(Object obj) {
        return (Map<String, Object>) obj;
    }
}
