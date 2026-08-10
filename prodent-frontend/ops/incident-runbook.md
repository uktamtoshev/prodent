# PRODENT — Incident Runbook

## Severity Levels

| Level | Description | Response Time | Examples |
|---|---|---|---|
| **P0** | Service down, data loss risk | < 15 min | Backend crash, DB corruption, payment double-charge |
| **P1** | Major feature broken | < 1 hour | Login broken, bookings fail, SMS not sending |
| **P2** | Minor feature broken | < 4 hours | Notification delay, UI glitch, slow search |
| **P3** | Cosmetic / low impact | Next business day | Typo, wrong color, minor layout issue |

## Alert Channels

| Channel | Purpose |
|---|---|
| Telegram: "PRODENT Ops" | Team alerts, P0/P1 incidents |
| Email: ops@prodent.uz | Non-urgent alerts, daily summaries |
| UptimeRobot/Better Stack | Automated uptime/health checks |

---

## Incident Procedures

### P0: Service Down

1. **Acknowledge** in Telegram within 5 min
2. **Diagnose:**
   ```bash
   # Check backend
   curl -f https://prodent.uz/actuator/health

   # Check logs
   ssh prodent-server
   tail -100 /opt/prodent/.logs/backend.log

   # Check PostgreSQL
   pg_isready -h localhost -U prodent

   # Check Redis
   redis-cli ping

   # Check disk space
   df -h
   ```
3. **Common fixes:**
   - Backend OOM → restart: `systemctl restart prodent-backend`
   - DB connection pool exhausted → restart backend
   - Disk full → clear old logs: `find /opt/prodent/.logs -name "*.log" -mtime +7 -delete`
   - Redis down → restart: `systemctl restart redis`
4. **Escalate** if not resolved in 15 min → call team lead
5. **Post-mortem** within 24 hours (see template below)

### P1: Feature Broken

1. **Acknowledge** in Telegram within 15 min
2. **Reproduce** the issue (get user ID, timestamp, endpoint)
3. **Check logs:**
   ```bash
   grep "ERROR" /opt/prodent/.logs/backend.log | tail -50
   grep "<user_id>" /opt/prodent/.logs/backend.log | tail -20
   ```
4. **Hotfix** if possible, deploy within 2 hours
5. **Notify** affected users via Telegram support group

### P0 Specific: Payment Issues

1. **NEVER manually modify** virtual_accounts or payments tables
2. Check transaction status:
   ```sql
   SELECT * FROM virtual_account_transactions
   WHERE reference_id = '<tx_id>' ORDER BY created_at DESC;
   ```
3. If double-charge detected:
   - Verify via provider dashboard (Payme/Click/Uzum)
   - If confirmed, create manual REFUND transaction
4. **Log every action** taken

### P1 Specific: SMS Not Sending

1. Check SMS config: `SMS_DRY_RUN` should be `false`
2. Check Playmobile balance / credentials
3. Test manually:
   ```bash
   curl -X POST https://send.smsxabar.uz/broker-api/send \
     -u "$SMS_LOGIN:$SMS_PASSWORD" \
     -H "Content-Type: application/json" \
     -d '{"messages":[{"recipient":"+998901234567","message-id":"test-1","sms":{"originator":"PRODENT","content":{"text":"Test"}}}]}'
   ```
4. If provider is down → switch `SMS_DRY_RUN=true` temporarily, notify clinics

---

## Rollback Procedure

```bash
# List recent deployments
git log --oneline -10

# Rollback to previous version
git checkout <previous_commit_hash>
mvn package -DskipTests
systemctl restart prodent-backend

# Verify
curl -f https://prodent.uz/actuator/health
```

---

## Post-Mortem Template

```
## Incident: [Title]
**Date:** YYYY-MM-DD HH:MM - HH:MM (UZT)
**Severity:** P0/P1/P2
**Impact:** [Who was affected, how many users, what broke]

### Timeline
- HH:MM — Issue detected by [monitoring/user report]
- HH:MM — Team acknowledged
- HH:MM — Root cause identified
- HH:MM — Fix deployed
- HH:MM — Verified resolution

### Root Cause
[What exactly went wrong]

### Fix Applied
[What was done to resolve]

### Action Items
- [ ] [Preventive measure 1]
- [ ] [Preventive measure 2]
- [ ] [Monitoring improvement]
```

---

## Key Contacts

| Role | Name | Phone | Telegram |
|---|---|---|---|
| Tech Lead | TBD | TBD | TBD |
| Backend Dev | TBD | TBD | TBD |
| DevOps | TBD | TBD | TBD |
| Product Owner | TBD | TBD | TBD |
