# Delivery TODO

> Working checklist for the Healthcare Scheduling System skill test.
> **P0** must ship. **P1** is production polish — surface it again when P0 is done.
> **P2** is optional and only after P0 and P1.
>
> Deadline: **9 November 2026, 12:00 (+07:00)**.

---

## P0 — must ship

### Repository and process
- [x] Initialise Git repository, `main` + `develop` branches
- [x] Root scaffolding: `.gitignore`, `.gitattributes`, `.editorconfig`, `LICENSE`, `.env.example`
- [x] Copy requirements and plan into `docs/`
- [ ] Conventional Commits, feature branches, `v1.0.0` tag
- [x] No committed secrets

### Auth Service (`:3001`)
- [x] `register` mutation — bcrypt hash, lowercase email, duplicate guard
- [x] `login` mutation — JWT (HS256, `sub`/`email`/`iat`/`exp`/`iss`/`aud`)
- [x] `validateToken` query — signature, expiry, issuer, audience, user existence
- [x] Prisma schema + migration (`auth_db`)
- [x] Validation, error codes, request IDs, Pino logging
- [x] Rate limiting on auth operations
- [x] Unit tests

### Schedule Service (`:3002`)
- [x] Customer CRUD (create, list with pagination + search, get, update, delete)
- [x] Doctor CRUD (create, list with pagination + search, get, update, delete)
- [x] Schedule create, list (filters + pagination), get, delete
- [x] Auth delegation to Auth Service (timeout, retry, circuit breaker)
- [x] Doctor double-booking conflict (`SCHEDULE_CONFLICT`)
- [x] `Restrict` deletes for referenced customers/doctors
- [x] Prisma schema + migration (`schedule_db`)
- [x] Transactional audit log for mutations
- [x] Unit tests

### Bonuses — all five
- [x] Email notification on schedule create/delete (Mailpit)
- [x] BullMQ queue + worker + retries + DLQ
- [x] Redis caching with TTL, jitter, invalidation, graceful fallback
- [x] Unit test coverage >= 50% per service
- [x] GraphQL API documentation (descriptions, examples, `docs/api.md`, Postman)

### Docker
- [x] `docker-compose.yml` — Postgres (two DBs), `redis-cache`, `redis-queue`, Mailpit, three services
- [x] Multi-stage Dockerfiles, non-root user, healthchecks
- [x] Migrations + seed on startup
- [x] `docker compose up --build` works from the release workspace

### Documentation
- [x] `README.md` — quickstart, architecture, env table, GraphQL examples, demo credentials
- [x] `docs/architecture.md` with Mermaid diagrams
- [x] `docs/api.md`
- [x] `docs/operations.md`
- [x] `docs/testing.md`
- [x] Postman collection + environment
- [x] Short Indonesian summary

---

## P1 — production polish (remind when P0 is done)

- [ ] Transactional audit log exposed in `docs/operations.md` (queries, retention)
- [ ] `/metrics` endpoint + Prometheus metrics (HTTP, DB, cache, queue, auth client)
- [ ] GraphQL Armor (depth, aliases, cost) + GraphQL-aware throttler guard
- [ ] Bull Board at `/admin/queues` with basic auth
- [ ] Runbooks: auth outage, queue backlog, cache outage, database restore
- [ ] ADRs: architecture, database-per-service, auth delegation, cache strategy, queue strategy, testing
- [ ] `docs/security.md` + `SECURITY.md`
- [x] `docs/roadmap.md` with explicit non-goals
- [ ] CI workflows: `ci.yml`, `smoke.yml`, `security.yml`, `commitlint.yml`
- [ ] Husky + lint-staged + commitlint
- [ ] E2E GraphQL tests against dedicated test databases
- [ ] Newman smoke suite with Mailpit API assertions
- [ ] Contract snapshots + GraphQL Inspector diff
- [ ] `CHANGELOG.md`, `CONTRIBUTING.md`, `CODEOWNERS`

---

## P2 — optional (only after P0 and P1)

- [ ] `release.yml` — GHCR images, SBOM, provenance
- [ ] Prometheus + Grafana Compose profile and dashboard
- [ ] k6 load test + `docs/performance.md`
- [ ] Multi-arch image build (`linux/amd64,linux/arm64`)
- [ ] Demo video (screenshots are the baseline)
- [ ] `docs/slo.md`, `docs/threat-model.md`, `docs/glossary.md`, `docs/onboarding.md`

---

## Proof pack

- [ ] `docs/proof/graphiql-auth.png`
- [ ] `docs/proof/graphiql-schedule.png`
- [ ] `docs/proof/mailpit-created.png`
- [ ] `docs/proof/mailpit-deleted.png`
- [ ] `docs/proof/bull-board.png`
- [ ] `docs/proof/coverage.png`
- [ ] `docs/proof/ci-green.png`
- [ ] `docs/proof/docker-compose-ps.png`
- [ ] `docs/proof/redis-keys.png`
- [ ] `docs/proof/audit-log.png`

---

## Submission checklist

- [ ] Clean clone from GitHub
- [ ] `cp .env.example .env`
- [x] `docker compose up --build`
- [x] Run the 5-minute demo script
- [x] Run Newman (14 requests, 38 assertions)
- [x] Run unit tests, coverage >= 50% (171 tests)
- [x] `gitleaks detect` clean (10 commits, no leaks)
- [ ] `main` and `develop` exist; tag `v1.0.0`
- [x] README quickstart matches reality
- [ ] Proof pack committed
