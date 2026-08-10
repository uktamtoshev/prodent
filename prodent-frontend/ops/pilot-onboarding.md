# PRODENT — Pilot Clinic Onboarding Checklist

Target: 3–5 clinics in Tashkent for closed pilot (2–4 weeks).

## Pre-Pilot (before first clinic)

### Infrastructure
- [ ] Deploy backend to staging server (VPS/cloud)
- [ ] Set `JWT_SECRET` to a unique production value (min 32 chars)
- [ ] Set `SMS_DRY_RUN=false` and configure `SMS_LOGIN`/`SMS_PASSWORD` (Playmobile)
- [ ] Set `EMAIL_DRY_RUN=false` and configure SMTP (`MAIL_HOST`, `MAIL_USERNAME`, `MAIL_PASSWORD`)
- [ ] Configure PostgreSQL with backups (daily, 7-day retention)
- [ ] Configure Redis
- [ ] Set up HTTPS (Let's Encrypt or Cloudflare)
- [ ] Configure DNS for prodent.uz → staging server
- [ ] Verify `/sitemap.xml` returns dynamic content
- [ ] Submit sitemap to Google Search Console and Yandex Webmaster

### Analytics
- [ ] Create GTM container → set `VITE_GTM_ID`
- [ ] Create GA4 property inside GTM
- [ ] Create Yandex.Metrika counter → set `VITE_YM_ID`
- [ ] Verify events fire: page_view, sign_up, login, booking_started

### Monitoring
- [ ] Set up uptime monitoring (UptimeRobot / Better Stack) for:
  - `https://prodent.uz` (frontend)
  - `https://prodent.uz/actuator/health` (backend)
- [ ] Configure alert channel (Telegram group for team)
- [ ] Test alert: stop backend → confirm alert → restart

### Support
- [ ] Create Telegram group: "PRODENT Pilot Support"
- [ ] Add pilot clinic admins + PRODENT team
- [ ] Create support email: support@prodent.uz
- [ ] Prepare FAQ document for clinic staff (see below)

---

## Per-Clinic Onboarding

### Step 1: Registration (Day 0)
- [ ] Clinic owner registers at prodent.uz/auth (role=clinic)
- [ ] PRODENT team verifies clinic via `/admin/verification`
- [ ] Clinic profile filled: name, address, phone, logo, working hours
- [ ] Assign `CLINIC_ADMIN` role to owner

### Step 2: Staff Setup (Day 0–1)
- [ ] Add doctors as clinic members (CRM → Doctor Requests)
- [ ] Each doctor registers (role=doctor) and completes profile
- [ ] PRODENT team verifies doctors
- [ ] Set up doctor schedules (CRM → Schedule)

### Step 3: Services (Day 1)
- [ ] Add services with prices (CRM → Services)
- [ ] Verify service durations are correct (affects slot generation)

### Step 4: Test Booking (Day 1)
- [ ] Clinic admin books test appointment via PublicBooking
- [ ] Verify: patient gets SMS + email + in-app notification
- [ ] Verify: doctor gets in-app notification
- [ ] Doctor confirms appointment
- [ ] Verify: patient gets confirmation notification
- [ ] Doctor marks as completed
- [ ] Verify: review request sent after 2 hours

### Step 5: Payments (Day 1–2)
- [ ] Clinic tops up virtual balance (Payme/Click test)
- [ ] Verify balance credited after callback
- [ ] Subscribe to Basic/Pro plan
- [ ] Verify plan features unlock in CRM

### Step 6: Go Live (Day 2+)
- [ ] Clinic shares booking link with real patients
- [ ] Monitor first 10 real appointments
- [ ] Collect feedback via Telegram group

---

## Weekly Feedback Loop

Every Friday during pilot:
1. Collect from each clinic:
   - What works well?
   - What's frustrating?
   - What's missing?
   - Any bugs encountered?
2. Prioritize into: hotfix (this week) / next sprint / backlog
3. Share update summary in Telegram group

---

## Pilot Exit Criteria (before soft launch)

- [ ] All 3–5 clinics onboarded and active
- [ ] >= 50 real patient bookings completed
- [ ] No P0 bugs open for > 24 hours
- [ ] NPS >= 7 from clinic admins
- [ ] Payment flow works end-to-end (top-up → subscribe → features unlock)
- [ ] SMS delivery rate > 95%
- [ ] Average booking-to-confirmation time < 4 hours
- [ ] Regression checklist passed (qa/regression-checklist.md)

---

## Clinic Staff FAQ

**Q: Как пациент записывается?**
A: Пациент находит вашу клинику на prodent.uz/clinics, выбирает врача, дату и время, подтверждает номер телефона через SMS-код и получает подтверждение.

**Q: Как мы видим новые записи?**
A: В CRM → Расписание или CRM → Записи. Также приходит уведомление в приложении.

**Q: Как подтвердить запись?**
A: В CRM → Записи → нажать "Подтвердить". Пациент получит SMS.

**Q: Как настроить расписание врача?**
A: CRM → Расписание → выбрать врача → указать дни и часы приёма.

**Q: Куда писать при проблемах?**
A: В Telegram-группу "PRODENT Pilot Support" или на support@prodent.uz.
