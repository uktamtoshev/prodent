# PRODENT — Regression Checklist (MVP)

Run before each release. Mark [x] when passed, [!] when blocked, [-] when N/A.

## Auth (Этап 2 fixes)

### Registration
- [ ] Register with email + password (min 12 chars) → get JWT + welcome email
- [ ] Register with phone + password → get JWT
- [ ] Register with password < 12 chars → 400 error
- [ ] Register with invalid email format → 400 error
- [ ] Register with duplicate email → 400 "already exists"
- [ ] Register with duplicate phone → 400 "already exists"
- [ ] Register without email AND phone → 400 "Email or phone required"

### OTP / Phone Auth
- [ ] Send OTP to valid +998 phone → 200, maskedPhone returned
- [ ] Send OTP to invalid phone format → 400
- [ ] Send OTP > 3 times in 10 min → 429 rate limit
- [ ] Verify with correct code → JWT + user created/returned
- [ ] Verify with wrong code → 400
- [ ] Verify with expired code (>5 min) → 400

### Login
- [ ] Login with correct email + password → JWT
- [ ] Login with correct phone + password → JWT
- [ ] Login with wrong password → 401
- [ ] Login with deactivated user → 401
- [ ] Login > 5 failed attempts → rate limit lock

### Reset Password (S-1 critical fix)
- [ ] Reset without sending OTP first → 400 "Invalid verification code"
- [ ] Reset with wrong OTP code → 400
- [ ] Reset with expired OTP → 400
- [ ] Reset with valid OTP → password changed, can login with new
- [ ] Reset with code already used → 400

### Logout (S-5 fix)
- [ ] Logout with refreshToken in body → that token revoked
- [ ] Logout without refreshToken → ALL tokens revoked
- [ ] After logout, refresh token → 401

### JWT (S-7 fix)
- [ ] App starts with proper JWT_SECRET → OK
- [ ] App starts with default JWT_SECRET → IllegalStateException, won't start
- [ ] App starts with JWT_SECRET < 32 chars → IllegalStateException

## Data Proxy (Этап 3 fixes)

### Access Control (S-2)
- [ ] GET /api/v1/data/profiles without auth → 401
- [ ] GET /api/v1/data/profiles with auth → 200

### Sensitive Tables (S-3)
- [ ] GET /api/v1/data/phone_verifications → 403 "Table not allowed"
- [ ] GET /api/v1/data/audit_logs → 403
- [ ] GET /api/v1/data/virtual_accounts → 403
- [ ] GET /api/v1/data/user_roles → 403
- [ ] GET /api/v1/data/payments → 403

### Read-Only Tables
- [ ] GET /api/v1/data/specialties → 200 (list)
- [ ] POST /api/v1/data/specialties → 403 "read-only or not allowed"
- [ ] GET /api/v1/data/subscription_plans → 200

### Owner Scope
- [ ] GET /api/v1/data/notifications → only current user's notifications
- [ ] GET /api/v1/data/medical_records → only current user's records (as patient)
- [ ] GET /api/v1/data/appointments → only current user's appointments

### Forbidden Columns
- [ ] PATCH /api/v1/data/doctors with is_verified=true → column silently stripped
- [ ] PATCH /api/v1/data/profiles with role=ADMIN → column stripped
- [ ] POST /api/v1/data/doctors with balance=999999 → column stripped

## Domain Logic (Этап 4 fixes)

### Medical Records (S-4)
- [ ] Patient reads own records → 200
- [ ] Doctor who treated patient reads records → 200
- [ ] Doctor who never treated patient reads records → 403
- [ ] Non-doctor reads other patient records → 403

### Booking (S-12, S-14, S-15)
- [ ] Book appointment → endTime calculated from service.duration (not hardcoded 30)
- [ ] Book same slot twice simultaneously → one succeeds, other gets 400
- [ ] Book slot overlapping PENDING appointment → 400
- [ ] GET /api/v1/appointments/doctor (as doctor) → uses Doctor.id, not User.id

## Appointments E2E (Этап 9)
- [ ] Create appointment → patient gets in-app notification
- [ ] Create appointment → patient gets email confirmation (if email set)
- [ ] Create appointment → patient gets SMS confirmation (if phone set)
- [ ] Create appointment → doctor gets in-app notification

## Payments (Этап 6)
- [ ] POST /api/v1/payments/callback/payme with valid signature → 200, balance credited
- [ ] POST /api/v1/payments/callback/payme with invalid signature → 403
- [ ] POST /api/v1/payments/callback/click with tampered amount → 403
- [ ] Same callback twice → idempotent (second call no-op)

## Scheduled Jobs (Этап 7)
- [ ] Tomorrow's confirmed appointments → reminder notification sent
- [ ] Completed appointment 2h ago → review request sent
- [ ] Subscription expiring in 3 days → dunning notification sent

## Localization (Этап 10)
- [ ] Landing page in RU → Russian text
- [ ] Switch to UZ → Landing shows Uzbek text
- [ ] `<html lang>` changes with language switch
- [ ] Footer links work in both languages

## General
- [ ] Swagger UI accessible at /swagger-ui.html
- [ ] Actuator health at /actuator/health → 200
- [ ] 404 page renders correctly
- [ ] Dark/light theme toggle works
