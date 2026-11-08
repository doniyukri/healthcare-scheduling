# Healthcare Scheduling System — Implementation Plan

> Companion to `requirements.md`.
> **Execution model: single-day, production-grade delivery.** No multi-day schedule.
> Goal: a reviewer should not be able to tell this apart from a small real product team's repository — not a coding assignment.

---

## 1. Strategy

Three principles:

1. **Production shape, not prototype shape.** Every shortcut that makes a repo look like a test (single README, no migrations, no CI, no ADRs, no ops docs, no release process) is treated as a defect.
2. **Stability beats novelty.** Pin a known-good version matrix. Validate the riskiest combination (NestJS 12 + Prisma 7 + CommonJS + Jest + native bcrypt) in a short Phase 0 spike before building features.
3. **Automate the proof.** One command starts the stack. One command runs the tests. One command runs the smoke suite. CI proves it on every push.

All five bonuses are in scope:

- Email notification (+15)
- BullMQ queue (+10)
- Redis caching (+10)
- Unit testing >= 50% (+10)
- API documentation (+5)

Target: **100% of the base rubric + 50 bonus points**, delivered with production-grade engineering evidence.

---

## 2. What "Real Project" Means Here

This is the checklist the repository must satisfy. It is deliberately stricter than the brief.

### 2.1 Repository & Process

- [ ] `README.md` with badges, quickstart, architecture, API, operations, troubleshooting.
- [ ] `CONTRIBUTING.md`, `CODEOWNERS`, `SECURITY.md`, `CHANGELOG.md`, `LICENSE`.
- [ ] PR template + issue templates.
- [ ] Conventional Commits enforced by commitlint + Husky.
- [ ] Branch protection documented for `main` and `develop`.
- [ ] Semantic versioning, release tags, and a release workflow.
- [ ] Dependabot/Renovate for dependency updates.
- [ ] Architecture Decision Records (`docs/adr/`) for every non-obvious choice.
- [ ] Explicit roadmap and non-goals (`docs/roadmap.md`).
- [ ] `.editorconfig`, `.nvmrc`, `.gitattributes`, `.npmrc`.

### 2.2 Engineering

- [ ] Strict TypeScript, ESLint, Prettier.
- [ ] Unit tests + e2e tests + Newman smoke suite + k6 load script.
- [ ] Coverage thresholds enforced in CI.
- [ ] CI: lint, test, coverage, build, Docker build, smoke, security scan.
- [ ] Multi-stage Dockerfiles, non-root users, healthchecks.
- [ ] Prisma migrations committed; `migrate deploy` on startup; idempotent seed.
- [ ] Backup/restore scripts and documented procedure.
- [ ] Structured logs with request IDs; sensitive fields redacted.
- [ ] `/metrics` endpoint and optional Prometheus/Grafana profile.
- [ ] Health/readiness endpoints; graceful shutdown on `SIGTERM`.
- [ ] Timeouts, retries, dead-letter queue, cache fallback.
- [ ] Helmet, CORS, rate limiting, GraphQL Armor, input validation.
- [ ] Audit log for schedule mutations.
- [ ] Redis cache with versioned invalidation.
- [ ] Committed GraphQL schema contracts.
- [ ] Postman collection with chained test scripts.
- [ ] `Makefile` + `scripts/` for developer and operator workflows.
- [ ] Environment schema validation at boot.
- [ ] Domain error codes, not generic 500s.

### 2.3 Architecture

- [ ] Clear service boundaries and data ownership.
- [ ] Database-per-service (two isolated databases).
- [ ] Auth delegation over a versioned GraphQL contract.
- [ ] Event-driven notification via BullMQ.
- [ ] No shared database, no cross-service joins.
- [ ] C4 context/container/component diagrams.
- [ ] Sequence diagrams for auth and schedule creation.
- [ ] Documented failure modes and scalability notes.

### 2.4 Operations

- [ ] One-command local stack.
- [ ] Mailpit for email inspection.
- [ ] Bull Board (or queue logs) for queue inspection.
- [ ] Runbooks for DB outage, queue backlog, cache outage, auth outage.
- [ ] Migration policy (expand/contract, no destructive migrations).
- [ ] Secret management policy.
- [ ] Release and rollback procedure.

---

## 3. Target Architecture

```mermaid
flowchart TB
    subgraph Client
        C[GraphiQL / Postman / curl]
    end

    subgraph Docker Network
        A[Auth Service :3001<br/>NestJS + GraphQL + Prisma]
        S[Schedule Service :3002<br/>NestJS + GraphQL + Prisma]
        N[Notification Service :3003<br/>NestJS + BullMQ Worker]
        P[(PostgreSQL :5432)]
        R[(Redis :6379)]
        M[Mailpit :8025 / :1025]
        BB[Bull Board :3003/admin/queues]
    end

    C -->|GraphQL + JWT| A
    C -->|GraphQL + JWT| S
    S -->|validateToken| A
    A -->|Prisma| P
    S -->|Prisma| P
    S -->|cache + enqueue| R
    N -->|consume jobs| R
    N -->|SMTP| M
    BB -->|inspect queues| R
```

### 3.1 Service Responsibilities

| Service | Port | Owns | Communication |
|---|---:|---|---|
| Auth Service | 3001 | `auth_db`, users, JWT, bcrypt | GraphQL |
| Schedule Service | 3002 | `schedule_db`, customers, doctors, schedules, audit log, cache | GraphQL; calls Auth `validateToken`; enqueues email jobs |
| Notification Service | 3003 | Email templates, SMTP delivery, queue inspection | Consumes BullMQ jobs; no database |

### 3.2 Data Ownership

- One PostgreSQL instance, **two databases**: `auth_db`, `schedule_db`.
- No cross-database joins or shared Prisma schema.
- Schedule Service never reads the `User` table; it trusts only Auth Service validation.
- Notification Service never reads Schedule DB; the job payload contains everything needed to render the email.
- Audit logs live in `schedule_db` and record the authenticated actor ID from Auth Service.

This is the simplest topology that still demonstrates real service boundaries.

---

## 4. Library Research & Decisions

### 4.1 Version Matrix (pin these)

| Package | Version | Why |
|---|---|---|
| Node.js | **24 LTS (24.19.x)** | NestJS 12 CLI + Prisma 7 runtime requirements |
| TypeScript | **6.0.3** | Compatible with NestJS 12 (`^5.5 \|\| ^6`) and ts-jest (`<7`) |
| `@nestjs/common` / `core` / `platform-express` | **12.4.0** | Current stable |
| `@nestjs/cli` | **12.0.12** | Current CLI |
| `@nestjs/graphql` | **14.2.0** | GraphiQL default; code-first |
| `@nestjs/apollo` | **14.2.0** | Apollo Server 5 integration |
| `@apollo/server` | **5.5.1** | Current stable |
| `@as-integrations/express5` | **1.1.2** | Required by `@nestjs/apollo` 14 |
| `graphql` | **16.15.0** | Apollo Server 5 peer supports `^16.11`; avoid GraphQL 17 until Apollo confirms it |
| `prisma` / `@prisma/client` / `@prisma/adapter-pg` | **7.10.1** | Stable line. npm `latest` is Prisma 8 RC — do not use it |
| `pg` | **8.23.1** | PostgreSQL driver |
| `@nestjs/config` | **12.1.1** | Env config + Standard Schema validation |
| `zod` | **4.6.7** | Env schema validation |
| `class-validator` / `class-transformer` | **0.15.1 / 0.5.1** | GraphQL input validation |
| `@nestjs/jwt` | **12.0.4** | JWT signing/verification |
| `bcrypt` | **6.0.0** | bcrypt hashing (native; multi-stage Docker build tools) |
| `graphql-request` | **7.4.0** | Typed GraphQL client for `validateToken` |
| `ioredis` | **6.0.0** | Redis cache + shared connection config |
| `bullmq` | **6.7.2** | Maintained Bull successor |
| `@nestjs/bullmq` | **12.0.1** | Nest integration |
| `@bull-board/nestjs` / `@bull-board/api` | current | Queue inspection UI (dev/staging only) |
| `nodemailer` | **10.3.1** | SMTP |
| `@nestjs-modules/mailer` | **4.0.0** | Mailer module + Handlebars |
| `handlebars` | **4.7.10** | Email templates |
| `nestjs-pino` / `pino` / `pino-http` | **5.3.1 / 10.4.0 / 11.0.0** | Structured logs |
| `@nestjs/terminus` | **12.1.0** | Health checks |
| `helmet` | **8.3.0** | Security headers |
| `@escape.tech/graphql-armor` | **3.2.0** | Depth/cost/alias limits |
| `@envelop/core` | **5.6.1** | GraphQL Armor peer (do not use 6.x) |
| `prom-client` | current | `/metrics` endpoint |
| `jest` / `ts-jest` / `@types/jest` | **30.5.2 / 29.4.15 / 30.0.0** | Test stack |
| `@nestjs/testing` | **12.4.0** | Nest test harness |
| `supertest` | **7.3.2** | HTTP/GraphQL e2e |
| `eslint` | **10.14.0** | Lint |
| `typescript-eslint` | **8.72.1** | TS rules |
| `prettier` | **3.9.10** | Formatting |
| `husky` / `lint-staged` | **9.1.7 / 17.6.0** | Git hooks |
| `@commitlint/cli` / `config-conventional` | **21.2.4** | Commit hygiene |
| `tsx` | **4.23.15** | Prisma seed runner |
| Docker images | `postgres:17-alpine`, `redis:7-alpine`, `node:24-bookworm-slim`, `axllent/mailpit:latest` | Stable, small, well-supported |

### 4.2 Framework: NestJS 12 (not 11)

**Decision:** NestJS 12.4.

Why:

- Current stable.
- GraphQL v14 defaults to **GraphiQL**; the old Playground is removed. The brief asks for "GraphQL Playground" — GraphiQL is the official replacement and should be documented as such.
- Standard Schema support means env validation can use Zod cleanly.
- Native observability exists, but we use `nestjs-pino` for stability.

Trade-off: NestJS 12 packages are ESM, so Jest must run on Node 24.9+. We use Node 24 LTS and CommonJS app code. This works via `require(esm)`.

### 4.3 GraphQL: Apollo Server 5 + `@nestjs/apollo`

**Decision:** Apollo.

Why:

- Official Nest integration.
- Best documentation and ecosystem.
- GraphiQL built in.
- GraphQL Armor supports Apollo Server 5.

Alternative considered: Mercurius + Fastify. Faster, but more integration risk and less familiar to reviewers. Not worth it for this delivery.

**Pin `graphql@16.15.0`.** Apollo Server 5.5.1 declares a `graphql ^16.11.0` peer; GraphQL 17 is too new to risk.

### 4.4 ORM: Prisma 7.10.1, not 8 RC

**Decision:** Prisma 7.10.1 with the `prisma-client` generator and `@prisma/adapter-pg`.

Why:

- Prisma 7 is the current stable major.
- `npm view prisma version` returns a **Prisma 8 release candidate** at the time of writing. Using `latest` would break the standard `prisma migrate` / `prisma generate` workflow.
- Prisma 7 is Rust-free and uses driver adapters.

Implementation notes:

```prisma
generator client {
  provider            = "prisma-client"
  output              = "../src/generated/prisma"
  moduleFormat        = "cjs"
  importFileExtension = ""
}
```

- `prisma.config.ts` uses `process.env.DATABASE_URL ?? ''` rather than `env()` so `prisma generate` works in CI without a database.
- `PrismaService` extends `PrismaClient` and passes `new PrismaPg({ connectionString })`.
- **Phase 0 spike must validate** that the generated client compiles under CommonJS + `nest build`. Fallback order:
  1. `moduleFormat = "cjs"` + `importFileExtension = "js"` with `moduleResolution: node16`.
  2. Switch the service to ESM + Vitest.
  3. Use the deprecated-but-stable `prisma-client-js` generator.

### 4.5 Validation: class-validator + Zod

**Decision:** class-validator for GraphQL DTOs, Zod for environment variables.

Why:

- `@nestjs/graphql` code-first integrates naturally with class-validator decorators and `ValidationPipe`.
- Zod is ideal for env validation and is the NestJS 12 recommendation for Standard Schema config.
- Avoids duplicating validation logic in two systems.

### 4.6 Auth: `@nestjs/jwt` + custom GraphQL guard

**Decision:** No Passport.

Why:

- The auth flow is simple: sign JWT, verify JWT, delegate validation to Auth Service.
- A custom `GqlAuthGuard` is easier to test and avoids Passport strategy boilerplate.
- `@nestjs/jwt` is the official wrapper around `jsonwebtoken`.

### 4.7 Password hashing: `bcrypt` (native)

**Decision:** `bcrypt@6.0.0`.

Why:

- The brief explicitly says bcrypt.
- Native bcrypt is faster and standard.

Docker mitigation:

- Multi-stage build with `python3 make g++` in the dependency stage.
- Copy `node_modules` into the slim runtime stage so native binaries are not rebuilt at runtime.
- Fallback only if Node 24 prebuilds fail: `bcryptjs@3.0.3` (pure JS, same bcrypt algorithm), documented in an ADR.

### 4.8 Cache: direct `ioredis` (not `@nestjs/cache-manager`)

**Decision:** A small `RedisService` + `CacheService` built on `ioredis@6`.

Why:

- **Critical finding:** `cache-manager@7.2.9` depends on **Keyv 5.6**, while `@keyv/redis@6.1.0` requires **Keyv 6.1**. Combining them breaks TTL and `wrap()` behavior.
- Direct `ioredis` avoids the version trap, gives precise control over versioned cache keys, and reuses the same Redis client style as BullMQ.
- The wrapper is ~100 lines and fully testable.

Alternative if the team prefers Nest's abstraction: `@nestjs/cache-manager@12.0.4` + `cache-manager@7.2.9` + `@keyv/redis@5.1.6` + `keyv@5.6.0`. Document this in an ADR.

Cache design:

- Key format: `cache:<entity>:v<version>:<hash-of-query>`.
- Version key: `cache:version:<entity>`.
- Mutations increment the entity version, invalidating all list/detail keys for that entity.
- TTL: `CACHE_TTL_MS` (default 60s).
- If Redis is unavailable, log a warning and fall through to the database (graceful degradation).
- Per-process in-flight deduplication to prevent cache stampedes.
- Cache customer/doctor/schedule detail and list queries.

### 4.9 Queue: BullMQ 6 (not legacy Bull)

**Decision:** `bullmq@6.7.2` + `@nestjs/bullmq@12.0.1`.

Why:

- BullMQ is the maintained successor to Bull and is what "Bull queue" means in 2026.
- Native TypeScript, better reliability, retries/backoff, job retention.
- Works cleanly with Redis and NestJS.

Job policy:

- Queue name: `email`.
- Jobs: `schedule-created`, `schedule-deleted`.
- `attempts: 3`, exponential backoff `1000ms`.
- `removeOnComplete: 100`, `removeOnFail: 500`.
- Final failure is moved to `email-dlq` for operator inspection.
- Log `@OnWorkerEvent('failed')` with job ID and error.
- Email sending never blocks the GraphQL mutation.

### 4.10 Email: `@nestjs-modules/mailer` + Handlebars + Mailpit

**Decision:** Mailer module with Handlebars templates; Mailpit for local inspection.

Why:

- Clean separation of templates from code.
- Mailpit gives the reviewer a UI at `http://localhost:8025` to see the actual emails.
- No real SMTP credentials needed.

Templates:

- `templates/schedule-created.hbs`
- `templates/schedule-deleted.hbs`

Both include a plain-text fallback.

### 4.11 Logging: `nestjs-pino`

**Decision:** `nestjs-pino` + `pino-http`.

Why:

- Structured JSON logs in production, pretty logs in development.
- Request IDs and correlation.
- Redacts `authorization`, `password`, cookies, and customer email.
- Stable and widely used.

Alternative considered: NestJS 12's new `@nestjs/observe` SDK. It is promising but new (0.x) and adds risk. Mention it in the roadmap.

### 4.12 Testing: Jest 30 + ts-jest

**Decision:** Jest.

Why:

- NestJS's default for CommonJS projects.
- `@nestjs/testing` works out of the box.
- ts-jest 29.4 supports Jest 30 and TypeScript < 7.
- Simpler than migrating to Vitest + ESM for this project.

Coverage:

- Global thresholds: 70% statements/lines/functions, 60% branches.
- Actual target: 80%+.
- Exclude `main.ts`, `*.module.ts`, generated Prisma client, and pure type files.
- CI uploads coverage artifacts per service.

### 4.13 Security: GraphQL Armor

**Decision:** `@escape.tech/graphql-armor@3.2.0` with `@envelop/core@5.6.1`.

Why:

- Adds max depth, cost limit, and alias limit with a few lines.
- Demonstrates production thinking beyond the brief.
- Supports Apollo Server 5.

Also add:

- Helmet.
- CORS from env.
- Input validation.
- Rate limiting on auth mutations.
- Audit logging.
- Supply-chain scanning.

### 4.14 Metrics: `prom-client`

**Decision:** `prom-client` + a `/metrics` endpoint per service.

Why:

- Lightweight, standard Prometheus format.
- Exposes HTTP request duration, error count, queue depth, cache hit/miss, DB query time.
- Optional `docker-compose.observability.yml` profile adds Prometheus + Grafana.
- OpenTelemetry/Jaeger is documented as the next step, not a day-one dependency.

---

## 5. Repository Structure

```text
healthcare-scheduling/
├── .github/
│   ├── CODEOWNERS
│   ├── dependabot.yml
│   ├── pull_request_template.md
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.yml
│   │   └── feature_request.yml
│   └── workflows/
│       ├── ci.yml
│       ├── smoke.yml
│       ├── security.yml
│       ├── release.yml
│       └── commitlint.yml
├── .editorconfig
├── .env.example
├── .gitattributes
├── .gitignore
├── .dockerignore
├── .nvmrc
├── .npmrc
├── CHANGELOG.md
├── CODEOWNERS
├── CONTRIBUTING.md
├── LICENSE
├── Makefile
├── README.md
├── SECURITY.md
├── docker-compose.yml
├── docker-compose.override.yml
├── docker-compose.prod.yml
├── docker-compose.observability.yml
├── docs/
│   ├── architecture.md
│   ├── api.md
│   ├── operations.md
│   ├── security.md
│   ├── testing.md
│   ├── performance.md
│   ├── roadmap.md
│   ├── adr/
│   │   ├── 0001-record-architecture-decisions.md
│   │   ├── 0002-use-nestjs-graphql-prisma.md
│   │   ├── 0003-database-per-service.md
│   │   ├── 0004-auth-delegation-via-graphql.md
│   │   ├── 0005-bullmq-for-async-email.md
│   │   ├── 0006-redis-cache-strategy.md
│   │   ├── 0007-restrict-deletes-for-scheduling-integrity.md
│   │   └── 0008-pin-prisma-7-not-8-rc.md
│   └── runbooks/
│       ├── database-outage.md
│       ├── queue-backlog.md
│       ├── cache-outage.md
│       └── auth-service-outage.md
├── contracts/
│   ├── auth.graphql
│   └── schedule.graphql
├── infra/
│   ├── docker/postgres/init.sql
│   ├── redis/redis.conf
│   ├── prometheus/prometheus.yml
│   └── grafana/
│       ├── provisioning/
│       └── dashboards/
├── postman/
│   ├── Healthcare-Scheduling.postman_collection.json
│   ├── Healthcare-Scheduling.postman_environment.json
│   └── README.md
├── scripts/
│   ├── bootstrap.sh
│   ├── wait-for-health.sh
│   ├── smoke.sh
│   ├── reset-db.sh
│   ├── seed.sh
│   ├── db-backup.sh
│   ├── db-restore.sh
│   ├── generate-contracts.sh
│   └── load-test.js
├── auth-service/
│   ├── Dockerfile
│   ├── docker-entrypoint.sh
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── tsconfig.build.json
│   ├── nest-cli.json
│   ├── jest.config.ts
│   ├── eslint.config.mjs
│   ├── prisma.config.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── config/
│   │   ├── common/
│   │   │   ├── errors/
│   │   │   ├── filters/
│   │   │   ├── logging/
│   │   │   ├── metrics/
│   │   │   └── decorators/
│   │   ├── prisma/
│   │   ├── users/
│   │   ├── auth/
│   │   └── health/
│   └── test/
├── schedule-service/
│   ├── Dockerfile
│   ├── docker-entrypoint.sh
│   ├── package.json
│   ├── package-lock.json
│   ├── prisma.config.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── config/
│   │   ├── common/
│   │   │   ├── pagination/
│   │   │   ├── errors/
│   │   │   ├── filters/
│   │   │   ├── logging/
│   │   │   ├── metrics/
│   │   │   └── decorators/
│   │   ├── prisma/
│   │   ├── auth/
│   │   ├── customers/
│   │   ├── doctors/
│   │   ├── schedules/
│   │   ├── audit/
│   │   ├── cache/
│   │   ├── queue/
│   │   └── health/
│   └── test/
└── notification-service/
    ├── Dockerfile
    ├── docker-entrypoint.sh
    ├── package.json
    ├── package-lock.json
    ├── src/
    │   ├── main.ts
    │   ├── app.module.ts
    │   ├── config/
    │   ├── mail/
    │   ├── queue/
    │   ├── health/
    │   └── metrics/
    ├── templates/
    │   ├── schedule-created.hbs
    │   └── schedule-deleted.hbs
    └── test/
```

**Monorepo decision:** keep each service as an independent package with its own `package.json` and lockfile. This preserves deployability and avoids workspace coupling. A shared platform package can be introduced later if duplication grows. Documented in ADR 0002.

---

## 6. Data Model

### 6.1 Auth Prisma Schema

```prisma
generator client {
  provider            = "prisma-client"
  output              = "../src/generated/prisma"
  moduleFormat        = "cjs"
  importFileExtension = ""
}

datasource db {
  provider = "postgresql"
}

model User {
  id        String   @id @default(uuid()) @db.Uuid
  email     String   @unique
  password  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 6.2 Schedule Prisma Schema

```prisma
generator client {
  provider            = "prisma-client"
  output              = "../src/generated/prisma"
  moduleFormat        = "cjs"
  importFileExtension = ""
}

datasource db {
  provider = "postgresql"
}

model Customer {
  id        String     @id @default(uuid()) @db.Uuid
  name      String
  email     String     @unique
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
  schedules Schedule[]

  @@index([name])
}

model Doctor {
  id        String     @id @default(uuid()) @db.Uuid
  name      String
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
  schedules Schedule[]

  @@index([name])
}

model Schedule {
  id          String   @id @default(uuid()) @db.Uuid
  objective   String
  customerId  String   @db.Uuid
  doctorId    String   @db.Uuid
  scheduledAt DateTime
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  customer Customer @relation(fields: [customerId], references: [id], onDelete: Restrict)
  doctor   Doctor   @relation(fields: [doctorId], references: [id], onDelete: Restrict)

  @@unique([doctorId, scheduledAt], name: "schedule_doctor_time_unique")
  @@index([customerId])
  @@index([scheduledAt])
}

model AuditLog {
  id         String   @id @default(uuid()) @db.Uuid
  actorId    String?  @db.Uuid
  action     String
  entity     String
  entityId   String
  requestId  String?
  metadata   Json?
  createdAt  DateTime @default(now())

  @@index([entity, entityId])
  @@index([actorId])
  @@index([createdAt])
}
```

### 6.3 Why `Restrict` Instead of `Cascade`

Deleting a doctor or customer with existing appointments should not silently erase medical scheduling history. The service returns a clear `DOCTOR_HAS_SCHEDULES` / `CUSTOMER_HAS_SCHEDULES` conflict. This is a domain decision documented in ADR 0007.

### 6.4 Audit Log

Every mutating operation in Schedule Service writes an `AuditLog` row:

- `actorId` from the authenticated user
- `action` (`customer.create`, `doctor.update`, `schedule.delete`, etc.)
- `entity`, `entityId`
- `requestId` from the request context
- `metadata` with non-sensitive before/after summary

This is a real healthcare-system requirement and gives the reviewer something concrete to inspect.

---

## 7. GraphQL Contract

The full SDL lives in `requirements.md` sections 4.5 and 5.9. Implementation rules:

- **Code-first** with `@ObjectType`, `@InputType`, `@ArgsType`, `@Field`.
- Every type, field, input, and argument has a `description`.
- `autoSchemaFile` writes `src/schema.gql`; `scripts/generate-contracts.sh` copies the final SDL to `contracts/*.graphql`.
- `sortSchema: true`.
- `GraphQLISODateTime` for `DateTime`.
- `graphiql: true` outside production; disabled in production via `NODE_ENV`.
- GraphQL Armor plugins: max depth 10, max aliases 50, cost limit 1000.
- Custom `GraphQLExceptionFilter` maps domain errors to `extensions.code`.

### 7.1 Error Codes

| Code | Meaning |
|---|---|
| `UNAUTHORIZED` | Missing/invalid/expired token |
| `AUTH_SERVICE_UNAVAILABLE` | Auth Service timeout or 5xx |
| `EMAIL_ALREADY_EXISTS` | Duplicate user/customer email |
| `INVALID_CREDENTIALS` | Wrong login |
| `CUSTOMER_NOT_FOUND` | Customer does not exist |
| `DOCTOR_NOT_FOUND` | Doctor does not exist |
| `SCHEDULE_NOT_FOUND` | Schedule does not exist |
| `SCHEDULE_CONFLICT` | Doctor already booked at that time |
| `CUSTOMER_HAS_SCHEDULES` | Cannot delete referenced customer |
| `DOCTOR_HAS_SCHEDULES` | Cannot delete referenced doctor |
| `VALIDATION_ERROR` | Invalid input |
| `RATE_LIMITED` | Too many requests |
| `INTERNAL_SERVER_ERROR` | Unexpected failure |

### 7.2 Validation Rules

| Field | Rule |
|---|---|
| `email` | `@IsEmail()`, lowercase + trim |
| `password` | 8–72 chars, at least one letter and one number |
| `name` | 1–100 chars, trimmed |
| `objective` | 1–500 chars, trimmed |
| `scheduledAt` | valid ISO-8601 date |
| `pagination.page` | int >= 1, default 1 |
| `pagination.limit` | int 1–100, default 10 |

---

## 8. Implementation Details

### 8.1 Auth Service Modules

- `ConfigModule` with Zod env schema.
- `PrismaModule` (global) with `PrismaService`.
- `UsersModule`:
  - `UsersRepository` wraps Prisma user queries.
  - `User` GraphQL object type (no password field).
- `AuthModule`:
  - `PasswordService`: `hash`, `compare` (bcrypt, cost 12).
  - `TokenService`: `sign`, `verify` (`@nestjs/jwt`).
  - `AuthService`: register/login/validateToken.
  - `AuthResolver`: GraphQL mutations/query.
  - `JwtAuthGuard` for `validateToken`.
- `HealthModule`: Terminus + Prisma indicator.
- `MetricsModule`: `/metrics` with request counters/histograms.
- `AuthEventLogger`: logs login success/failure with email redacted.

Register flow:

1. Normalize email.
2. Check duplicate (repository).
3. Hash password.
4. Create user.
5. Sign token.
6. Return `AuthPayload`.

Login flow:

1. Find user by email.
2. If missing, still run a dummy bcrypt compare to reduce timing leaks.
3. Compare password.
4. Sign token.
5. Return `AuthPayload`.

`validateToken` flow:

1. Extract bearer token.
2. `TokenService.verify`.
3. Load user by `sub`.
4. Return user (without password).

### 8.2 Schedule Service Modules

- `ConfigModule` with Zod env schema.
- `PrismaModule`.
- `RedisModule` (global):
  - `RedisService` wraps `ioredis`.
  - `onModuleDestroy` closes connection.
- `CacheModule`:
  - `CacheService.getOrSet`, `invalidate(entity)`.
  - Graceful fallback on Redis errors.
  - In-flight deduplication.
- `AuthModule`:
  - `AuthClientService` uses `graphql-request` with `AbortSignal.timeout`.
  - `GqlAuthGuard` implements `CanActivate`.
  - `@CurrentUser()` decorator.
  - `@Public()` decorator for health.
- `CustomersModule`: repository, service, resolver, DTOs, audit.
- `DoctorsModule`: same pattern.
- `SchedulesModule`: repository, service, resolver, DTOs, audit, email queue.
- `AuditModule`: `AuditService` + Prisma writes.
- `QueueModule`: BullMQ registration + `EmailQueueService`.
- `HealthModule`: Terminus + Prisma + Redis + Auth Service ping.
- `MetricsModule`: `/metrics`.

### 8.3 Auth Guard Behavior

```ts
canActivate(context: ExecutionContext): Promise<boolean> {
  // 1. Skip for @Public() routes (health, metrics).
  // 2. If context type is http, allow /health and /metrics.
  // 3. Extract Authorization header from GqlExecutionContext.
  // 4. Call AuthClientService.validateToken(token).
  // 5. Attach user to request.
  // 6. On invalid token -> UnauthorizedException('UNAUTHORIZED').
  // 7. On network/timeout -> ServiceUnavailableException('AUTH_SERVICE_UNAVAILABLE').
}
```

### 8.4 Schedule Create Flow

1. Validate input (class-validator).
2. Verify customer exists.
3. Verify doctor exists.
4. Attempt create.
5. Catch Prisma `P2002` on `schedule_doctor_time_unique` -> `SCHEDULE_CONFLICT`.
6. Catch `P2003` -> map to `CUSTOMER_NOT_FOUND` / `DOCTOR_NOT_FOUND`.
7. Write `AuditLog` (`schedule.create`).
8. Invalidate schedule/customer/doctor cache versions.
9. Enqueue `schedule-created` job with:
   - `scheduleId`, `objective`, `scheduledAt`
   - `customer: { id, name, email }`
   - `doctor: { id, name }`
10. Return schedule with nested customer/doctor.

The job payload contains everything the notification service needs, so no cross-service database access.

### 8.5 Schedule Delete Flow

1. Find schedule with customer + doctor.
2. If missing -> `SCHEDULE_NOT_FOUND`.
3. Delete.
4. Write `AuditLog` (`schedule.delete`).
5. Invalidate cache.
6. Enqueue `schedule-deleted` job with the same payload shape.
7. Return deleted schedule.

If enqueue fails, log an error but keep the deletion successful. The production upgrade is a transactional outbox (documented in the roadmap).

### 8.6 Cache Invalidation

| Mutation | Invalidate |
|---|---|
| `createCustomer` | `customers` |
| `updateCustomer` | `customers`, `schedules` (nested customer data) |
| `deleteCustomer` | `customers` |
| `createDoctor` | `doctors` |
| `updateDoctor` | `doctors`, `schedules` (nested doctor data) |
| `deleteDoctor` | `doctors` |
| `createSchedule` | `schedules` |
| `deleteSchedule` | `schedules` |

### 8.7 Notification Service

- `BullModule.forRootAsync` with `REDIS_QUEUE_URL`.
- `BullModule.registerQueue({ name: 'email' })`.
- `@Processor('email')` extends `WorkerHost`.
- `MailService`:
  - `sendScheduleCreated(payload)`
  - `sendScheduleDeleted(payload)`
- Handlebars templates with HTML + text fallback.
- `@OnWorkerEvent('failed')` logs job ID and error; final failures go to `email-dlq`.
- Bull Board at `/admin/queues`, protected by `BULL_BOARD_ENABLED` and basic auth (or disabled in production).
- Health:
  - Redis ping.
  - SMTP `transporter.verify()`.
- No HTTP API except `GET /health`, `GET /metrics`, `GET /` (service info), and the optional Bull Board.

### 8.8 Health Checks

| Service | Checks |
|---|---|
| Auth | Prisma `SELECT 1` |
| Schedule | Prisma `SELECT 1`, Redis `PING`, Auth `GET /health` |
| Notification | Redis `PING`, SMTP verify |

Terminus 12 uses `HealthIndicatorService`. Use `PrismaHealthIndicator` for DB and custom indicators for Redis/SMTP. Return `degraded` (not `down`) for optional cache outages.

### 8.9 Logging & Observability

- `nestjs-pino` global logger.
- Request ID from `x-request-id` or generated UUID.
- Redact `authorization`, `password`, `cookie`, customer email.
- Log service startup with name, port, environment, version.
- Log auth validation failures at `warn`, unexpected errors at `error`.
- Log queue job lifecycle at `info`/`error`.
- `/metrics`:
  - `http_requests_total{service,method,route,status}`
  - `http_request_duration_seconds{service,route}`
  - `queue_jobs_total{queue,status}`
  - `cache_operations_total{result}`
  - `db_query_duration_seconds{operation}`
- Optional `docker-compose.observability.yml` with Prometheus + Grafana.
- Graceful shutdown: `app.enableShutdownHooks()`, Prisma `$disconnect`, Redis `quit`, BullMQ close.

### 8.10 Security Hardening

- `helmet()`.
- CORS from `CORS_ORIGIN` (comma-separated).
- GraphQL Armor.
- Validation pipe with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.
- Rate limiting on auth mutations (`RATE_LIMITED`).
- Audit logging for mutations.
- Non-root Docker user.
- Postgres/Redis not published to the host in `docker-compose.prod.yml`.
- No secrets in images or repo.
- Dependency and container scanning in CI.
- Production TLS termination documented (reverse proxy/load balancer).

### 8.11 Error Handling

- `GraphQLExceptionFilter` maps:
  - Domain exceptions -> `extensions.code`
  - Prisma `P2002` -> `CONFLICT`
  - Prisma `P2003` -> `FOREIGN_KEY_VIOLATION`
  - Prisma `P2025` -> `NOT_FOUND`
  - Unknown -> `INTERNAL_SERVER_ERROR` (no stack trace in production)
- Consistent response shape:
  ```json
  {
    "errors": [{
      "message": "Doctor already has a schedule at this time",
      "extensions": { "code": "SCHEDULE_CONFLICT", "requestId": "..." }
    }]
  }
  ```

---

## 9. Docker & Operations

### 9.1 Compose Files

| File | Purpose |
|---|---|
| `docker-compose.yml` | Base stack: postgres, redis, mailpit, auth, schedule, notification |
| `docker-compose.override.yml` | Local dev: exposed ports, pretty logs, seed enabled |
| `docker-compose.prod.yml` | Production-like: no DB/Redis host ports, restart policies, resource limits, JSON logs |
| `docker-compose.observability.yml` | Optional Prometheus + Grafana profile |

### 9.2 Compose Topology

```yaml
name: healthcare-scheduling

services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./infra/docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d postgres"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    command: ["redis-server", "/usr/local/etc/redis/redis.conf"]
    volumes:
      - redis_data:/data
      - ./infra/redis/redis.conf:/usr/local/etc/redis/redis.conf:ro
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

  mailpit:
    image: axllent/mailpit:latest
    ports:
      - "8025:8025"
      - "1025:1025"

  auth-service:
    build: ./auth-service
    env_file: .env
    environment:
      PORT: 3001
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/auth_db?schema=public
    ports:
      - "3001:3001"
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "node -e \"fetch('http://localhost:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 20s

  schedule-service:
    build: ./schedule-service
    env_file: .env
    environment:
      PORT: 3002
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/schedule_db?schema=public
      AUTH_SERVICE_URL: http://auth-service:3001/graphql
      REDIS_CACHE_URL: redis://redis:6379/0
      REDIS_QUEUE_URL: redis://redis:6379/1
    ports:
      - "3002:3002"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      auth-service:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "node -e \"fetch('http://localhost:3002/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 20s

  notification-service:
    build: ./notification-service
    env_file: .env
    environment:
      PORT: 3003
      REDIS_QUEUE_URL: redis://redis:6379/1
      SMTP_HOST: mailpit
      SMTP_PORT: 1025
      MAIL_FROM: no-reply@healthcare.local
      BULL_BOARD_ENABLED: "true"
    ports:
      - "3003:3003"
    depends_on:
      redis:
        condition: service_healthy
      mailpit:
        condition: service_started
    healthcheck:
      test: ["CMD-SHELL", "node -e \"fetch('http://localhost:3003/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 20s

networks:
  default:
    name: healthcare-network

volumes:
  postgres_data:
  redis_data:
```

### 9.3 Database Initialization

`infra/docker/postgres/init.sql`:

```sql
CREATE DATABASE auth_db;
CREATE DATABASE schedule_db;
```

Runs only on first volume initialization. Document `docker compose down -v` to reset.

### 9.4 Redis Configuration

`infra/redis/redis.conf`:

```conf
appendonly yes
maxmemory-policy noeviction
save 900 1
save 300 10
save 60 10000
```

`noeviction` protects BullMQ jobs from cache pressure. Cache entries have TTLs, so they expire naturally.

### 9.5 Dockerfile Pattern (per service)

```dockerfile
FROM node:24-bookworm-slim AS base
WORKDIR /app

FROM base AS deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npx prisma generate && npm run build

FROM base AS prod-deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && chown -R node:node /app
USER node
EXPOSE 3001
ENTRYPOINT ["./docker-entrypoint.sh"]
```

Notes:

- `prisma` CLI must be in `dependencies` (not `devDependencies`) so `prisma migrate deploy` works in the runtime image. Document this trade-off; a production setup would use a separate migration job.
- The entrypoint waits for the DB, runs `prisma migrate deploy`, optionally seeds, then `exec node dist/main.js`.
- Notification service has no Prisma; its Dockerfile is simpler.

### 9.6 Entrypoint Pattern

```sh
#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy

if [ "${SEED_DEMO_DATA:-false}" = "true" ]; then
  echo "Seeding demo data..."
  node dist/prisma/seed.js || echo "Seed skipped/failed (non-fatal)"
fi

exec node dist/main.js
```

### 9.7 Environment Variables

| Variable | Service | Example | Purpose |
|---|---|---|---|
| `NODE_ENV` | all | `development` | Runtime mode |
| `POSTGRES_USER` | compose | `healthcare` | DB user |
| `POSTGRES_PASSWORD` | compose | `change-me` | DB password |
| `AUTH_DATABASE_URL` | auth | `postgresql://.../auth_db` | Auth DB |
| `SCHEDULE_DATABASE_URL` | schedule | `postgresql://.../schedule_db` | Schedule DB |
| `JWT_SECRET` | auth | long random string | JWT signing |
| `JWT_EXPIRES_IN` | auth | `1h` | Token expiry |
| `BCRYPT_ROUNDS` | auth | `12` | Hash cost |
| `AUTH_SERVICE_URL` | schedule | `http://auth-service:3001/graphql` | Auth endpoint |
| `AUTH_SERVICE_TIMEOUT_MS` | schedule | `2000` | Inter-service timeout |
| `REDIS_CACHE_URL` | schedule | `redis://redis:6379/0` | Cache |
| `REDIS_QUEUE_URL` | schedule, notification | `redis://redis:6379/1` | BullMQ |
| `CACHE_TTL_MS` | schedule | `60000` | Cache TTL |
| `CORS_ORIGIN` | all | `http://localhost:3000` | CORS |
| `SMTP_HOST` | notification | `mailpit` | SMTP host |
| `SMTP_PORT` | notification | `1025` | SMTP port |
| `MAIL_FROM` | notification | `no-reply@healthcare.local` | Sender |
| `BULL_BOARD_ENABLED` | notification | `true` | Queue UI toggle |
| `SEED_DEMO_DATA` | auth, schedule | `true` | Demo seed toggle |
| `LOG_LEVEL` | all | `info` | Pino level |
| `METRICS_ENABLED` | all | `true` | `/metrics` toggle |

Use `AUTH_DATABASE_URL` / `SCHEDULE_DATABASE_URL` in `.env.example` and map them to `DATABASE_URL` per container, so each service sees only its own URL.

### 9.8 Developer Commands

`Makefile`:

```makefile
bootstrap:   ## Copy env and install dependencies
up:          ## Start the full stack
down:        ## Stop the stack
reset:       ## Stop and delete volumes
logs:        ## Tail all logs
ps:          ## Show container health
test:        ## Run all unit tests
coverage:    ## Run tests with coverage
lint:        ## Lint all services
format:      ## Format all services
smoke:       ## Run Newman smoke suite
seed:        ## Re-run demo seed
psql:        ## Open psql in the postgres container
redis-cli:   ## Open redis-cli
backup:      ## Dump both databases
restore:     ## Restore from a dump
contracts:   ## Regenerate GraphQL contracts
load-test:   ## Run k6 load test
```

### 9.9 Operational Runbooks

- `docs/runbooks/database-outage.md` — health check, logs, failover, restore.
- `docs/runbooks/queue-backlog.md` — inspect Bull Board, scale workers, replay DLQ.
- `docs/runbooks/cache-outage.md` — confirm degraded health, verify DB fallback, flush cache.
- `docs/runbooks/auth-service-outage.md` — confirm 503 behavior, check auth health, restart order.

### 9.10 Backup & Restore

- `scripts/db-backup.sh` runs `pg_dump` for `auth_db` and `schedule_db` into `backups/<timestamp>/`.
- `scripts/db-restore.sh` restores from a chosen backup.
- Document that production uses managed backups + PITR; the script is for local/staging.

### 9.11 Migration Policy

- Migrations are committed and reviewed.
- Use expand/contract for breaking changes:
  1. Add new column/table.
  2. Deploy code that writes both.
  3. Backfill.
  4. Remove old column in a later release.
- No destructive migration in the same release as the code that stops using the old shape.
- `prisma migrate deploy` runs at container start; in production, prefer a separate migration job.

---

## 10. Testing & QA

### 10.1 Test Pyramid

| Layer | Tool | Scope |
|---|---|---|
| Unit | Jest | Services, guards, repositories, processors, filters |
| Integration | Jest + mocked Prisma/Redis | Resolver -> service -> repository wiring |
| E2E | supertest | GraphQL over HTTP with a test app |
| Smoke | Newman | Full Docker stack, real Postgres/Redis/Mailpit |
| Load | k6 | Schedule list/create throughput and p95 latency |

### 10.2 Unit Test Matrix

| Service | Unit | Cases |
|---|---|---|
| Auth | `PasswordService` | hash/compare, wrong password |
| Auth | `TokenService` | sign/verify, expired token, malformed token |
| Auth | `AuthService` | register success, duplicate email, login success, wrong credentials, validateToken |
| Auth | `AuthResolver` | delegates correctly, maps errors |
| Auth | `JwtAuthGuard` | valid, missing, malformed, expired |
| Auth | `UsersRepository` | create/find (mocked Prisma) |
| Schedule | `CustomersService` | create, duplicate email, update, list pagination, get, delete |
| Schedule | `DoctorsService` | create, update, list, get, delete |
| Schedule | `SchedulesService` | create, invalid customer, invalid doctor, conflict, list filters, get, delete |
| Schedule | `SchedulesRepository` | include relations, transaction/count |
| Schedule | `GqlAuthGuard` | valid, invalid, timeout, public route |
| Schedule | `AuthClientService` | success, GraphQL error, timeout, malformed response |
| Schedule | `CacheService` | hit, miss, set, invalidate, Redis failure fallback, stampede dedup |
| Schedule | `AuditService` | writes actor/action/entity/requestId |
| Schedule | `EmailQueueService` | enqueue create/delete, queue failure logged |
| Schedule | `GraphQLExceptionFilter` | maps Prisma/domain errors |
| Notification | `MailService` | renders templates, sends email |
| Notification | `EmailProcessor` | handles job types, unknown job, failure, DLQ |
| Notification | Health indicators | Redis up/down, SMTP up/down |

### 10.3 Coverage

- `jest --coverage` per service.
- `coverageThreshold`:
  - statements: 70
  - branches: 60
  - functions: 70
  - lines: 70
- Exclude generated code, modules, `main.ts`, and type-only files.
- Upload `coverage/lcov.info` as CI artifact.
- README reports actual coverage per service.

### 10.4 Smoke Suite (Newman)

Against the running Docker stack:

1. Register/login.
2. Create customer.
3. Create doctor.
4. Create schedule.
5. Assert conflict on duplicate.
6. List schedules with filters.
7. Delete schedule.
8. Assert 401 without token.
9. Assert auth service unavailable behavior (optional).

### 10.5 Load Test (k6)

`scripts/load-test.js`:

- Ramp to 50 virtual users.
- Mix: 70% list schedules, 20% get schedule, 10% create schedule.
- Thresholds: p95 < 300ms, error rate < 1%.
- Results recorded in `docs/performance.md`.

### 10.6 Test Data

- Static demo seed:
  - Auth: `demo@clinic.test` / `Password123!`
  - Customers: 3
  - Doctors: 3
- Idempotent upserts.
- `SEED_DEMO_DATA=false` disables seeding.

---

## 11. CI/CD, Release & Supply Chain

### 11.1 GitHub Actions

`ci.yml`:

- Trigger: push/PR to `main`, `develop`.
- Job `quality` (matrix: `auth-service`, `schedule-service`, `notification-service`):
  - checkout
  - setup Node 24 + npm cache
  - `npm ci`
  - `npm run lint`
  - `npm run test:cov`
  - `npm run build`
  - upload coverage artifact
- Job `docker`:
  - `docker compose config`
  - `docker compose build`

`smoke.yml`:

- `docker compose up -d --build`
- wait for health
- `npx newman run postman/...`
- `docker compose down -v`

`security.yml`:

- CodeQL for TypeScript.
- `dependency-review` on PRs.
- Trivy image scan for each service.
- `npm audit --audit-level=high` (non-blocking until triaged).

`release.yml`:

- Trigger: tag `v*.*.*`.
- Build and push images to GHCR with OCI labels.
- Generate SBOM/provenance.
- Create GitHub Release with changelog.

`commitlint.yml`:

- Validate PR title and commit messages.

### 11.2 Commit Hooks

- Husky `pre-commit`: `lint-staged` (ESLint + Prettier on staged files).
- Husky `commit-msg`: `commitlint`.
- `commitlint.config.js` extends `@commitlint/config-conventional`.

### 11.3 Release Process

1. `develop` is green.
2. Create `release/vX.Y.Z`.
3. Update `CHANGELOG.md` and version fields.
4. PR into `main`; CI must pass.
5. Merge; tag `vX.Y.Z`.
6. `release.yml` publishes images and release notes.
7. Back-merge `main` into `develop`.

### 11.4 Supply Chain

- Lockfiles committed for every service.
- Dependabot weekly, grouped by ecosystem.
- CodeQL + Trivy.
- Pinned Docker base images (tag + digest in production).
- No secrets in images; build args are non-sensitive.
- `.dockerignore` excludes `.env`, tests, coverage, docs.

---

## 12. Branching Strategy

### 12.1 Model: Lightweight Git Flow

```text
main        ●──────────────●──────────────● (v1.0.0)
             \            /              /
develop       ●──●──●──●──●──●──●──●──●──●
                 \    /     \    /
feature/auth      ●──●       ●──●
feature/schedule            feature/bonus-email
```

| Branch | Purpose | Created from | Merges into |
|---|---|---|---|
| `main` | Production-ready, tagged releases | `release/*` or `hotfix/*` | — |
| `develop` | Integration branch | `main` | — |
| `feature/<scope>` | New feature | `develop` | `develop` via PR |
| `fix/<scope>` | Non-critical bug fix | `develop` | `develop` via PR |
| `chore/<scope>` | Tooling, deps, config | `develop` | `develop` via PR |
| `docs/<scope>` | Documentation | `develop` | `develop` via PR |
| `test/<scope>` | Test improvements | `develop` | `develop` via PR |
| `release/vX.Y.Z` | Release stabilization | `develop` | `main` + back-merge to `develop` |
| `hotfix/vX.Y.Z` | Critical production fix | `main` | `main` + `develop` |

### 12.2 Branch Naming

Format: `<type>/<short-kebab-scope>`

Examples:

- `feature/auth-service`
- `feature/schedule-crud`
- `feature/inter-service-auth`
- `feature/bonus-redis-cache`
- `feature/bonus-email-queue`
- `test/coverage-80`
- `docs/readme-and-postman`
- `chore/docker-ci`
- `fix/schedule-conflict-race`
- `release/v1.0.0`

### 12.3 Conventional Commits

```text
<type>(<scope>): <subject>

<body>

<footer>
```

Types: `feat`, `fix`, `test`, `docs`, `refactor`, `perf`, `chore`, `build`, `ci`, `style`.

Examples:

```text
feat(auth): add register, login, and validateToken
feat(schedule): add customer CRUD with pagination
feat(schedule): prevent doctor double-booking with unique constraint
feat(bonus): add Redis cache with versioned invalidation
feat(bonus): enqueue schedule emails with BullMQ
test(auth): cover token expiry and invalid credentials
docs(readme): add architecture diagram and GraphQL examples
build(docker): add multi-stage Dockerfiles and healthchecks
ci: run lint, coverage, build, and Newman smoke tests
```

### 12.4 PR Flow

1. Create an issue or milestone item.
2. Branch from `develop`.
3. Commit in small, conventional commits.
4. Open a PR into `develop`.
5. CI must pass (lint, tests, coverage, build, smoke, security).
6. Squash merge.
7. Delete the branch.
8. At the end: `release/v1.0.0` from `develop` -> PR into `main` -> merge -> tag `v1.0.0`.
9. Back-merge `main` into `develop`.

### 12.5 Branch Protection

For `main` and `develop`:

- Require a pull request before merging.
- Require status checks: `quality`, `docker`, `smoke`, `security`.
- Require branches to be up to date.
- Require linear history (squash merge).
- Do not allow force pushes.
- Do not allow deletions.
- Require conversation resolution.

### 12.6 Release Tags

- `v1.0.0` — final submission.
- Optional intermediate tags: `v0.1.0` (auth), `v0.2.0` (schedule), `v1.0.0` (bonuses + docs).

### 12.7 Exact Bootstrap Commands

```bash
git init -b main
git add .
git commit -m "chore: initialize healthcare scheduling platform"
git remote add origin <repo-url>
git push -u origin main

git checkout -b develop
git push -u origin develop
```

Then per feature:

```bash
git checkout develop
git pull
git checkout -b feature/auth-service
# work...
git add .
git commit -m "feat(auth): implement register, login, and validateToken"
git push -u origin feature/auth-service
# open PR into develop
```

---

## 13. Single-Day Execution Plan

No multi-day schedule. This is the order of work, with time boxes. The day is long; the sequence is what matters.

### Phase 0 — Spike + Scaffold (0:00–1:00)

- Validate the riskiest stack combination in a throwaway folder:
  - NestJS 12 CommonJS + Prisma 7 `prisma-client` generator + `nest build`.
  - GraphQL code-first + GraphiQL.
  - Jest 30 + ts-jest.
  - Native bcrypt in a multi-stage Docker build.
- Create repo skeleton, `.env.example`, `.gitignore`, `.dockerignore`, `.nvmrc`, `.editorconfig`.
- Create root `docker-compose.yml` skeleton (postgres, redis, mailpit).
- Create `infra/docker/postgres/init.sql`, `infra/redis/redis.conf`.
- Create `Makefile` and `scripts/` stubs.
- **Gate:** if Prisma 7 CJS fails, switch to the documented fallback before writing feature code.

### Phase 1 — Auth Service (1:00–2:45)

- Prisma schema + initial migration + seed.
- Config validation (Zod).
- `PrismaService` + `UsersRepository`.
- `PasswordService` (bcrypt), `TokenService` (JWT).
- `AuthService` + `AuthResolver` (register/login/validateToken).
- `JwtAuthGuard`.
- Health + metrics endpoints.
- Pino logging.
- Unit tests.
- **Gate:** register/login/validateToken work in GraphiQL and tests pass.

### Phase 2 — Schedule Service Core (2:45–4:45)

- Prisma schema + migration + seed.
- Redis module + cache service.
- Auth client + GraphQL guard.
- Customers module (CRUD + pagination + audit + tests).
- Doctors module (CRUD + pagination + audit + tests).
- Schedules module:
  - create with validation
  - conflict detection + unique constraint
  - list with filters + pagination
  - get with nested relations
  - delete
  - audit
  - unit tests
- Health + metrics endpoints.
- **Gate:** all GraphQL CRUD works with a bearer token; conflict returns `SCHEDULE_CONFLICT`.

### Phase 3 — Bonus: Cache (4:45–5:30)

- Finish versioned cache keys, TTL, invalidation.
- In-flight deduplication.
- Graceful fallback.
- Cache metrics.
- Tests.

### Phase 4 — Bonus: Queue + Notification Service (5:30–7:00)

- Notification service scaffold.
- BullMQ worker + retries/backoff + DLQ.
- Mailer module + Handlebars templates.
- Bull Board (dev/staging).
- Schedule service enqueues create/delete jobs.
- Docker Compose wiring for Redis + Mailpit.
- Tests.
- **Gate:** create/delete schedule sends real emails visible in Mailpit.

### Phase 5 — Tests & Coverage (7:00–8:15)

- Fill unit test gaps.
- E2E/GraphQL tests.
- Coverage thresholds.
- Fix flaky tests.
- **Gate:** each service >= 50% (target 80%+).

### Phase 6 — Docker, CI, Security (8:15–9:30)

- Multi-stage Dockerfiles, non-root, healthchecks.
- `docker-compose.override.yml`, `docker-compose.prod.yml`.
- Entrypoints + migrations + seed.
- GitHub Actions: `ci.yml`, `smoke.yml`, `security.yml`, `commitlint.yml`.
- Husky + lint-staged + commitlint.
- **Gate:** `docker compose up --build` works from a clean clone; CI config is valid.

### Phase 7 — Docs, ADRs, Postman (9:30–11:00)

- README (badges, quickstart, architecture, API, operations, troubleshooting).
- `docs/architecture.md`, `api.md`, `operations.md`, `security.md`, `testing.md`, `performance.md`, `roadmap.md`.
- ADRs 0001–0008.
- Runbooks.
- `contracts/*.graphql`.
- Postman collection + environment + README.
- `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODEOWNERS`, templates.
- **Gate:** a reviewer can follow the README without asking questions.

### Phase 8 — Final Validation + Release (11:00–12:00)

- `git clone` into a clean folder.
- `cp .env.example .env`.
- `docker compose up --build`.
- Run the 5-minute demo script.
- Run Newman smoke suite.
- Run k6 smoke (optional).
- `docker compose down -v`.
- Tag `v1.0.0`.
- **Gate:** everything works from a clean clone.

### Buffer

Keep 30–60 minutes for unexpected issues. If time is short, cut P1 extras, never P0 functionality.

---

## 14. Scope Discipline: P0 / P1 / P2

### P0 — Must Ship

- Auth service: register/login/validateToken, bcrypt, JWT, health.
- Schedule service: customer/doctor/schedule CRUD, auth guard, conflict, pagination, filters, health.
- Redis cache with invalidation.
- BullMQ queue + notification service + Mailpit.
- Docker Compose one-command up, migrations, seed.
- README, architecture diagram, env table, GraphQL examples.
- Postman collection.
- Coverage >= 50% (target 80%).
- CI (lint, test, build).
- Conventional commits, branches, `v1.0.0` tag.

### P1 — Should Ship

- ADRs (8).
- Makefile + scripts (bootstrap, smoke, reset, backup, restore, contracts, load test).
- Pino structured logging with request IDs.
- GraphQL Armor.
- Audit log table.
- `/metrics` + optional Prometheus/Grafana profile.
- Bull Board.
- Rate limiting on auth.
- Newman smoke suite in CI.
- Security scanning (CodeQL, Trivy, dependency review).
- Release workflow to GHCR.
- CHANGELOG, SECURITY, CONTRIBUTING, CODEOWNERS, PR/issue templates.
- `.editorconfig`, `.nvmrc`, `.gitattributes`.
- `docs/operations.md` + runbooks.
- E2E tests.
- k6 load script.

### P2 — Documented Roadmap (Not Built Today)

- Transactional outbox for email reliability.
- OpenTelemetry + Jaeger distributed tracing.
- Kubernetes/Helm manifests.
- RBAC/roles (admin, receptionist, doctor).
- Soft deletes / archival for healthcare records.
- GraphQL subscriptions for real-time schedule updates.
- Cursor-based pagination.
- PgBouncer / connection pooling at scale.
- Multi-region / read replicas.
- Sentry/error tracking.
- Idempotency keys for create mutations.

Document these in `docs/roadmap.md` with rationale. This is what real teams do: ship the core, document the next steps.

---

## 15. Scoring Optimization

### 15.1 Base Rubric

| Aspect | Weight | Target | Evidence |
|---|---:|---:|---|
| Functionality | 30% | 30/30 | All operations, validation, conflict rules, Postman/Newman, e2e |
| Code Quality | 25% | 25/25 | Strict TS, ESLint/Prettier, repository layer, DTOs, small modules, naming, error handling, ADRs |
| Architecture | 20% | 20/20 | Two independent services, DB-per-service, GraphQL contracts, auth delegation, event-driven notification, Redis cache, health checks |
| Docker Setup | 15% | 15/15 | Multi-stage, non-root, healthchecks, migrations, seed, one-command up, volumes, network, prod override |
| Documentation | 10% | 10/10 | README, C4 diagrams, ADRs, API docs, operations runbooks, env table, GraphQL examples, Postman, troubleshooting |

### 15.2 Bonus Matrix

| Bonus | Points | Implementation | Proof |
|---|---:|---|---|
| Email Notification | +15 | Notification service + Handlebars templates + Mailpit | Mailpit screenshots / live demo |
| Queue System | +10 | BullMQ producer/worker, retries, backoff, DLQ, Bull Board | Logs, queue UI, async behavior |
| Caching | +10 | Redis cache with versioned keys, TTL, invalidation, fallback | Cache hit metrics/logs, Redis keys, tests |
| Unit Testing | +10 | Jest, 80%+ coverage, CI artifacts | Coverage report, CI |
| API Documentation | +5 | GraphiQL descriptions, `contracts/*.graphql`, README, Postman | GraphiQL + docs |

### 15.3 Reviewer Impression Multipliers

- Clean-clone, one-command demo with seeded data.
- Mailpit UI so emails are visible, not just logged.
- Bull Board so queue behavior is visible.
- C4 + sequence diagrams in README.
- Postman collection with chained test scripts.
- CI badge and coverage artifacts.
- ADRs explaining trade-offs (Prisma 7 vs 8, ioredis vs cache-manager, BullMQ vs Bull, Restrict vs Cascade).
- Runbooks and operations docs.
- Audit log table.
- `/metrics` endpoint.
- Security scanning in CI.
- Clean conventional commit history and PR descriptions.
- A 5-minute demo script.

---

## 16. Risk Register

| Risk | Impact | Mitigation | Fallback |
|---|---|---|---|
| Prisma 7 generated client fails under CommonJS + `nest build` | High | Phase 0 spike | `prisma-client-js` generator or ESM + Vitest |
| NestJS 12 ESM packages break Jest | High | Node 24.9+, CommonJS app, ts-jest | Vitest |
| `bcrypt` native build fails in Docker | Medium | Multi-stage with build tools | `bcryptjs` |
| GraphQL 17 incompatible with Apollo Server 5 | High | Pin `graphql@16.15.0` | Upgrade Apollo when supported |
| `cache-manager`/Keyv version mismatch | High | Use direct `ioredis` | Pin `@keyv/redis@5.1.6` + `keyv@5.6.0` |
| BullMQ and cache evict each other in Redis | Medium | `maxmemory-policy noeviction`, separate logical DBs | Separate Redis containers |
| Docker startup race | Medium | Healthchecks + `depends_on` + entrypoint retry | Manual restart |
| Auth Service down blocks Schedule Service | Medium | Timeout + clear 503 error | Short token-validation cache (optional) |
| Coverage below 50% | High | Test matrix + CI thresholds | Add tests before docs polish |
| Time overrun | High | P0/P1/P2 scope discipline; cut P1 extras first | Reduce P1, never P0 |
| Secret committed | Critical | `.gitignore`, `.env.example`, pre-commit scan | Rotate and rewrite history |

---

## 17. Definition of Done

### Code
- [ ] All required operations implemented.
- [ ] All bonus features implemented.
- [ ] Strict TypeScript, no lint errors.
- [ ] No secrets in the repo.
- [ ] Prisma migrations committed.
- [ ] Seed data idempotent.
- [ ] Audit log written for mutations.

### Tests
- [ ] Unit tests pass.
- [ ] Coverage >= 50% (target 80%+).
- [ ] E2E tests pass.
- [ ] Newman smoke test passes.
- [ ] CI green.

### Docker
- [ ] `docker compose up --build` works from a clean clone.
- [ ] All containers healthy.
- [ ] Migrations run automatically.
- [ ] Emails visible in Mailpit.
- [ ] Redis cache works.
- [ ] Bull Board works (dev/staging).

### Docs
- [ ] README complete.
- [ ] C4 + sequence diagrams.
- [ ] ADRs 0001–0008.
- [ ] API docs.
- [ ] Operations runbooks.
- [ ] Env var table.
- [ ] GraphQL examples.
- [ ] Postman collection.
- [ ] Design decisions and non-goals.
- [ ] Troubleshooting section.

### Operations
- [ ] `/health` and `/metrics` on every service.
- [ ] Graceful shutdown verified.
- [ ] Backup/restore scripts work locally.
- [ ] Queue DLQ inspected.
- [ ] Cache outage fallback verified.

### Git
- [ ] `main` and `develop` protected.
- [ ] Conventional commits.
- [ ] PRs for each feature.
- [ ] `v1.0.0` tag.
- [ ] Release workflow publishes images (optional).

---

## 18. Reviewer Demo Script (5 Minutes)

1. `cp .env.example .env && docker compose up --build`
2. Wait for health; open:
   - `http://localhost:3001/graphql`
   - `http://localhost:3002/graphql`
   - `http://localhost:8025` (Mailpit)
   - `http://localhost:3003/admin/queues` (Bull Board)
3. Auth GraphiQL:
   - Run `login` with seeded `demo@clinic.test` / `Password123!`.
   - Copy `accessToken`.
4. Schedule GraphiQL:
   - Set header `{ "Authorization": "Bearer <token>" }`.
   - Query `customers` and `doctors` (seeded).
   - Run `createSchedule`.
5. Open Mailpit: show the "Schedule Confirmed" email.
6. Run the same `createSchedule` again: show `SCHEDULE_CONFLICT`.
7. Run `schedules` with a filter and pagination: show `items` + `pageInfo`.
8. Run `deleteSchedule`: show the "Schedule Cancelled" email in Mailpit.
9. Show:
   - `docker compose ps` (all healthy)
   - Bull Board job history
   - `/metrics` output
   - Coverage report
   - CI run
   - README C4 diagram
   - ADR list
10. Optionally show Redis keys and audit log rows.

---

## 19. Locked Decisions (Confirmed)

| Decision | Choice |
|---|---|
| Notification Service | **Separate third service** (`notification-service:3003`) consuming BullMQ jobs |
| Prisma version | **7.10.1 stable** (pin exact; do not use Prisma 8 RC) |
| Redis caching | **Direct `ioredis@6`** with versioned keys (no `cache-manager`/Keyv) |
| Branching model | **Lightweight Git Flow**: `main` + `develop` + feature/fix/chore/docs/test + release/hotfix |
| Password hashing | **Native `bcrypt@6`** with multi-stage Docker build tools |
| Email inspection | **Mailpit** at `http://localhost:8025` |
| GraphQL IDE | **GraphiQL** (the official replacement for the removed Playground) |
| App module format | **CommonJS** with NestJS 12 + Node 24 + Jest 30 |
| Database topology | **One PostgreSQL instance, two databases** (`auth_db`, `schedule_db`) |
| Execution model | **Single-day, production-grade delivery** (no multi-day schedule) |
| Scope model | **P0 must ship, P1 should ship, P2 documented roadmap** |

### Next Step

Switch out of Plan mode to begin execution:

1. Copy `requirements.md` to the repo root as `REQUIREMENTS.md`.
2. Copy `implementation-plan.md` to `docs/implementation-plan.md`.
3. Run **Phase 0** (spike + scaffold).
4. Build Auth Service, then Schedule Service, then bonuses, then hardening/docs, then release.
