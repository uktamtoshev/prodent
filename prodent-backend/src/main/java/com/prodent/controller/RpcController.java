package com.prodent.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Slf4j
@RestController
@RequestMapping("/api/v1/rpc")
@RequiredArgsConstructor
public class RpcController {

    private final NamedParameterJdbcTemplate namedJdbcTemplate;
    private final ObjectMapper objectMapper;

    @PostMapping("/{functionName}")
    public ResponseEntity<?> callFunction(
            @PathVariable String functionName,
            @RequestBody(required = false) Map<String, Object> body) {

        if (body == null) body = Map.of();

        log.debug("RPC call: {} with params: {}", functionName, body);

        try {
            return switch (functionName) {
                case "check_appointment_limit" -> checkAppointmentLimit(body);
                case "get_plan_features" -> getPlanFeatures(body);
                case "expire_add_on_purchases" -> expireAddOnPurchases();
                case "get_active_add_ons" -> getActiveAddOns(body);
                case "get_add_on_remaining_days" -> getAddOnRemainingDays(body);
                case "get_entity_badges" -> getEntityBadges(body);
                case "can_purchase_add_on" -> canPurchaseAddOn(body);
                case "extend_add_on_purchase" -> extendAddOnPurchase(body);
                case "get_clinic_rooms" -> getClinicRooms(body);
                case "find_patient_by_phone" -> findPatientByPhone(body);
                default -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "Function not found: " + functionName));
            };
        } catch (Exception e) {
            log.error("RPC error in {}: {}", functionName, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== 1. check_appointment_limit ====================

    private ResponseEntity<?> checkAppointmentLimit(Map<String, Object> body) {
        String entityType = getString(body, "p_entity_type");
        String entityId = getString(body, "p_entity_id");

        if (entityType == null || entityId == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "p_entity_type and p_entity_id are required"));
        }

        UUID entityUuid = UUID.fromString(entityId);

        // Count current month's appointments for this entity
        MapSqlParameterSource params = new MapSqlParameterSource();
        params.addValue("entityId", entityUuid);
        params.addValue("monthStart", OffsetDateTime.now().withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0).withNano(0));

        String countSql;
        if ("doctor".equalsIgnoreCase(entityType)) {
            countSql = "SELECT COUNT(*) FROM \"appointments\" WHERE \"doctor_id\" = :entityId AND \"created_at\" >= :monthStart";
        } else if ("clinic".equalsIgnoreCase(entityType)) {
            countSql = "SELECT COUNT(*) FROM \"appointments\" WHERE \"clinic_id\" = :entityId AND \"created_at\" >= :monthStart";
        } else {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid entity_type: " + entityType));
        }

        Integer count = namedJdbcTemplate.queryForObject(countSql, params, Integer.class);
        if (count == null) count = 0;

        // Get plan limit
        int planLimit = getPlanLimitForEntity(entityType, entityUuid);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("current_count", count);
        result.put("plan_limit", planLimit);
        result.put("allowed", count < planLimit);
        result.put("remaining", Math.max(0, planLimit - count));

        return ResponseEntity.ok(result);
    }

    private int getPlanLimitForEntity(String entityType, UUID entityId) {
        try {
            MapSqlParameterSource params = new MapSqlParameterSource();
            params.addValue("entityId", entityId);

            String sql;
            if ("doctor".equalsIgnoreCase(entityType)) {
                sql = "SELECT sp.\"max_appointments\" FROM \"subscription_plans\" sp " +
                      "JOIN \"doctors\" d ON d.\"subscription_plan_id\" = sp.\"id\" " +
                      "WHERE d.\"id\" = :entityId";
            } else {
                sql = "SELECT sp.\"max_appointments\" FROM \"subscription_plans\" sp " +
                      "JOIN \"clinics\" c ON c.\"subscription_plan_id\" = sp.\"id\" " +
                      "WHERE c.\"id\" = :entityId";
            }

            Integer limit = namedJdbcTemplate.queryForObject(sql, params, Integer.class);
            return limit != null ? limit : 100;
        } catch (Exception e) {
            log.debug("Could not fetch plan limit for {} {}: {}", entityType, entityId, e.getMessage());
            return 100; // Default limit
        }
    }

    // ==================== 2. get_plan_features ====================

    private ResponseEntity<?> getPlanFeatures(Map<String, Object> body) {
        String planId = getString(body, "p_plan_id");

        if (planId == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "p_plan_id is required"));
        }

        MapSqlParameterSource params = new MapSqlParameterSource();
        params.addValue("planId", UUID.fromString(planId));

        String sql = "SELECT * FROM \"subscription_plans\" WHERE \"id\" = :planId";

        try {
            Map<String, Object> plan = namedJdbcTemplate.queryForMap(sql, params);
            return ResponseEntity.ok(plan);
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of(
                    "error", "Plan not found",
                    "plan_id", planId
            ));
        }
    }

    // ==================== 3. expire_add_on_purchases ====================

    private ResponseEntity<?> expireAddOnPurchases() {
        String sql = "UPDATE \"add_on_purchases\" SET \"is_active\" = false " +
                     "WHERE \"is_active\" = true AND \"end_date\" < NOW() RETURNING \"id\"";

        List<Map<String, Object>> expired = namedJdbcTemplate.queryForList(sql, new MapSqlParameterSource());

        return ResponseEntity.ok(Map.of(
                "expired_count", expired.size(),
                "expired_ids", expired.stream().map(r -> r.get("id")).toList()
        ));
    }

    // ==================== 4. get_active_add_ons ====================

    private ResponseEntity<?> getActiveAddOns(Map<String, Object> body) {
        String entityType = getString(body, "p_entity_type");
        String entityId = getString(body, "p_entity_id");

        if (entityType == null || entityId == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "p_entity_type and p_entity_id are required"));
        }

        MapSqlParameterSource params = new MapSqlParameterSource();
        params.addValue("entityType", entityType);
        params.addValue("entityId", UUID.fromString(entityId));

        String sql = "SELECT aop.*, aos.\"name\" AS add_on_name, aos.\"description\" AS add_on_description " +
                     "FROM \"add_on_purchases\" aop " +
                     "LEFT JOIN \"add_on_services\" aos ON aos.\"id\" = aop.\"add_on_service_id\" " +
                     "WHERE aop.\"entity_type\" = :entityType " +
                     "AND aop.\"entity_id\" = :entityId " +
                     "AND aop.\"is_active\" = true " +
                     "AND (aop.\"end_date\" IS NULL OR aop.\"end_date\" > NOW())";

        List<Map<String, Object>> results = namedJdbcTemplate.queryForList(sql, params);
        return ResponseEntity.ok(results);
    }

    // ==================== 5. get_add_on_remaining_days ====================

    private ResponseEntity<?> getAddOnRemainingDays(Map<String, Object> body) {
        String purchaseId = getString(body, "p_purchase_id");

        if (purchaseId == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "p_purchase_id is required"));
        }

        MapSqlParameterSource params = new MapSqlParameterSource();
        params.addValue("purchaseId", UUID.fromString(purchaseId));

        String sql = "SELECT \"end_date\" FROM \"add_on_purchases\" WHERE \"id\" = :purchaseId AND \"is_active\" = true";

        try {
            Map<String, Object> row = namedJdbcTemplate.queryForMap(sql, params);
            Object endDateObj = row.get("end_date");
            if (endDateObj == null) {
                return ResponseEntity.ok(Map.of("remaining_days", -1, "unlimited", true));
            }

            LocalDate endDate;
            if (endDateObj instanceof java.sql.Timestamp ts) {
                endDate = ts.toLocalDateTime().toLocalDate();
            } else if (endDateObj instanceof java.sql.Date d) {
                endDate = d.toLocalDate();
            } else if (endDateObj instanceof OffsetDateTime odt) {
                endDate = odt.toLocalDate();
            } else {
                endDate = LocalDate.parse(endDateObj.toString().substring(0, 10));
            }

            long days = ChronoUnit.DAYS.between(LocalDate.now(), endDate);
            return ResponseEntity.ok(Map.of("remaining_days", Math.max(0, days)));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("remaining_days", 0, "error", "Purchase not found"));
        }
    }

    // ==================== 6. get_entity_badges ====================

    private ResponseEntity<?> getEntityBadges(Map<String, Object> body) {
        String entityType = getString(body, "p_entity_type");
        String entityId = getString(body, "p_entity_id");

        if (entityType == null || entityId == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "p_entity_type and p_entity_id are required"));
        }

        MapSqlParameterSource params = new MapSqlParameterSource();
        params.addValue("entityType", entityType);
        params.addValue("entityId", UUID.fromString(entityId));

        String sql = "SELECT ba.*, b.\"name\", b.\"description\", b.\"icon_url\", b.\"badge_type\" " +
                     "FROM \"badge_assignments\" ba " +
                     "JOIN \"badges\" b ON b.\"id\" = ba.\"badge_id\" " +
                     "WHERE ba.\"entity_type\" = :entityType AND ba.\"entity_id\" = :entityId";

        List<Map<String, Object>> results = namedJdbcTemplate.queryForList(sql, params);
        return ResponseEntity.ok(results);
    }

    // ==================== 7. can_purchase_add_on ====================

    private ResponseEntity<?> canPurchaseAddOn(Map<String, Object> body) {
        String entityType = getString(body, "p_entity_type");
        String entityId = getString(body, "p_entity_id");
        String addOnServiceId = getString(body, "p_add_on_service_id");

        if (entityType == null || entityId == null || addOnServiceId == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "p_entity_type, p_entity_id, and p_add_on_service_id are required"));
        }

        MapSqlParameterSource params = new MapSqlParameterSource();
        params.addValue("entityType", entityType);
        params.addValue("entityId", UUID.fromString(entityId));
        params.addValue("addOnServiceId", UUID.fromString(addOnServiceId));

        // Check if there is already an active purchase of the same add-on
        String sql = "SELECT COUNT(*) FROM \"add_on_purchases\" " +
                     "WHERE \"entity_type\" = :entityType " +
                     "AND \"entity_id\" = :entityId " +
                     "AND \"add_on_service_id\" = :addOnServiceId " +
                     "AND \"is_active\" = true " +
                     "AND (\"end_date\" IS NULL OR \"end_date\" > NOW())";

        Integer count = namedJdbcTemplate.queryForObject(sql, params, Integer.class);
        boolean hasActive = count != null && count > 0;

        // Check if add-on service allows multiple purchases
        String addOnSql = "SELECT \"allow_multiple\" FROM \"add_on_services\" WHERE \"id\" = :addOnServiceId";
        try {
            Map<String, Object> addOn = namedJdbcTemplate.queryForMap(addOnSql, params);
            Boolean allowMultiple = (Boolean) addOn.get("allow_multiple");

            boolean canPurchase = !hasActive || Boolean.TRUE.equals(allowMultiple);
            return ResponseEntity.ok(Map.of(
                    "can_purchase", canPurchase,
                    "has_active", hasActive
            ));
        } catch (Exception e) {
            // If allow_multiple column doesn't exist, default behavior
            return ResponseEntity.ok(Map.of(
                    "can_purchase", !hasActive,
                    "has_active", hasActive
            ));
        }
    }

    // ==================== 8. extend_add_on_purchase ====================

    private ResponseEntity<?> extendAddOnPurchase(Map<String, Object> body) {
        String purchaseId = getString(body, "p_purchase_id");
        Integer additionalDays = getInt(body, "p_additional_days");

        if (purchaseId == null || additionalDays == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "p_purchase_id and p_additional_days are required"));
        }

        MapSqlParameterSource params = new MapSqlParameterSource();
        params.addValue("purchaseId", UUID.fromString(purchaseId));
        params.addValue("days", additionalDays);

        String sql = "UPDATE \"add_on_purchases\" " +
                     "SET \"end_date\" = COALESCE(\"end_date\", NOW()) + INTERVAL '1 day' * :days, " +
                     "\"updated_at\" = NOW() " +
                     "WHERE \"id\" = :purchaseId AND \"is_active\" = true " +
                     "RETURNING *";

        List<Map<String, Object>> results = namedJdbcTemplate.queryForList(sql, params);
        if (results.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Active purchase not found"));
        }
        return ResponseEntity.ok(results.get(0));
    }

    // ==================== 9. get_clinic_rooms ====================

    private ResponseEntity<?> getClinicRooms(Map<String, Object> body) {
        String clinicId = getString(body, "p_clinic_id");

        if (clinicId == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "p_clinic_id is required"));
        }

        try {
            MapSqlParameterSource params = new MapSqlParameterSource();
            params.addValue("clinicId", UUID.fromString(clinicId));

            String sql = "SELECT * FROM \"clinic_rooms\" WHERE \"clinic_id\" = :clinicId ORDER BY \"name\"";
            List<Map<String, Object>> results = namedJdbcTemplate.queryForList(sql, params);
            return ResponseEntity.ok(results);
        } catch (Exception e) {
            // Table might not exist
            log.debug("clinic_rooms query failed (table may not exist): {}", e.getMessage());
            return ResponseEntity.ok(List.of());
        }
    }

    // ==================== 10. find_patient_by_phone ====================

    private ResponseEntity<?> findPatientByPhone(Map<String, Object> body) {
        String phone = getString(body, "p_phone");

        if (phone == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "p_phone is required"));
        }

        MapSqlParameterSource params = new MapSqlParameterSource();
        params.addValue("phone", phone.trim());

        String sql = "SELECT p.\"id\", p.\"first_name\", p.\"last_name\", p.\"middle_name\", " +
                     "p.\"phone\", p.\"email\", p.\"avatar_url\", p.\"gender\", p.\"date_of_birth\" " +
                     "FROM \"profiles\" p WHERE p.\"phone\" = :phone";

        List<Map<String, Object>> results = namedJdbcTemplate.queryForList(sql, params);

        if (results.isEmpty()) {
            // Also try users table
            String userSql = "SELECT \"id\", \"first_name\", \"last_name\", \"middle_name\", " +
                             "\"phone\", \"email\", \"avatar_url\", \"gender\", \"date_of_birth\" " +
                             "FROM \"users\" WHERE \"phone\" = :phone";
            results = namedJdbcTemplate.queryForList(userSql, params);
        }

        if (results.isEmpty()) {
            return ResponseEntity.ok(null);
        }
        return ResponseEntity.ok(results.get(0));
    }

    // ==================== Helper Methods ====================

    private String getString(Map<String, Object> body, String key) {
        Object value = body.get(key);
        return value != null ? value.toString() : null;
    }

    private Integer getInt(Map<String, Object> body, String key) {
        Object value = body.get(key);
        if (value == null) return null;
        if (value instanceof Number num) return num.intValue();
        try {
            return Integer.parseInt(value.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
