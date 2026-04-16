package com.prodent.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/v1/data")
@RequiredArgsConstructor
public class DataController {

    private final NamedParameterJdbcTemplate namedJdbcTemplate;
    private final ObjectMapper objectMapper;

    private static final Set<String> ALLOWED_TABLES = Set.of(
            "profiles", "user_roles", "clinics", "clinic_members", "clinic_settings",
            "clinic_applications", "doctors", "doctor_clinic_affiliations", "doctor_applications",
            "doctor_schedules", "doctor_specialties", "specialties", "services", "appointments",
            "appointment_services", "appointments_queue", "medical_records", "dental_chart",
            "treatment_plans", "treatment_plan_items", "virtual_accounts",
            "virtual_account_transactions", "invoices", "payments", "cash_register",
            "doctor_reviews", "clinic_reviews", "doctor_portfolio", "clinic_portfolio",
            "notifications", "chat_rooms", "chat_room_members", "messages", "ad_packages",
            "ad_campaigns", "ad_analytics", "badges", "badge_assignments", "blog_posts",
            "medical_access", "audit_logs", "clinic_followers", "clinic_posts",
            "clinic_post_media", "doctor_posts", "inventory_items", "phone_verifications",
            "email_verifications", "subscription_plans", "add_on_services", "add_on_pricing",
            "add_on_purchases", "clinic_member_permissions", "medical_record_access",
            "doctor_clinic_requests"
    );

    private static final Pattern COLUMN_PATTERN = Pattern.compile("^[a-zA-Z0-9_]+$");
    private static final Pattern IN_VALUES_PATTERN = Pattern.compile("^\\((.+)\\)$");
    private static final Pattern OR_PATTERN = Pattern.compile("^\\((.+)\\)$");

    // Reserved query param keys that are not filters
    private static final Set<String> RESERVED_PARAMS = Set.of(
            "select", "order", "limit", "offset", "range", "single", "maybeSingle", "on_conflict"
    );

    // ==================== GET ====================

    @GetMapping("/{table}")
    public ResponseEntity<?> select(
            @PathVariable String table,
            @RequestParam Map<String, String> allParams,
            HttpServletRequest request) {

        if (!isTableAllowed(table)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Table not allowed: " + table));
        }

        MapSqlParameterSource params = new MapSqlParameterSource();
        int paramIdx = 0;

        // Parse select columns
        String selectClause = "*";
        List<JoinClause> joins = new ArrayList<>();
        if (allParams.containsKey("select")) {
            ParsedSelect parsed = parseSelectClause(allParams.get("select"), table);
            selectClause = parsed.columns;
            joins = parsed.joins;
        }

        // Check for count preference
        boolean countExact = false;
        String prefer = request.getHeader("Prefer");
        if (prefer != null && prefer.contains("count=exact")) {
            countExact = true;
        }

        String countCol = countExact ? ", COUNT(*) OVER() AS __total_count" : "";

        StringBuilder sql = new StringBuilder("SELECT ");
        sql.append(selectClause).append(countCol);
        sql.append(" FROM ").append(sanitizeIdentifier(table));

        // Add joins
        for (JoinClause join : joins) {
            String targetRef = sanitizeIdentifier(join.targetTable);
            // If alias differs from table, use AS
            if (join.alias != null && !join.alias.equals(join.targetTable)) {
                sql.append(" LEFT JOIN ").append(targetRef);
                // Use targetTable ref in ON clause
            } else {
                sql.append(" LEFT JOIN ").append(targetRef);
            }
            sql.append(" ON ").append(sanitizeIdentifier(table)).append(".")
               .append(sanitizeIdentifier(join.foreignKey)).append(" = ")
               .append(targetRef).append(".\"id\"");
        }

        // Parse filters (qualify columns with base table to avoid ambiguity in joins)
        boolean hasJoins = !joins.isEmpty();
        FilterResult filterResult = parseFilters(allParams, params, paramIdx, hasJoins ? table : null);
        paramIdx = filterResult.paramIdx;
        if (!filterResult.conditions.isEmpty()) {
            sql.append(" WHERE ").append(String.join(" AND ", filterResult.conditions));
        }

        // Order
        if (allParams.containsKey("order")) {
            String orderClause = parseOrderClause(allParams.get("order"));
            if (!orderClause.isEmpty()) {
                sql.append(" ORDER BY ").append(orderClause);
            }
        }

        // Limit
        if (allParams.containsKey("limit")) {
            sql.append(" LIMIT :__limit");
            params.addValue("__limit", parseIntSafe(allParams.get("limit"), 1000));
        }

        // Offset
        if (allParams.containsKey("offset")) {
            sql.append(" OFFSET :__offset");
            params.addValue("__offset", parseIntSafe(allParams.get("offset"), 0));
        }

        // Range (from-to)
        if (allParams.containsKey("range")) {
            String[] rangeParts = allParams.get("range").split("-");
            if (rangeParts.length == 2) {
                int from = parseIntSafe(rangeParts[0], 0);
                int to = parseIntSafe(rangeParts[1], from);
                if (!allParams.containsKey("limit")) {
                    sql.append(" LIMIT :__range_limit");
                    params.addValue("__range_limit", to - from + 1);
                }
                if (!allParams.containsKey("offset")) {
                    sql.append(" OFFSET :__range_offset");
                    params.addValue("__range_offset", from);
                }
            }
        }

        log.debug("DataController SELECT SQL: {}", sql);

        List<Map<String, Object>> results = namedJdbcTemplate.queryForList(sql.toString(), params);

        // Strip __total_count from results, extract it
        Long totalCount = null;
        if (countExact && !results.isEmpty()) {
            Object tc = results.get(0).get("__total_count");
            if (tc instanceof Number num) {
                totalCount = num.longValue();
            }
            results = results.stream().map(row -> {
                Map<String, Object> cleaned = new LinkedHashMap<>(row);
                cleaned.remove("__total_count");
                return cleaned;
            }).collect(Collectors.toList());
        }

        // Single object mode
        boolean single = "true".equalsIgnoreCase(allParams.get("single"));
        boolean maybeSingle = "true".equalsIgnoreCase(allParams.get("maybeSingle"));

        if (single || maybeSingle) {
            if (results.isEmpty()) {
                if (single) {
                    return ResponseEntity.status(HttpStatus.NOT_ACCEPTABLE)
                            .body(Map.of("error", "Row not found"));
                }
                return ResponseEntity.ok(null);
            }
            ResponseEntity.BodyBuilder builder = ResponseEntity.ok();
            if (totalCount != null) {
                builder.header("Content-Range", "0-0/" + totalCount);
            }
            return builder.body(results.get(0));
        }

        ResponseEntity.BodyBuilder builder = ResponseEntity.ok();
        if (totalCount != null) {
            builder.header("Content-Range", "0-" + (results.size() - 1) + "/" + totalCount);
        }
        return builder.body(results);
    }

    // ==================== POST (INSERT) ====================

    @PostMapping("/{table}")
    public ResponseEntity<?> insert(
            @PathVariable String table,
            @RequestBody Object body,
            HttpServletRequest request) {

        if (!isTableAllowed(table)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Table not allowed: " + table));
        }

        String prefer = request.getHeader("Prefer");
        boolean returnMinimal = prefer != null && prefer.contains("return=minimal");

        if (body instanceof List<?> list) {
            // Bulk insert
            List<Map<String, Object>> inserted = new ArrayList<>();
            for (Object item : list) {
                @SuppressWarnings("unchecked")
                Map<String, Object> row = (Map<String, Object>) item;
                Map<String, Object> result = insertRow(table, row, returnMinimal);
                if (result != null) inserted.add(result);
            }
            return ResponseEntity.status(HttpStatus.CREATED).body(inserted);
        } else {
            @SuppressWarnings("unchecked")
            Map<String, Object> row = objectMapper.convertValue(body, new TypeReference<Map<String, Object>>() {});
            Map<String, Object> result = insertRow(table, row, returnMinimal);
            if (returnMinimal) {
                return ResponseEntity.status(HttpStatus.CREATED).build();
            }
            // Check if prefer header says return single
            boolean returnSingle = prefer != null && prefer.contains("return=representation");
            return ResponseEntity.status(HttpStatus.CREATED).body(result);
        }
    }

    private Map<String, Object> insertRow(String table, Map<String, Object> row, boolean returnMinimal) {
        if (row.isEmpty()) return Map.of();

        List<String> columns = new ArrayList<>();
        MapSqlParameterSource params = new MapSqlParameterSource();

        for (Map.Entry<String, Object> entry : row.entrySet()) {
            String col = toSnakeCase(entry.getKey());
            if (!isValidColumn(col)) continue;
            columns.add(col);
            params.addValue("v_" + col, convertValue(entry.getValue()));
        }

        if (columns.isEmpty()) return Map.of();

        String colList = columns.stream().map(this::sanitizeIdentifier).collect(Collectors.joining(", "));
        String valList = columns.stream().map(c -> ":v_" + c).collect(Collectors.joining(", "));

        String returning = returnMinimal ? "" : " RETURNING *";
        String sql = "INSERT INTO " + sanitizeIdentifier(table) + " (" + colList + ") VALUES (" + valList + ")" + returning;

        log.debug("DataController INSERT SQL: {}", sql);

        if (returnMinimal) {
            namedJdbcTemplate.update(sql, params);
            return null;
        }
        return namedJdbcTemplate.queryForMap(sql, params);
    }

    // ==================== PATCH (UPDATE) ====================

    @PatchMapping("/{table}")
    public ResponseEntity<?> update(
            @PathVariable String table,
            @RequestParam Map<String, String> allParams,
            @RequestBody Map<String, Object> body,
            HttpServletRequest request) {

        if (!isTableAllowed(table)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Table not allowed: " + table));
        }

        if (body.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No fields to update"));
        }

        MapSqlParameterSource params = new MapSqlParameterSource();
        int paramIdx = 0;

        // Build SET clause
        List<String> setClauses = new ArrayList<>();
        for (Map.Entry<String, Object> entry : body.entrySet()) {
            String col = toSnakeCase(entry.getKey());
            if (!isValidColumn(col)) continue;
            String pName = "set_" + col;
            setClauses.add(sanitizeIdentifier(col) + " = :" + pName);
            params.addValue(pName, convertValue(entry.getValue()));
        }

        if (setClauses.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No valid fields to update"));
        }

        // Parse filters
        FilterResult filterResult = parseFilters(allParams, params, paramIdx, null);

        if (filterResult.conditions.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "UPDATE without filters is not allowed"));
        }

        String prefer = request.getHeader("Prefer");
        boolean returnMinimal = prefer != null && prefer.contains("return=minimal");
        String returning = returnMinimal ? "" : " RETURNING *";

        String sql = "UPDATE " + sanitizeIdentifier(table)
                + " SET " + String.join(", ", setClauses)
                + " WHERE " + String.join(" AND ", filterResult.conditions)
                + returning;

        log.debug("DataController UPDATE SQL: {}", sql);

        if (returnMinimal) {
            namedJdbcTemplate.update(sql, params);
            return ResponseEntity.ok().build();
        }

        List<Map<String, Object>> results = namedJdbcTemplate.queryForList(sql, params);
        if (results.size() == 1) {
            return ResponseEntity.ok(results.get(0));
        }
        return ResponseEntity.ok(results);
    }

    // ==================== PUT (UPSERT) ====================

    @PutMapping("/{table}")
    public ResponseEntity<?> upsert(
            @PathVariable String table,
            @RequestParam Map<String, String> allParams,
            @RequestBody Object body,
            HttpServletRequest request) {

        if (!isTableAllowed(table)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Table not allowed: " + table));
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> row = objectMapper.convertValue(body, new TypeReference<Map<String, Object>>() {});

        if (row.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No fields provided"));
        }

        // Determine conflict column
        String onConflict = allParams.getOrDefault("on_conflict", "id");
        if (!isValidColumn(onConflict)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid on_conflict column"));
        }

        List<String> columns = new ArrayList<>();
        MapSqlParameterSource params = new MapSqlParameterSource();

        for (Map.Entry<String, Object> entry : row.entrySet()) {
            String col = toSnakeCase(entry.getKey());
            if (!isValidColumn(col)) continue;
            columns.add(col);
            params.addValue("v_" + col, convertValue(entry.getValue()));
        }

        if (columns.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No valid fields"));
        }

        String colList = columns.stream().map(this::sanitizeIdentifier).collect(Collectors.joining(", "));
        String valList = columns.stream().map(c -> ":v_" + c).collect(Collectors.joining(", "));

        // Build ON CONFLICT DO UPDATE SET (exclude the conflict column)
        String updateSet = columns.stream()
                .filter(c -> !c.equals(onConflict))
                .map(c -> sanitizeIdentifier(c) + " = EXCLUDED." + sanitizeIdentifier(c))
                .collect(Collectors.joining(", "));

        String prefer = request.getHeader("Prefer");
        boolean returnMinimal = prefer != null && prefer.contains("return=minimal");
        String returning = returnMinimal ? "" : " RETURNING *";

        String sql;
        if (updateSet.isEmpty()) {
            sql = "INSERT INTO " + sanitizeIdentifier(table) + " (" + colList + ") VALUES (" + valList + ")"
                    + " ON CONFLICT (" + sanitizeIdentifier(onConflict) + ") DO NOTHING" + returning;
        } else {
            sql = "INSERT INTO " + sanitizeIdentifier(table) + " (" + colList + ") VALUES (" + valList + ")"
                    + " ON CONFLICT (" + sanitizeIdentifier(onConflict) + ") DO UPDATE SET " + updateSet
                    + returning;
        }

        log.debug("DataController UPSERT SQL: {}", sql);

        if (returnMinimal) {
            namedJdbcTemplate.update(sql, params);
            return ResponseEntity.ok().build();
        }

        Map<String, Object> result = namedJdbcTemplate.queryForMap(sql, params);
        return ResponseEntity.ok(result);
    }

    // ==================== DELETE ====================

    @DeleteMapping("/{table}")
    public ResponseEntity<?> delete(
            @PathVariable String table,
            @RequestParam Map<String, String> allParams,
            HttpServletRequest request) {

        if (!isTableAllowed(table)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Table not allowed: " + table));
        }

        MapSqlParameterSource params = new MapSqlParameterSource();
        FilterResult filterResult = parseFilters(allParams, params, 0, null);

        if (filterResult.conditions.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "DELETE without filters is not allowed"));
        }

        String prefer = request.getHeader("Prefer");
        boolean returnMinimal = prefer == null || !prefer.contains("return=representation");
        String returning = returnMinimal ? "" : " RETURNING *";

        String sql = "DELETE FROM " + sanitizeIdentifier(table)
                + " WHERE " + String.join(" AND ", filterResult.conditions)
                + returning;

        log.debug("DataController DELETE SQL: {}", sql);

        if (returnMinimal) {
            int deleted = namedJdbcTemplate.update(sql, params);
            return ResponseEntity.ok(Map.of("count", deleted));
        }

        List<Map<String, Object>> results = namedJdbcTemplate.queryForList(sql, params);
        return ResponseEntity.ok(results);
    }

    // ==================== Filter Parsing ====================
    // PostgREST / Supabase format: column=op.value (e.g. is_active=eq.true, start_date=lte.2026-04-04)

    private FilterResult parseFilters(Map<String, String> allParams, MapSqlParameterSource params, int paramIdx, String baseTable) {
        List<String> conditions = new ArrayList<>();

        for (Map.Entry<String, String> entry : allParams.entrySet()) {
            String key = entry.getKey();
            String value = entry.getValue();

            if (RESERVED_PARAMS.contains(key)) continue;

            // Handle or=(filter1,filter2)
            if (key.equals("or")) {
                String orCondition = parseOrFilter(value, params, paramIdx);
                if (orCondition != null) {
                    conditions.add(orCondition);
                    paramIdx += 100;
                }
                continue;
            }

            // Handle and=(filter1,filter2)
            if (key.equals("and")) {
                String andCondition = parseAndFilter(value, params, paramIdx);
                if (andCondition != null) {
                    conditions.add(andCondition);
                    paramIdx += 100;
                }
                continue;
            }

            // PostgREST format: column=op.value
            // The key is the column name, and the value starts with operator prefix
            // Examples: is_active=eq.true, name=ilike.%john%, id=in.(1,2,3), status=not.eq.active, doctor_id=not.is.null
            String column = key;
            if (!isValidColumn(column)) continue;

            // Parse the value to extract operator and actual value
            // Handle negation: not.op.value
            boolean negate = false;
            String opValue = value;
            if (opValue.startsWith("not.")) {
                negate = true;
                opValue = opValue.substring(4);
            }

            // Extract operator (everything before the first '.')
            int dotIdx = opValue.indexOf('.');
            if (dotIdx < 0) {
                // No operator, treat entire value as eq
                String pName = "p" + paramIdx++;
                params.addValue(pName, castValue(opValue));
                String colRef = baseTable != null
                        ? sanitizeIdentifier(baseTable) + "." + sanitizeIdentifier(column)
                        : sanitizeIdentifier(column);
                conditions.add(colRef + " = :" + pName);
                continue;
            }

            String op = opValue.substring(0, dotIdx);
            String val = opValue.substring(dotIdx + 1);

            String pName = "p" + paramIdx++;
            String cond = buildCondition(column, op, val, pName, params, negate, baseTable);
            if (cond != null) conditions.add(cond);
        }

        return new FilterResult(conditions, paramIdx);
    }

    private String buildCondition(String column, String op, String value,
                                  String pName, MapSqlParameterSource params, boolean negate) {
        return buildCondition(column, op, value, pName, params, negate, null);
    }

    private String buildCondition(String column, String op, String value,
                                  String pName, MapSqlParameterSource params, boolean negate, String baseTable) {
        String colRef = baseTable != null
                ? sanitizeIdentifier(baseTable) + "." + sanitizeIdentifier(column)
                : sanitizeIdentifier(column);
        String prefix = negate ? "NOT " : "";

        return switch (op) {
            case "eq" -> {
                params.addValue(pName, castValue(value));
                yield prefix + colRef + " = :" + pName;
            }
            case "neq" -> {
                params.addValue(pName, castValue(value));
                yield colRef + " != :" + pName;
            }
            case "gt" -> {
                params.addValue(pName, castValue(value));
                yield prefix + colRef + " > :" + pName;
            }
            case "gte" -> {
                params.addValue(pName, castValue(value));
                yield prefix + colRef + " >= :" + pName;
            }
            case "lt" -> {
                params.addValue(pName, castValue(value));
                yield prefix + colRef + " < :" + pName;
            }
            case "lte" -> {
                params.addValue(pName, castValue(value));
                yield prefix + colRef + " <= :" + pName;
            }
            case "like" -> {
                params.addValue(pName, value);
                yield prefix + colRef + " LIKE :" + pName;
            }
            case "ilike" -> {
                params.addValue(pName, value);
                yield prefix + colRef + " ILIKE :" + pName;
            }
            case "is" -> {
                yield switch (value.toLowerCase()) {
                    case "null" -> prefix + colRef + " IS NULL";
                    case "true" -> prefix + colRef + " IS TRUE";
                    case "false" -> prefix + colRef + " IS FALSE";
                    default -> null;
                };
            }
            case "in" -> {
                Matcher m = IN_VALUES_PATTERN.matcher(value);
                if (m.matches()) {
                    String innerValues = m.group(1);
                    String[] parts = innerValues.split(",");
                    List<Object> inList = new ArrayList<>();
                    for (String part : parts) {
                        inList.add(castValue(part.trim()));
                    }
                    params.addValue(pName, inList);
                    yield prefix + colRef + " IN (:" + pName + ")";
                }
                yield null;
            }
            default -> null;
        };
    }

    private String parseOrFilter(String orValue, MapSqlParameterSource params, int baseIdx) {
        Matcher m = OR_PATTERN.matcher(orValue);
        if (!m.matches()) return null;

        String inner = m.group(1);
        List<String> parts = splitOrParts(inner);
        List<String> orConditions = new ArrayList<>();
        int idx = baseIdx;

        for (String part : parts) {
            // PostgREST or() format: column.op.value (e.g. name.ilike.%john%,city.eq.Tashkent)
            int firstDot = part.indexOf('.');
            if (firstDot < 0) continue;

            String column = part.substring(0, firstDot);
            String rest = part.substring(firstDot + 1);

            if (!isValidColumn(column)) continue;

            // rest = op.value (e.g. "ilike.%john%" or "eq.Tashkent" or "is.null")
            int secondDot = rest.indexOf('.');
            String op, val;
            if (secondDot < 0) {
                op = rest;
                val = "";
            } else {
                op = rest.substring(0, secondDot);
                val = rest.substring(secondDot + 1);
            }

            String pName = "or" + idx++;
            String cond = buildCondition(column, op, val, pName, params, false);
            if (cond != null) orConditions.add(cond);
        }

        if (orConditions.isEmpty()) return null;
        return "(" + String.join(" OR ", orConditions) + ")";
    }

    private String parseAndFilter(String andValue, MapSqlParameterSource params, int baseIdx) {
        Matcher m = OR_PATTERN.matcher(andValue);
        if (!m.matches()) return null;

        String inner = m.group(1);
        List<String> parts = splitOrParts(inner);
        List<String> andConditions = new ArrayList<>();
        int idx = baseIdx;

        for (String part : parts) {
            int firstDot = part.indexOf('.');
            if (firstDot < 0) continue;

            String column = part.substring(0, firstDot);
            String rest = part.substring(firstDot + 1);

            if (!isValidColumn(column)) continue;

            int secondDot = rest.indexOf('.');
            String op, val;
            if (secondDot < 0) {
                op = rest;
                val = "";
            } else {
                op = rest.substring(0, secondDot);
                val = rest.substring(secondDot + 1);
            }

            String pName = "and" + idx++;
            String cond = buildCondition(column, op, val, pName, params, false);
            if (cond != null) andConditions.add(cond);
        }

        if (andConditions.isEmpty()) return null;
        return "(" + String.join(" AND ", andConditions) + ")";
    }

    private List<String> splitOrParts(String input) {
        List<String> parts = new ArrayList<>();
        int depth = 0;
        StringBuilder current = new StringBuilder();
        for (char c : input.toCharArray()) {
            if (c == '(') depth++;
            else if (c == ')') depth--;
            else if (c == ',' && depth == 0) {
                parts.add(current.toString().trim());
                current = new StringBuilder();
                continue;
            }
            current.append(c);
        }
        if (!current.isEmpty()) parts.add(current.toString().trim());
        return parts;
    }

    // ==================== SELECT Parsing ====================

    private ParsedSelect parseSelectClause(String selectParam, String baseTable) {
        List<String> columns = new ArrayList<>();
        List<JoinClause> joins = new ArrayList<>();

        // Parse comma-separated but respect parentheses for nested selects
        List<String> parts = splitSelectParts(selectParam);

        for (String part : parts) {
            part = part.trim();
            if (part.isEmpty()) continue;

            // Check for nested select: table(cols) or table:fk_column(cols) or table!hint(cols)
            int parenIdx = part.indexOf('(');
            if (parenIdx > 0 && part.endsWith(")")) {
                String joinSpec = part.substring(0, parenIdx).trim();
                String innerCols = part.substring(parenIdx + 1, part.length() - 1).trim();

                // Parse join spec: can be "table", "table:fk_column", "alias:table!hint"
                String joinTable;
                String fk = null;
                String joinAlias;

                // Handle !inner or !left hints
                int bangIdx = joinSpec.indexOf('!');
                if (bangIdx > 0) {
                    joinSpec = joinSpec.substring(0, bangIdx);
                }

                // Handle table:fk_column syntax (Supabase foreign key hint)
                int colonIdx = joinSpec.indexOf(':');
                if (colonIdx > 0) {
                    // Could be alias:table or table:fk_column
                    String left = joinSpec.substring(0, colonIdx).trim();
                    String right = joinSpec.substring(colonIdx + 1).trim();

                    // If right part looks like a column name (ends with _id or is a known fk)
                    if (right.endsWith("_id") || right.equals("id")) {
                        // table:fk_column — left is alias/table name, right is FK
                        joinTable = resolveTableName(left);
                        joinAlias = left;
                        fk = right;
                    } else if (isTableAllowed(right) || tableViewExists(right)) {
                        // alias:table
                        joinTable = right;
                        joinAlias = left;
                    } else {
                        // Treat as table:fk_column where left is table, right is fk
                        joinTable = resolveTableName(left);
                        joinAlias = left;
                        fk = right;
                    }
                } else {
                    joinTable = resolveTableName(joinSpec);
                    joinAlias = joinSpec;
                }

                if (isTableAllowed(joinTable) || tableViewExists(joinTable)) {
                    if (fk == null) {
                        fk = guessForeignKey(joinTable);
                    }
                    joins.add(new JoinClause(joinTable, fk, joinAlias));

                    // Add join columns with alias prefix
                    for (String innerCol : innerCols.split(",")) {
                        innerCol = innerCol.trim();
                        if (isValidColumn(innerCol)) {
                            columns.add(sanitizeIdentifier(joinTable) + "." + sanitizeIdentifier(innerCol)
                                    + " AS " + sanitizeIdentifier(joinAlias + "_" + innerCol));
                        }
                    }
                }
            } else {
                if (isValidColumn(part)) {
                    columns.add(sanitizeIdentifier(baseTable) + "." + sanitizeIdentifier(part));
                } else if (part.equals("*")) {
                    columns.add(sanitizeIdentifier(baseTable) + ".*");
                }
            }
        }

        String colStr = columns.isEmpty() ? "*" : String.join(", ", columns);
        return new ParsedSelect(colStr, joins);
    }

    // Resolve table name — handles "profiles" -> "users" view mapping
    private String resolveTableName(String name) {
        // profiles is a VIEW on users table
        return name;
    }

    // Check if table/view exists (for views like profiles)
    private boolean tableViewExists(String name) {
        return "profiles".equals(name) || ALLOWED_TABLES.contains(name.toLowerCase());
    }

    private List<String> splitSelectParts(String input) {
        List<String> parts = new ArrayList<>();
        int depth = 0;
        StringBuilder current = new StringBuilder();
        for (char c : input.toCharArray()) {
            if (c == '(') depth++;
            else if (c == ')') depth--;
            else if (c == ',' && depth == 0) {
                parts.add(current.toString());
                current = new StringBuilder();
                continue;
            }
            current.append(c);
        }
        if (!current.isEmpty()) parts.add(current.toString());
        return parts;
    }

    private String guessForeignKey(String joinTable) {
        // Remove trailing 's' for singular form, add _id
        String singular = joinTable.endsWith("ies")
                ? joinTable.substring(0, joinTable.length() - 3) + "y"
                : joinTable.endsWith("s")
                ? joinTable.substring(0, joinTable.length() - 1)
                : joinTable;
        return singular + "_id";
    }

    // ==================== ORDER Parsing ====================

    private String parseOrderClause(String orderParam) {
        List<String> orderParts = new ArrayList<>();
        for (String part : orderParam.split(",")) {
            part = part.trim();
            if (part.isEmpty()) continue;

            String[] tokens = part.split("\\.");
            if (tokens.length >= 1 && isValidColumn(tokens[0])) {
                String dir = "ASC";
                if (tokens.length >= 2) {
                    dir = "desc".equalsIgnoreCase(tokens[1]) ? "DESC" : "ASC";
                }
                String nullsClause = "";
                if (tokens.length >= 3) {
                    if ("nullsfirst".equalsIgnoreCase(tokens[2])) nullsClause = " NULLS FIRST";
                    else if ("nullslast".equalsIgnoreCase(tokens[2])) nullsClause = " NULLS LAST";
                }
                orderParts.add(sanitizeIdentifier(tokens[0]) + " " + dir + nullsClause);
            }
        }
        return String.join(", ", orderParts);
    }

    // ==================== Utility Methods ====================

    private boolean isTableAllowed(String table) {
        return ALLOWED_TABLES.contains(table.toLowerCase());
    }

    private boolean isValidColumn(String col) {
        return col != null && COLUMN_PATTERN.matcher(col).matches() && col.length() <= 64;
    }

    private String sanitizeIdentifier(String identifier) {
        // Double-quote the identifier to handle reserved words, after validating format
        if (!isValidColumn(identifier) && !ALLOWED_TABLES.contains(identifier.toLowerCase())) {
            throw new IllegalArgumentException("Invalid identifier: " + identifier);
        }
        return "\"" + identifier + "\"";
    }

    private static final Pattern ISO_DATETIME_PATTERN = Pattern.compile(
            "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}.*");
    private static final Pattern ISO_DATE_PATTERN = Pattern.compile(
            "^\\d{4}-\\d{2}-\\d{2}$");

    private Object castValue(String value) {
        if (value == null) return null;
        if ("null".equalsIgnoreCase(value)) return null;
        if ("true".equalsIgnoreCase(value)) return true;
        if ("false".equalsIgnoreCase(value)) return false;

        // Try UUID
        if (value.matches("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")) {
            try {
                return UUID.fromString(value);
            } catch (Exception ignored) {}
        }

        // Try ISO datetime (e.g. 2026-04-04T10:37:47.424Z)
        if (ISO_DATETIME_PATTERN.matcher(value).matches()) {
            try {
                return OffsetDateTime.parse(value, DateTimeFormatter.ISO_OFFSET_DATE_TIME);
            } catch (DateTimeParseException e) {
                try {
                    // Try without offset (append Z)
                    return OffsetDateTime.parse(value + "Z", DateTimeFormatter.ISO_OFFSET_DATE_TIME);
                } catch (DateTimeParseException ignored) {}
            }
        }

        // Try ISO date (e.g. 2026-04-04)
        if (ISO_DATE_PATTERN.matcher(value).matches()) {
            try {
                return java.sql.Date.valueOf(value);
            } catch (Exception ignored) {}
        }

        // Try integer
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException ignored) {}

        // Try decimal
        try {
            return Double.parseDouble(value);
        } catch (NumberFormatException ignored) {}

        return value;
    }

    private Object convertValue(Object value) {
        if (value == null) return null;
        if (value instanceof Map || value instanceof List) {
            try {
                // Convert complex objects to JSONB-compatible string
                return objectMapper.writeValueAsString(value);
            } catch (Exception e) {
                log.warn("Failed to convert value to JSON: {}", e.getMessage());
                return value.toString();
            }
        }
        // Handle UUID strings
        if (value instanceof String str && str.matches("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")) {
            try {
                return UUID.fromString(str);
            } catch (Exception ignored) {}
        }
        return value;
    }

    private String toSnakeCase(String camelCase) {
        if (camelCase == null) return null;
        // If already snake_case, return as-is
        if (camelCase.contains("_") || camelCase.equals(camelCase.toLowerCase())) {
            return camelCase;
        }
        return camelCase.replaceAll("([a-z])([A-Z])", "$1_$2").toLowerCase();
    }

    private int parseIntSafe(String value, int defaultValue) {
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    // ==================== Inner Classes ====================

    private record FilterResult(List<String> conditions, int paramIdx) {}
    private record ParsedSelect(String columns, List<JoinClause> joins) {}
    private record JoinClause(String targetTable, String foreignKey, String alias) {}
}
