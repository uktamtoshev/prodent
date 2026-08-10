# PRODENT

Enterprise dental platform for Central Asia (primary market: Uzbekistan).
Two-sided marketplace: patients find and book dentists; clinics and doctors
run their practice through the built-in CRM.

## Stack

| Layer | Technology |
|---|---|
| Backend | Spring Boot 3.3.5, Java 17, PostgreSQL 17, Redis 7, Flyway |
| Frontend | React 18, Vite 5, TypeScript 5, Tailwind + shadcn/ui, TanStack Query |
| Infra | Docker Compose (dev), nginx (prod frontend) |

## Repository model

This is the standalone `prodent-front` repository. In the full local workspace
it is cloned as `PRODENT/prodent-frontend` next to the backend files. Frontend
commits and CI run from this repository root; backend CI runs separately.

## Full workspace layout

```
PRODENT/
├── prodent-backend/       # Spring Boot API
├── prodent-frontend/      # this standalone repository
├── docker-compose.yml     # Postgres + Redis + backend + frontend
├── start.sh / stop.sh     # One-click local dev
└── archive/               # Legacy code, gitignored (Supabase project, old frontend)
```

## Frontend quick start

Prerequisites: Node 20+ and a running PRODENT backend.

```bash
npm ci --legacy-peer-deps
npm run dev
npm run test:run
npm run typecheck
npm run build
```

## MVP roadmap — COMPLETE

All 20 stages implemented. See `ops/` for launch artifacts.

| Phase | Stages | Status |
|---|---|---|
| 1 — Security | 1–5 (cleanup, auth fixes, data proxy, domain auth, SMS) | DONE |
| 2 — Product | 6–10 (payments, scheduler, email, booking, i18n) | DONE |
| 3 — Tests | 11–12 (unit/integration tests, QA checklist, k6 load test) | DONE |
| 4 — Marketing | 13–16 (analytics, SEO, unified landing, legal) | DONE |
| 5 — Growth & Launch | 17–20 (pricing, referral, pilot ops, launch) | DONE |

## Tests

- **Backend unit:** `PaymentSignatureVerifierTest` — 9 tests (Payme/Click/Uzum signature verification)
- **Backend integration:** `AuthServiceTest` — 11 tests (OTP, login, reset, refresh) via Testcontainers
- **QA:** `qa/regression-checklist.md` — 80+ manual scenarios
- **Load:** `qa/load-test.js` — k6 script (50-100 VU, p95<500ms threshold)

## Environment

Copy `.env.example` to `.env` and set:
- `JWT_SECRET` — required, min 32 chars, no default in prod
- `SMS_LOGIN`, `SMS_PASSWORD` — Playmobile credentials (Stage 5)
- `PAYME_*`, `CLICK_*`, `UZUM_*` — payment provider credentials (Stage 6)

## Operations

- `ops/pilot-onboarding.md` — clinic onboarding checklist + FAQ
- `ops/incident-runbook.md` — severity levels, procedures, post-mortem template
- `ops/launch-checklist.md` — soft launch go/no-go checklist
- `ops/content-plan-q1.md` — 3-month blog + social content plan (24 articles)
- `ops/seed-pilot-data.sql` — demo data (admin, clinic, doctor, patient, services)

## License

Proprietary — all rights reserved.
