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

## Repository layout

```
PRODENT/
├── prodent-backend/       # Spring Boot API
├── prodent-frontend/      # React SPA (canonical)
├── docker-compose.yml     # Postgres + Redis + backend + frontend
├── start.sh / stop.sh     # One-click local dev
└── archive/               # Legacy code, gitignored (Supabase project, old frontend)
```

## Quick start

Prerequisites: PostgreSQL 17, Redis 7, Java 17, Maven 3.9+, Node 20+.

```bash
./start.sh                       # starts PG, Redis, backend, Vite dev server
open http://localhost:5173       # frontend
open http://localhost:8080/swagger-ui.html   # API docs
```

Default admin credentials (dev seed): `admin@prodent.uz` / `Test123!`.

Stop: `./stop.sh`.

## MVP roadmap

The project follows a 20-stage MVP launch plan (see team planning docs).
Current stage: **Stage 1 — Cleanup & baseline** (complete).

## Tests

Backend tests scaffolded but not yet implemented (Stage 11).
Frontend has no tests yet (Stage 11).

## Environment

Copy `.env.example` to `.env` and set:
- `JWT_SECRET` — required, min 32 chars, no default in prod
- `SMS_LOGIN`, `SMS_PASSWORD` — Playmobile credentials (Stage 5)
- `PAYME_*`, `CLICK_*`, `UZUM_*` — payment provider credentials (Stage 6)

## License

Proprietary — all rights reserved.
