# PRODENT — Soft Launch Checklist

Complete ALL items before opening to public traffic.

## Infrastructure (must be green)

- [ ] Production server deployed and running
- [ ] HTTPS configured with valid certificate
- [ ] DNS: prodent.uz → production server
- [ ] PostgreSQL: production instance with daily backups
- [ ] Redis: production instance running
- [ ] `JWT_SECRET` is unique, >= 32 chars, NOT a default value
- [ ] `SMS_DRY_RUN=false`, Playmobile credentials configured and tested
- [ ] `EMAIL_DRY_RUN=false`, SMTP configured and tested (send test email)
- [ ] File uploads configured (`STORAGE_PATH` writable, max 10MB)
- [ ] Backend health check: `curl https://prodent.uz/actuator/health` → 200

## Security (must be green)

- [ ] All security fixes from Étapes 2–4 verified in production
- [ ] `phone_verifications` NOT accessible via `/api/v1/data/`
- [ ] `/api/v1/data/**` requires authentication (no public GET)
- [ ] Payment callbacks reject invalid signatures (test with curl)
- [ ] Rate limiting works: 3 OTP/10min, 5 login/15min
- [ ] CORS configured for production domain only

## Analytics & Monitoring

- [ ] Google Tag Manager: `VITE_GTM_ID` set, verified in browser
- [ ] GA4: events firing (page_view, sign_up, login, booking_started)
- [ ] Yandex.Metrika: `VITE_YM_ID` set, webvisor working
- [ ] Uptime monitoring active (frontend + backend health)
- [ ] Alert channel configured (Telegram ops group)
- [ ] Error rate baseline established (first 24h observation)

## SEO

- [ ] `https://prodent.uz/sitemap.xml` returns dynamic sitemap with doctors/clinics
- [ ] Sitemap submitted to Google Search Console
- [ ] Sitemap submitted to Yandex Webmaster
- [ ] `robots.txt` accessible and correct
- [ ] og:image file exists at `https://prodent.uz/og-image.png`
- [ ] PageMeta renders unique titles on: /, /search, /clinics, /pricing
- [ ] Schema.org JSON-LD on Landing (WebSiteSchema)

## Content

- [ ] At least 10 blog articles published
- [ ] At least 5 clinics with verified profiles
- [ ] At least 10 verified doctors with photos
- [ ] Promotions page has at least 3 active promotions
- [ ] /terms, /privacy, /contacts pages reviewed by legal

## User Flows (manual smoke test)

- [ ] Patient: register → search → view doctor → book → get SMS + email
- [ ] Doctor: register → fill profile → get verified → see appointments
- [ ] Clinic: register → fill profile → add doctors → manage schedule
- [ ] Admin: login → verify clinic → verify doctor → view stats
- [ ] Payment: top-up via Payme (test mode) → balance credited
- [ ] Referral: share link → friend registers → both get bonus

## Marketing Launch Day

- [ ] Social media accounts ready: Instagram, Telegram channel
- [ ] Press release drafted for Spot.uz / Gazeta.uz
- [ ] Telegram channel: first post with launch announcement
- [ ] Instagram: 3 launch posts scheduled (day-of + day+1 + day+3)
- [ ] Google Ads campaign configured (paused, ready to activate)
- [ ] Yandex Direct campaign configured (paused, ready to activate)

## Team Readiness

- [ ] Incident runbook reviewed by all team members
- [ ] On-call rotation established (who covers weekends)
- [ ] Support email monitored: support@prodent.uz
- [ ] Telegram support group active
- [ ] Escalation contacts filled in incident-runbook.md

## Post-Launch (first 72 hours)

- [ ] Monitor error rate every 4 hours
- [ ] Check SMS delivery reports daily
- [ ] Review GA4 / Метрика real-time for anomalies
- [ ] Respond to support requests within 2 hours
- [ ] Daily standup for first week (15 min, production focus)
