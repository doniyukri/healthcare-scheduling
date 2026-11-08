# Healthcare Scheduling System — Plan Review & Detailed Addendum

> Companion to `requirements.md` and `implementation-plan.md`.
> Review date: **2026-11-08**
> Scope: RATA Backend Engineer skill test — NestJS / PostgreSQL / GraphQL / Docker / Prisma microservices.
> Purpose: find what the current plan could miss, then add the missing engineering detail.

---

## 0. Verdict

The plan is **strong on feature coverage, architecture, and rubric mapping**. Every operation in the brief is represented, all five bonuses are in scope, and the production-grade intent is clear.

The main risk is **not a missing feature**. It is the set of integration seams that only appear when the stack is actually assembled:

1. Prisma 7 build + seed pipeline under CommonJS.
2. PostgreSQL init race and healthcheck semantics.
3. GraphQL error/HTTP behavior with Apollo Server 5, GraphQL Armor, and CSRF protection.
4. Redis memory and connection topology when cache and BullMQ share one instance.
5. Windows developer tooling and clean-clone reproducibility.

If those five are handled early, the rest of the plan is executable. If they are left to the end, they can consume the day.

**Bottom line:** keep the scope, but add the hard gates, runtime details, and reviewer evidence described below.

---

## 1. What the current plan already gets right

| Area | Current plan | Assessment |
|---|---|---|
| Brief coverage | Auth register/login/validateToken; customer/doctor/schedule CRUD; pagination/filtering; conflict rule | Complete |
| Architecture | Two mandatory services + notification service; database-per-service; GraphQL auth delegation | Correct and well justified |
| Stack | NestJS 12, Apollo 5, GraphQL 16, Prisma 7, PostgreSQL 17, Redis 7, BullMQ 6 | Current and compatible |
| Bonuses | Email, BullMQ, Redis cache, 50%+ coverage, GraphQL docs | All five covered |
| Docker | Multi-stage, non-root, healthchecks, migrations, seed, compose files | Strong |
| Testing | Unit + integration + e2e + Newman + k6 | Strong |
| Process | Git Flow, Conventional Commits, ADRs, CI, release workflow | Production-shaped |
| Documentation | README, architecture, API, operations, security, testing, performance, roadmap, runbooks | Strong |

The plan is not missing a required operation. The brief’s Schedule module intentionally has **no `updateSchedule`** — do not add one just to satisfy the word “CRUD”; the table in the brief is the contract.

---

## 2. Gap register

Severity:

- **Critical** — can block the build, the demo, or a clean-clone run.
- **High** — can cost rubric points or make the project look less production-grade.
- **Medium** — edge case, polish, or operational maturity.
- **Low** — optional or explicitly out of scope.

| ID | Area | Gap | Severity | Why it matters | Add this |
|---|---|---|---|---|---|
| G-01 | Prisma 7 | `prisma/seed.ts` is not compiled by `nest build`, but the entrypoint runs `node dist/prisma/seed.js` | Critical | Seed will fail at container start; demo data missing | Move seed into `src/`, or add a `tsconfig.seed.json`, or run `tsx` in the runtime image |
| G-02 | Docker/Postgres | `pg_isready` can pass before `init.sql` creates `auth_db` / `schedule_db` | Critical | Services start before their database exists; migrations fail | Stronger healthcheck that checks both databases, or retry loop in entrypoint |
| G-03 | GraphQL/Apollo | GraphQL errors normally return HTTP 200; the plan promises 503 for auth outage | High | Reviewer sees 200 instead of 503; contract inconsistent | Use `GraphQLError` with `extensions.http.status`; verify in Phase 0 |
| G-04 | Redis | `noeviction` + cache on the same Redis instance can fill memory and block BullMQ writes | High | Queue jobs fail under cache pressure | Separate Redis instances, or `maxmemory` + `volatile-lru` with cache TTLs; document the trade-off |
| G-05 | Developer experience | Makefile and `.sh` scripts are not reliable on Windows | High | The author is on Windows; clean-clone demo may fail | Add cross-platform `npm run` scripts and/or PowerShell equivalents |
| G-06 | Data model | Prisma `DateTime` maps to `timestamp` without time zone by default | High | Scheduling times can shift across time zones/DST | Use `@db.Timestamptz(3)` for `scheduledAt`, `createdAt`, `updatedAt` |
| G-07 | GraphQL contract | `customer(id)`, `doctor(id)`, `schedule(id)` are nullable, but the error table implies `*_NOT_FOUND` | High | Inconsistent behavior; tests may expect one or the other | Decide: queries return `null`; mutations/relations throw domain errors. Document it |
| G-08 | Pagination/filtering | Edge cases are unspecified | Medium | Reviewer may probe `page=999`, `limit=0`, `from > to` | Define clamping, empty pages, `totalPages=0`, inclusive ranges, search escaping |
| G-09 | Customer/Doctor update | Empty update input is allowed by the SDL | Medium | `updateCustomer(id, {})` silently does nothing | Require at least one field; validate and return `VALIDATION_ERROR` |
| G-10 | Auth | bcrypt truncates at 72 bytes; password policy may reject valid reviewer input | Medium | Silent truncation or unexpected validation failure | Validate max 72 bytes; document the policy; keep min 8, avoid overly strict composition rules |
| G-11 | Auth | JWT secret strength and claims are not specified | High | Weak secret in demo; no issuer/audience | Enforce `JWT_SECRET` length/entropy at boot; add `iss`, `aud`, `sub`, `iat`, `exp`; pin `HS256` |
| G-12 | Inter-service auth | Only a timeout is specified; no retry/circuit-breaker/failure matrix | High | Auth outage causes cascading failures or hangs | Timeout + bounded retry + circuit breaker; request-ID propagation; explicit failure matrix |
| G-13 | Cache | In-process dedup only; no negative caching, TTL jitter, or cache metrics detail | Medium | Stampede across replicas; cache penetration; no proof | Add versioned keys, TTL jitter, negative cache, Redis lock/probabilistic refresh, hit/miss metrics |
| G-14 | Queue | DLQ and job idempotency are mentioned but not specified | High | Duplicate emails on retry; failed jobs disappear | Versioned job names, `jobId` dedup, final-failure DLQ, retention policy, worker concurrency |
| G-15 | Email | SMTP timeouts, pooling, template escaping, display timezone are unspecified | Medium | Worker hangs; broken HTML; wrong local time | Nodemailer pool + timeouts; Handlebars escaping; text fallback; `MAIL_TIMEZONE` |
| G-16 | Audit | Audit write is not transactional with the mutation | High | Mutation succeeds but audit row is lost | Use `$transaction` for create/update/delete + audit; append-only; retention policy |
| G-17 | Security/privacy | Any authenticated user can read/modify all customer and schedule data | High | Real healthcare IDOR risk; no ownership model | Document as an explicit assumption; add RBAC/tenant isolation to roadmap; minimize PII in logs/queue |
| G-18 | Testing | No test database, no contract test, no automated Mailpit assertion | High | E2E tests hit dev data; email bonus proven only manually | Separate test DBs; schema snapshot; Mailpit API assertion in smoke suite |
| G-19 | CI | No schema/migration drift check; permissions and artifacts unspecified | Medium | Schema and migrations can diverge; CI is not reproducible | `prisma migrate diff --exit-code`, `graphql-inspector diff`, least-privilege permissions, artifacts |
| G-20 | Observability | Metrics names exist, but no SLOs, alerts, or dashboard detail | Medium | Production claim is weaker | Add SLOs, alert rules, queue/cache metrics, correlation ID propagation |
| G-21 | Docker | Hardening, multi-arch, port conflicts, log rotation are unspecified | Medium | ARM reviewers may fail; noisy logs; port collisions | `init`, `cap_drop`, `no-new-privileges`, read-only, log rotation, buildx multi-arch, port table |
| G-22 | Rate limiting | GraphQL needs a custom throttler guard | Medium | Default HTTP throttler does not see GraphQL context | Custom `GqlThrottlerGuard`; per-IP + per-email auth limits |
| G-23 | Library integration | Mailer/Bull Board/Armor compatibility is assumed, not gated | High | A single peer mismatch can break the build late | Add Phase 0 compatibility gate with fallbacks |
| G-24 | Reviewer experience | No proof pack, screenshots, GIF, or demo video | High | Reviewer may not run the stack; evidence is lost | `docs/proof/` with screenshots; 3–5 minute demo video; `docs/demo.md` |
| G-25 | Scope/time | The single-day plan is very ambitious | High | Polish can crowd out P0 or testing | Freeze features after Phase 6; cut P1 first; keep a hard cut line |
| G-26 | Search | `contains` search without a trigram index does sequential scans | Medium | Slow list queries at scale | `pg_trgm` + GIN indexes; document query plan |
| G-27 | Domain rule | Customer double-booking is not addressed | Low | A customer could be in two places at once | Decide explicitly; document as a non-goal or add a second unique constraint |
| G-28 | Email identity | Email uniqueness is case-sensitive at the DB level | Medium | `A@x.com` and `a@x.com` can both register | Normalize to lowercase in the app; optionally `citext`/`lower(email)` unique index |
| G-29 | Health semantics | Liveness and readiness are conflated | High | Redis/Auth outage can restart a healthy service | Separate `/health/live` and `/health/ready`; optional dependencies = degraded |
| G-30 | Production config | Secrets are env vars; no production secret path | Medium | Production story is incomplete | Document Docker secrets/platform secret manager; no insecure defaults |

---

## 3. Detailed addendum

### 3.1 Prisma 7, build, and seed pipeline

#### 3.1.1 Exact `prisma.config.ts`

Prisma 7 requires a config file for the datasource URL and migration paths. Use `process.env` directly so `prisma generate` works in CI without a database:

```ts
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
```

Add `dotenv` to dependencies (it is needed when the config loads `.env` locally).

#### 3.1.2 Seed compilation — pick one and test it

The current plan has `prisma/seed.ts` but the entrypoint runs `node dist/prisma/seed.js`. `nest build` normally compiles only `src/`. Choose one:

**Option A — recommended: move the seed into `src/prisma/seed.ts`.**
- `nest build` compiles it to `dist/prisma/seed.js`.
- Entrypoint: `node dist/prisma/seed.js`.
- `migrations.seed` in dev: `tsx src/prisma/seed.ts`.

**Option B — separate tsconfig.**

```json
// tsconfig.seed.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "."
  },
  "include": ["prisma/seed.ts"]
}
```

Build script: `nest build && tsc -p tsconfig.seed.json`.
Entrypoint: `node dist/prisma/seed.js`.

**Option C — keep `tsx` in production dependencies.**
- `npm ci --omit=dev` must include `tsx`.
- Entrypoint: `npx tsx prisma/seed.ts`.
- Larger image, but simplest.

Whichever you choose, **run the entrypoint in a clean container during Phase 0**. This is a common late failure.

#### 3.1.3 Generated client

- Output to `src/generated/prisma` so it is inside the TypeScript program.
- Use `moduleFormat = "cjs"` and `importFileExtension = ""` for CommonJS.
- Add `src/generated/prisma` to ESLint ignores and coverage excludes.
- Do not import `@prisma/client` directly if using the new `prisma-client` generator; import from the generated path.
- Keep the generated client out of git.

#### 3.1.4 Prisma adapter and pool

```ts
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX ?? 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export class PrismaService extends PrismaClient {
  constructor() {
    super({ adapter });
  }
}
```

Add `DB_POOL_MAX` to the env schema. Document that each container gets its own pool; total connections must stay below PostgreSQL’s `max_connections`.

#### 3.1.5 Migration commands

- Local development: `npx prisma migrate dev --name <name>`.
- CI/container start: `npx prisma migrate deploy`.
- CI drift check: `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --exit-code`.
- `prisma migrate deploy` uses an advisory lock, so multiple replicas are safe; still prefer a separate migration job in production.

---

### 3.2 Database design, constraints, indexes, and time zones

#### 3.2.1 Use `timestamptz`

Prisma’s PostgreSQL `DateTime` default is `timestamp(3)` **without time zone**. For a scheduling system, that is a latent bug. Use:

```prisma
scheduledAt DateTime @db.Timestamptz(3)
createdAt   DateTime @default(now()) @db.Timestamptz(3)
updatedAt   DateTime @updatedAt @db.Timestamptz(3)
```

Apply the same to `AuditLog.createdAt` and `User.createdAt/updatedAt`.

Rules:

- Store UTC.
- Accept ISO-8601 input with an offset.
- Return ISO-8601 UTC from GraphQL.
- Format email display time in `MAIL_TIMEZONE` (default `Asia/Jakarta` for this test, or `UTC` if you prefer neutrality).
- Test a DST boundary if you use a non-UTC display zone.

#### 3.2.2 Add database-level length limits

```prisma
email     String @unique @db.VarChar(320)
name      String @db.VarChar(100)
objective String @db.VarChar(500)
```

This backs up class-validator and prevents oversized rows from other clients.

#### 3.2.3 Email case-insensitivity

Normalize in the application:

```ts
email.trim().toLowerCase()
```

Then add a DB-level guarantee. Two options:

- `citext` extension and `@db.Citext` if your Prisma version supports it.
- Raw migration: `CREATE UNIQUE INDEX users_email_lower_unique ON "User" (lower(email));` (same for `Customer`).

Document the choice. App-level normalization alone is not enough if another writer bypasses the service.

#### 3.2.4 Indexes

Current indexes are a good start. Add:

```prisma
@@index([customerId, scheduledAt])
@@index([doctorId, scheduledAt])
@@index([createdAt])
```

The unique `(doctorId, scheduledAt)` already covers doctor lookups. Add the customer/time index for customer filters and sorting.

#### 3.2.5 Search indexes

Prisma `contains` with `mode: 'insensitive'` generates `ILIKE '%term%'`, which does not use a normal B-tree index. Add a raw migration:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX customer_name_trgm_idx
  ON "Customer" USING gin (name gin_trgm_ops);

CREATE INDEX doctor_name_trgm_idx
  ON "Doctor" USING gin (name gin_trgm_ops);

CREATE INDEX schedule_objective_trgm_idx
  ON "Schedule" USING gin (objective gin_trgm_ops);
```

Quote table names exactly as Prisma creates them. Verify with `EXPLAIN ANALYZE` in `docs/performance.md`.

#### 3.2.6 Domain rules to decide explicitly

| Rule | Recommendation |
|---|---|
| Doctor double-booking | Enforce with `@@unique([doctorId, scheduledAt])` and map `P2002` to `SCHEDULE_CONFLICT` |
| Customer double-booking | Not required by the brief. Document as a non-goal, or add `@@unique([customerId, scheduledAt])` if you want a stricter clinic rule |
| Past schedules | Do not reject; reviewers may use fixed past dates in tests. Document that production may add a future-only rule |
| Duration/overlap | The schema has no duration. Document that conflict means exact timestamp equality. Roadmap: add `durationMinutes` and a PostgreSQL exclusion constraint on `tstzrange` |
| Hard delete | Required by the brief. Use `Restrict` for referenced customers/doctors. Document archival as a roadmap item |

#### 3.2.7 Audit log

Use `@db.Timestamptz(3)` for `createdAt`. Add:

- `@@index([createdAt])` (already present).
- Append-only semantics: no update/delete methods.
- In production, revoke `UPDATE`/`DELETE` on the audit table from the application role.
- Retention policy: 7 years for healthcare-like data is a common default; document it as a policy, not a hard-coded job.

---

### 3.3 GraphQL contract and error model

#### 3.3.1 Not-found semantics

The current SDL has nullable single-item queries:

```graphql
customer(id: ID!): Customer
doctor(id: ID!): Doctor
schedule(id: ID!): Schedule
```

Pick one and document it:

**Recommended:**

- Single-item queries return `null` when the ID does not exist.
- Mutations and relationship lookups throw `CUSTOMER_NOT_FOUND`, `DOCTOR_NOT_FOUND`, or `SCHEDULE_NOT_FOUND`.
- `createSchedule` with an invalid `customerId`/`doctorId` throws the domain error.

This is idiomatic GraphQL and keeps the error table meaningful. Add a short “Not found behavior” subsection to `docs/api.md`.

#### 3.3.2 Update input validation

`UpdateCustomerInput` and `UpdateDoctorInput` currently allow `{}`. Add a custom validator:

```ts
@ValidateIf((o) => !o.name && !o.email)
@IsNotEmpty({ message: 'At least one field must be provided' })
readonly _atLeastOne?: never;
```

Or validate in the service and throw `VALIDATION_ERROR`. Document that `updateCustomer` is a partial update, not a replace.

#### 3.3.3 Pagination rules

Define and test:

| Case | Behavior |
|---|---|
| `page` missing | Default `1` |
| `page < 1` | `VALIDATION_ERROR` (or clamp to 1; pick one) |
| `limit` missing | Default `10` |
| `limit < 1` or `> 100` | `VALIDATION_ERROR` (or clamp; pick one) |
| `page > totalPages` | Return `items: []`, correct `pageInfo`, `total` unchanged |
| `total = 0` | `totalPages = 0`, `hasNextPage = false`, `hasPreviousPage = false` |
| `hasNextPage` | `page < totalPages` |
| `hasPreviousPage` | `page > 1` |

Run `findMany` and `count` in a `$transaction` so the page and total come from a consistent snapshot.

#### 3.3.4 Filter rules

| Filter | Rule |
|---|---|
| `search` | Trim; max 100 chars; case-insensitive `contains`; escape `%` and `_` if you build raw SQL (Prisma handles parameterization, but wildcard semantics still matter) |
| `from` / `to` | Inclusive bounds; `from <= to`; reject ranges over 366 days with `VALIDATION_ERROR` |
| `doctorId` / `customerId` | Validate UUID format; unknown IDs return an empty list (not an error) |
| Default sort | `scheduledAt ASC`, then `id ASC` for stable pagination |
| Customer/Doctor default sort | `name ASC`, then `id ASC` |

Add `sort` input only if you have time; it is not required by the brief.

#### 3.3.5 Error shape

Use one shape everywhere:

```json
{
  "errors": [
    {
      "message": "Doctor already has a schedule at this time",
      "path": ["createSchedule"],
      "extensions": {
        "code": "SCHEDULE_CONFLICT",
        "requestId": "01J...",
        "timestamp": "2026-11-08T10:00:00.000Z"
      }
    }
  ],
  "data": null
}
```

Rules:

- `extensions.code` is stable and documented.
- `message` is human-readable and safe.
- No stack traces or SQL in production.
- Log the original error with the request ID.

#### 3.3.6 HTTP status for GraphQL errors

Apollo returns HTTP 200 for most GraphQL errors. If you promise 503 for auth outage, set it explicitly:

```ts
throw new GraphQLError('Auth service is unavailable', {
  extensions: {
    code: 'AUTH_SERVICE_UNAVAILABLE',
    requestId,
    http: { status: 503 },
  },
});
```

Use the same pattern for `401` (`UNAUTHORIZED`), `429` (`RATE_LIMITED`), and `409` (`SCHEDULE_CONFLICT`). Verify in Phase 0 that `@nestjs/apollo` preserves `extensions.http.status`.

#### 3.3.7 Apollo CSRF prevention

Apollo Server 4+ enables CSRF prevention by default. This is good; do not disable it.

Practical implications:

- Postman and GraphiQL use `POST` with `Content-Type: application/json`, so they work.
- If you send GraphQL queries via `GET` (for example, a browser address bar), include `Apollo-Require-Preflight: true`.
- Document this in `docs/api.md` so a reviewer does not hit a mysterious 400.

#### 3.3.8 Introspection and schema safety

- GraphiQL: enabled in development/staging, disabled in production.
- Introspection: enabled where GraphiQL is enabled; disabled in production.
- GraphQL Armor: max depth 10, max aliases 50, cost limit 1000, character limit, and block field suggestions.
- Commit `contracts/auth.graphql` and `contracts/schedule.graphql`.
- CI: `graphql-inspector diff` against `develop` to catch breaking changes.

---

### 3.4 Auth hardening

#### 3.4.1 JWT

- Algorithm: `HS256` explicitly.
- Claims: `sub` (user ID), `email`, `iat`, `exp`, `iss`, `aud`.
- `JWT_SECRET`: required; minimum 32 characters; fail boot if missing or weak.
- `JWT_EXPIRES_IN`: default `1h`; document.
- Clock tolerance: 5 seconds.
- Never log the token.
- `validateToken` must verify the signature, expiry, issuer, and audience, then confirm the user still exists. If the user was deleted, return `UNAUTHORIZED`.
- Roadmap: `kid`-based key rotation and refresh tokens (not required by the brief).

#### 3.4.2 Password policy

- bcrypt cost 12 (configurable via `BCRYPT_ROUNDS`).
- Minimum 8 characters.
- Maximum **72 bytes** (not characters). bcrypt truncates beyond 72 bytes; reject longer input with `VALIDATION_ERROR`.
- Do not require uppercase/symbol composition unless you document it; strict rules can reject a reviewer’s simple test password.
- Normalize nothing in the password; preserve it exactly.
- Never return the hash.
- Timing: if the user is not found, run a dummy bcrypt compare so login timing does not reveal whether the email exists.

#### 3.4.3 Email normalization

- Trim and lowercase before validation and storage.
- Max 320 characters.
- Use `@IsEmail()`.
- Enforce uniqueness in the database as well as the application.

#### 3.4.4 Rate limiting

Add `@nestjs/throttler` and a GraphQL-aware guard:

```ts
ThrottlerModule.forRoot([
  { name: 'global', ttl: 60_000, limit: 100 },
  { name: 'auth', ttl: 60_000, limit: 5 },
]);
```

- `GqlThrottlerGuard` resolves the request from `GqlExecutionContext`.
- Key by IP + operation + normalized email for login/register.
- Return `RATE_LIMITED` with HTTP 429.
- Document proxy trust (`TRUST_PROXY`) if deployed behind a load balancer.

#### 3.4.5 Auth failure behavior

| Condition | Result |
|---|---|
| Missing header | `UNAUTHORIZED` (401) |
| Malformed header | `UNAUTHORIZED` (401) |
| Invalid signature | `UNAUTHORIZED` (401) |
| Expired token | `UNAUTHORIZED` (401) |
| Valid token, deleted user | `UNAUTHORIZED` (401) |
| Auth service timeout | `AUTH_SERVICE_UNAVAILABLE` (503) |
| Auth service 5xx | `AUTH_SERVICE_UNAVAILABLE` (503) |
| Auth service malformed response | `AUTH_SERVICE_UNAVAILABLE` (503) |

---

### 3.5 Inter-service authentication

#### 3.5.1 Client behavior

```ts
const client = new GraphQLClient(authUrl, {
  headers: {
    authorization: `Bearer ${token}`,
    'x-request-id': requestId,
  },
  signal: AbortSignal.timeout(timeoutMs),
});

const data = await client.request<{ validateToken: User }>(VALIDATE_TOKEN_QUERY);
```

- Timeout: `AUTH_SERVICE_TIMEOUT_MS` (default 2000).
- Retry: at most one retry on a network error or 5xx, with a short jitter; never retry `UNAUTHORIZED`.
- Circuit breaker: after 5 consecutive failures, fail fast for 30 seconds; expose state in logs/metrics. A small in-house breaker is enough; avoid adding a heavy dependency.
- Forward `x-request-id` so the Auth service logs correlate.
- Log the Auth service latency and outcome.

#### 3.5.2 Failure matrix

| Dependency | Failure | Behavior |
|---|---|---|
| Auth service | Down/timeout | Schedule returns `AUTH_SERVICE_UNAVAILABLE` (503); liveness stays up |
| PostgreSQL | Down | Schedule/Auth readiness fails; requests return `INTERNAL_SERVER_ERROR` or 503 |
| Redis cache | Down | Schedule falls back to PostgreSQL; readiness is `degraded`, not down |
| Redis queue | Down | Mutation succeeds; email enqueue fails and is logged; readiness is `degraded` |
| SMTP | Down | Notification worker retries; health is `degraded`; emails are not lost until retries exhaust |
| Mailpit | Down | Notification health is `degraded`; no impact on Schedule/Auth |

#### 3.5.3 Optional token-validation cache

A short cache (for example, 30 seconds) keyed by `SHA-256(token)` reduces Auth load. It delays revocation by up to the TTL. If you add it:

- Cache only valid results.
- Use a short TTL.
- Document the security trade-off.
- Add a metric for cache hits/misses.

Do not add it unless the load test shows a need.

---

### 3.6 Redis cache design

#### 3.6.1 Key format

```text
cache:v1:<entity>:<version>:<sha256(canonical-json-args)>
cache:v1:<entity>:version
```

- `entity`: `customers`, `doctors`, `schedules`.
- `version`: integer from `INCR`.
- Canonical JSON: stable key order, normalized dates, no `undefined`.
- SHA-256 keeps keys bounded and avoids leaking raw filters.

#### 3.6.2 Read path

1. Read the entity version.
2. Build the key.
3. `GET` the key.
4. On hit: deserialize and return; increment `cache_operations_total{result="hit"}`.
5. On miss: check the in-process in-flight map for the same key.
6. If another request is already loading, await it.
7. Otherwise load from PostgreSQL, `SET` with TTL + jitter, and return.

#### 3.6.3 Write path

1. Complete the database mutation and commit.
2. `INCR cache:v1:<entity>:version` for each affected entity.
3. Do not delete individual keys; version bump invalidates the whole entity namespace.
4. Invalidate related namespaces when nested data changes:
   - `updateCustomer` -> `customers`, `schedules`
   - `updateDoctor` -> `doctors`, `schedules`
   - `createSchedule`/`deleteSchedule` -> `schedules`

#### 3.6.4 TTL and stampede

- Base TTL: `CACHE_TTL_MS` (default 60s).
- Jitter: add 0–10% to avoid synchronized expiry.
- In-process dedup handles a single instance.
- For multiple instances, use one of:
  - A short Redis lock (`SET key:lock NX PX 5000`) around the load.
  - Probabilistic early refresh.
- Document which one you chose.

#### 3.6.5 Negative caching

For single-item lookups, cache “not found” for 10 seconds with a sentinel value. This prevents cache penetration on repeated invalid IDs. Do not negative-cache list queries.

#### 3.6.6 Redis topology and memory

The current plan uses one Redis with `maxmemory-policy noeviction`. That protects queue jobs but lets the cache grow until Redis rejects writes, which also breaks the queue.

Choose one:

**Option A — recommended for production realism:** two Redis instances.
- `redis-cache` with `maxmemory` + `allkeys-lru`.
- `redis-queue` with `appendonly yes` + `noeviction`.

**Option B — one instance, controlled:** `maxmemory` + `volatile-lru`.
- Cache keys have TTLs, so they are eviction candidates.
- Queue keys generally do not have TTLs, so they are less likely to be evicted.
- Verify BullMQ behavior under eviction; this is not a guarantee.

**Option C — test-only:** one instance with `noeviction` and a small cache TTL, documented as a local simplification.

For the skill test, Option C is acceptable if you document the production trade-off. For “real project” credibility, Option A is stronger.

#### 3.6.7 Redis clients

Use separate clients for cache and queue:

```ts
// cache: fail fast, do not queue commands while offline
new Redis(cacheUrl, {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  lazyConnect: true,
});

// BullMQ: workers must be allowed to block/retry
new Redis(queueUrl, {
  maxRetriesPerRequest: null,
});
```

Never share a cache client configured with `maxRetriesPerRequest: 1` with a BullMQ worker. It can break blocking commands.

#### 3.6.8 Metrics

- `cache_operations_total{entity,result}` where result is `hit|miss|error`.
- `cache_load_duration_seconds{entity}`.
- `cache_invalidations_total{entity}`.
- Log Redis errors at `warn`, not `error`, when falling back.

---

### 3.7 BullMQ and notification service

#### 3.7.1 Job contract

Use versioned job names:

```text
schedule.created.v1
schedule.deleted.v1
```

Payload:

```ts
type ScheduleEmailPayload = {
  version: 1;
  scheduleId: string;
  objective: string;
  scheduledAt: string; // ISO-8601 UTC
  customer: { id: string; name: string; email: string };
  doctor: { id: string; name: string };
};
```

Validate the payload with Zod in the worker. Unknown versions go to the DLQ, not a crash.

#### 3.7.2 Enqueue options

```ts
await emailQueue.add('schedule.created.v1', payload, {
  jobId: `schedule-created:${schedule.id}`,
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600, count: 5000 },
});
```

- `jobId` prevents duplicate emails if the same schedule event is enqueued twice.
- `removeOnComplete` keeps recent history for the demo.
- `removeOnFail` keeps failures for inspection.

#### 3.7.3 DLQ

BullMQ has a failed set, not a built-in DLQ. Implement one explicitly:

```ts
@OnWorkerEvent('failed')
async onFailed(job: Job, error: Error) {
  const attempts = job.opts.attempts ?? 1;
  if (job.attemptsMade >= attempts) {
    await this.dlq.add('email.failed.v1', {
      jobId: job.id,
      name: job.name,
      data: job.data,
      error: error.message,
      failedAt: new Date().toISOString(),
    });
  }
}
```

- DLQ name: `email-dlq`.
- Bull Board shows both queues.
- Runbook: inspect, fix, replay, or discard.

#### 3.7.4 Worker settings

- `concurrency: 5`.
- `lockDuration: 30_000`.
- `stalledInterval: 30_000`.
- `maxStalledCount: 1`.
- Graceful shutdown: `worker.close()` waits for active jobs; `queue.close()`; `connection.quit()`.
- `stop_grace_period` in Compose: 30s.

#### 3.7.5 SMTP

- `nodemailer` transport with `pool: true`, `maxConnections: 5`, `maxMessages: 100`.
- Timeouts: `connectionTimeout: 10_000`, `greetingTimeout: 10_000`, `socketTimeout: 20_000`.
- `transporter.verify()` on startup; log a warning if it fails, do not crash the worker.
- Health check caches the verify result for 30 seconds.
- Production: TLS, authentication, and a real provider.

#### 3.7.6 Templates

- Handlebars auto-escapes HTML; do not use triple braces for user data.
- Provide a plain-text fallback.
- Sanitize the subject: strip newlines and limit length.
- Format `scheduledAt` in `MAIL_TIMEZONE`.
- Include: customer name, doctor name, objective, scheduledAt, schedule ID.
- Do not include the customer’s email in the body unless necessary.
- Add a footer with the clinic name and a “do not reply” note.

#### 3.7.7 Bull Board

- `@bull-board/nestjs` 9.11 supports Nest 12.
- Install `@bull-board/api` and `@nestjs/bull-shared`.
- Mount at `/admin/queues`.
- Protect with basic auth (`BULL_BOARD_USER`, `BULL_BOARD_PASSWORD`) or disable in production.
- `BULL_BOARD_ENABLED=false` in production by default.
- Document that it is an operator tool, not a public endpoint.

---

### 3.8 Audit logging

#### 3.8.1 Transactionality

For create/update/delete, write the audit row in the same `$transaction` as the mutation:

```ts
await prisma.$transaction(async (tx) => {
  const schedule = await tx.schedule.create({ data });
  await tx.auditLog.create({
    data: {
      actorId: user.id,
      action: 'schedule.create',
      entity: 'Schedule',
      entityId: schedule.id,
      requestId,
      metadata: { objective: schedule.objective, doctorId: schedule.doctorId },
    },
  });
  return schedule;
});
```

If the audit write fails, the mutation fails. For healthcare-like data, that is the safer default. A transactional outbox is the production upgrade for cross-service events, not for the audit row.

#### 3.8.2 What to record

- `actorId` from Auth Service.
- `action`: `customer.create`, `customer.update`, `customer.delete`, `doctor.create`, `doctor.update`, `doctor.delete`, `schedule.create`, `schedule.delete`.
- `entity`, `entityId`.
- `requestId`.
- `metadata`: non-sensitive summary. Avoid passwords, tokens, and full customer email. If you need to identify the customer, use the ID.
- Do not store the full request body.

#### 3.8.3 Retention and access

- Append-only: no update/delete API.
- Production: revoke `UPDATE`/`DELETE` on the audit table from the app role.
- Retention: document a policy (for example, 7 years).
- Provide a read-only SQL example in `docs/operations.md`:

```sql
SELECT created_at, actor_id, action, entity, entity_id, request_id
FROM "AuditLog"
ORDER BY created_at DESC
LIMIT 50;
```

---

### 3.9 Docker and runtime

#### 3.9.1 PostgreSQL init race

`pg_isready` can report ready before `init.sql` finishes creating both databases. Use a healthcheck that verifies both databases:

```yaml
healthcheck:
  test:
    - CMD-SHELL
    - >
      pg_isready -U ${POSTGRES_USER} -d postgres &&
      psql -U ${POSTGRES_USER} -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='auth_db'" | grep -q 1 &&
      psql -U ${POSTGRES_USER} -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='schedule_db'" | grep -q 1
  interval: 5s
  timeout: 5s
  retries: 20
```

Alternatively, add a retry loop in each service entrypoint:

```sh
until npx prisma migrate deploy; do
  echo "Database not ready, retrying in 2s..."
  sleep 2
done
```

Use both for robustness.

#### 3.9.2 Health semantics

Separate liveness and readiness:

| Endpoint | Purpose | Dependencies |
|---|---|---|
| `GET /health/live` | Is the process alive? | None |
| `GET /health/ready` | Can it serve traffic? | Required dependencies |
| `GET /health` | Human-friendly summary | All, with `degraded` for optional |

- Auth readiness: PostgreSQL.
- Schedule readiness: PostgreSQL; Redis cache and Auth service are `degraded` if down.
- Notification readiness: Redis; SMTP is `degraded` if down.
- Liveness must not fail because Redis or Auth is down; otherwise the orchestrator restarts a healthy service.

Terminus 12: use `HealthIndicatorService` and custom indicators. Return HTTP 200 with `status: "degraded"` for optional dependencies if your platform supports it; otherwise return 503 only for required dependencies.

#### 3.9.3 Container hardening

Add to production-like services:

```yaml
init: true
security_opt:
  - no-new-privileges:true
cap_drop:
  - ALL
read_only: true
tmpfs:
  - /tmp
stop_grace_period: 30s
logging:
  driver: json-file
  options:
    max-size: "10m"
    max-file: "3"
```

Notes:

- `read_only: true` may require a writable `/tmp` and a writable Prisma cache directory; test it.
- `init: true` gives PID 1 signal handling.
- Do not publish PostgreSQL or Redis ports in `docker-compose.prod.yml`.
- Put PostgreSQL/Redis on an internal network; expose only the service ports.

#### 3.9.4 Multi-arch

Reviewers may use ARM Macs. Build for both:

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t <image> .
```

- `node:24-bookworm-slim`, `postgres:17-alpine`, and `redis:7-alpine` support both.
- Native `bcrypt` may compile on ARM if no prebuild exists; keep the build tools in the dependency stage.
- Document the `buildx` command in `CONTRIBUTING.md`.

#### 3.9.5 Ports

| Host port | Service | Conflict risk |
|---:|---|---|
| 3001 | Auth | Common dev port |
| 3002 | Schedule | Low |
| 3003 | Notification / Bull Board | Low |
| 5432 | PostgreSQL | Often already used locally |
| 6379 | Redis | Often already used locally |
| 8025 | Mailpit UI | Low |
| 1025 | Mailpit SMTP | Low |
| 9090 | Prometheus (optional) | Medium |
| 3000 | Grafana (optional) | Very common |

Provide a `.env` override for host ports:

```env
AUTH_PORT=3001
SCHEDULE_PORT=3002
NOTIFICATION_PORT=3003
POSTGRES_PORT=5432
REDIS_PORT=6379
MAILPIT_UI_PORT=8025
MAILPIT_SMTP_PORT=1025
```

#### 3.9.6 Windows developer experience

The author is on Windows. Makefile and `.sh` scripts may not work without Git Bash/WSL. Add cross-platform npm scripts:

```json
{
  "scripts": {
    "stack:up": "docker compose up --build -d",
    "stack:down": "docker compose down",
    "stack:reset": "docker compose down -v",
    "stack:logs": "docker compose logs -f",
    "stack:ps": "docker compose ps",
    "test": "npm run test --workspaces --if-present",
    "smoke": "newman run postman/Healthcare-Scheduling.postman_collection.json -e postman/Healthcare-Scheduling.postman_environment.json",
    "verify": "npm run lint && npm run test && npm run build && npm run smoke"
  }
}
```

Also provide `scripts/*.ps1` for Windows-only operators, or document “use Git Bash/WSL”. Add `.gitattributes`:

```gitattributes
* text=auto
*.sh text eol=lf
*.ps1 text eol=crlf
```

---

### 3.10 Testing and QA

#### 3.10.1 Test layers

| Layer | Tool | What it proves |
|---|---|---|
| Unit | Jest | Business logic, guards, filters, cache, queue, templates |
| Integration | Jest + test DB or mocked Prisma | Resolver -> service -> repository wiring |
| E2E | supertest + GraphQL | HTTP behavior, auth, validation, errors |
| Contract | Schema snapshot + GraphQL Inspector | The API does not break accidentally |
| Smoke | Newman + Mailpit API | The Docker stack works end to end |
| Load | k6 | Latency and throughput |
| Security | npm audit, CodeQL, Trivy, gitleaks | Supply chain and code risks |

#### 3.10.2 Test database

Do not run e2e tests against the dev database.

- `auth_test_db`, `schedule_test_db`.
- Run `prisma migrate deploy` before the suite.
- Truncate tables between tests, or wrap each test in a transaction.
- Use deterministic factories with fixed IDs and dates.
- Set `TZ=UTC` in CI.
- Use `jest.useFakeTimers()` for token expiry and schedule times.

#### 3.10.3 Contract tests

- Commit `contracts/auth.graphql` and `contracts/schedule.graphql`.
- Snapshot `src/schema.gql` and fail if it changes unexpectedly.
- CI: `graphql-inspector diff` against the target branch.
- Auth client test: a stub GraphQL server returns the exact `validateToken` shape; assert the client maps errors correctly.

#### 3.10.4 Mailpit assertions

The smoke suite should not rely on a human opening the UI. Use the Mailpit API:

```bash
curl -s http://localhost:8025/api/v1/messages \
  | jq -e '.messages[] | select(.Subject | contains("Schedule Confirmed"))'
```

Add assertions for:

- The email is sent to the correct customer.
- The subject contains the schedule date.
- The body contains the doctor and objective.
- A delete email is sent after `deleteSchedule`.
- The email is sent asynchronously (the mutation returns before the email arrives; poll with a timeout).

#### 3.10.5 Redis assertions

```bash
docker compose exec redis redis-cli --scan --pattern 'cache:v1:*'
docker compose exec redis redis-cli GET 'cache:v1:customers:version'
```

Use these in the demo and in `docs/operations.md`.

#### 3.10.6 Coverage

- Per service, not only aggregate.
- `collectCoverageFrom` includes `src/**/*.ts`.
- Exclude `main.ts`, `*.module.ts`, `src/generated/**`, and type-only files.
- Thresholds: statements 70, branches 60, functions 70, lines 70.
- CI uploads `coverage/lcov.info` per service.
- README reports actual numbers.

#### 3.10.7 Flaky-test rules

- No `sleep` in tests; poll with a timeout.
- Freeze time for token/schedule tests.
- Use `TZ=UTC`.
- Do not depend on test execution order.
- Reset the database between suites.
- Retry only network calls, never assertions.

---

### 3.11 CI/CD and supply chain

#### 3.11.1 `ci.yml`

Matrix: `auth-service`, `schedule-service`, `notification-service`.

Steps:

1. Checkout.
2. Setup Node 24 with npm cache.
3. `npm ci`.
4. `npm run lint`.
5. `npm run test:cov`.
6. `npm run build`.
7. `npx prisma validate` (services with Prisma).
8. `npx prisma migrate diff --exit-code` (services with Prisma).
9. Upload coverage artifact.
10. Upload build artifact if needed.

Add a `docker` job:

- `docker compose config`
- `docker compose build`
- Optional: `docker buildx` multi-arch check.

#### 3.11.2 `smoke.yml`

- `docker compose up -d --build`
- Wait for health with a timeout.
- Run Newman.
- Assert Mailpit messages.
- On failure, dump `docker compose logs` and `docker compose ps`.
- `docker compose down -v`.

#### 3.11.3 `security.yml`

- CodeQL for TypeScript.
- `dependency-review` on PRs.
- Trivy image scan for each service.
- `gitleaks` for secrets.
- `npm audit --omit=dev --audit-level=high` (triage; do not fail the build on unfixable transitive issues without a documented exception).

#### 3.11.4 `release.yml`

- Trigger: tag `v*.*.*`.
- Permissions: `contents: write`, `packages: write`, `id-token: write`, `attestations: write`.
- Build and push to GHCR.
- Generate SBOM and provenance.
- Create a GitHub Release with `CHANGELOG.md` notes.

#### 3.11.5 Workflow hygiene

- `concurrency` groups cancel superseded runs.
- `timeout-minutes` on every job.
- Least-privilege `permissions`.
- Cache npm by lockfile hash.
- Commit all lockfiles.
- Pin action versions by major or SHA.
- Dependabot for npm, Docker, and GitHub Actions.

#### 3.11.6 Schema and migration gates

```bash
npx prisma validate
npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --exit-code
npx graphql-inspector diff contracts/schedule.graphql src/schema.gql
```

These three checks catch the most common “it worked locally” failures.

---

### 3.12 Observability and SLOs

#### 3.12.1 Logs

- JSON in production; pretty in development.
- Fields: `service`, `version`, `env`, `requestId`, `route`, `status`, `durationMs`.
- Redact `authorization`, `password`, `cookie`, tokens, and customer email.
- Log auth failures at `warn`; unexpected errors at `error`.
- Log queue lifecycle at `info`/`error`.
- Do not log request bodies.

#### 3.12.2 Metrics

| Metric | Labels | Purpose |
|---|---|---|
| `http_requests_total` | `service`, `method`, `route`, `status` | Traffic and errors |
| `http_request_duration_seconds` | `service`, `route` | Latency |
| `db_query_duration_seconds` | `service`, `operation` | DB health |
| `cache_operations_total` | `entity`, `result` | Cache effectiveness |
| `cache_load_duration_seconds` | `entity` | Cache load cost |
| `queue_jobs_total` | `queue`, `status` | Throughput and failures |
| `queue_depth` | `queue`, `state` | Backlog |
| `auth_client_requests_total` | `result` | Inter-service health |
| `auth_client_duration_seconds` | — | Inter-service latency |

Keep label cardinality low: never put raw IDs, emails, or free-text search terms in labels.

#### 3.12.3 SLOs

Document these in `docs/slo.md`:

| SLO | Target | Measurement |
|---|---|---|
| Availability | 99.9% monthly | Successful requests / total |
| Schedule list latency | p95 < 300ms | HTTP histogram |
| Schedule create latency | p95 < 500ms | HTTP histogram |
| Error rate | < 1% | 5xx / total |
| Email queue lag | p95 < 60s | Queue timestamp |
| Cache hit ratio | > 70% for list queries | Cache metrics |

#### 3.12.4 Alerts

Add example Prometheus rules:

- `http_5xx_rate > 5% for 5m`.
- `queue_depth > 1000 for 10m`.
- `auth_client_failures > 5 in 5m`.
- `cache_error_rate > 10% for 5m`.
- `db_query_p95 > 1s for 5m`.

#### 3.12.5 Correlation

- Accept `x-request-id` from the client; generate one if missing.
- Forward it to Auth Service.
- Include it in GraphQL error extensions and logs.
- Return it in the `x-request-id` response header.

---

### 3.13 Security and privacy

#### 3.13.1 Threat model

Write a short STRIDE table in `docs/security.md`:

| Threat | Example | Control |
|---|---|---|
| Spoofing | Forged JWT | Signature, expiry, issuer/audience, strong secret |
| Tampering | Malicious input | class-validator, Prisma parameterization, whitelist |
| Repudiation | Denied mutation | Audit log with actor and request ID |
| Information disclosure | PII in logs/errors | Redaction, safe error messages, no stack traces |
| Denial of service | Expensive GraphQL query | GraphQL Armor, rate limiting, pagination limits |
| Elevation of privilege | IDOR | Documented assumption; RBAC roadmap |

#### 3.13.2 IDOR and authorization

The brief only requires authentication, not authorization. Any authenticated user can read and modify all customers, doctors, and schedules. That is a real healthcare risk.

Do not silently ignore it. Add to `docs/security.md`:

> This delivery implements authentication only. Authorization (RBAC, tenant isolation, doctor/patient scoping) is out of scope for the brief and is listed in `docs/roadmap.md`.

If you want a small improvement without changing the API, add `createdBy` to `Schedule` and filter by actor. But that changes behavior and may surprise reviewers. Prefer documenting the assumption.

#### 3.13.3 PII/PHI handling

- Customer email is PII; the schedule objective may contain health information.
- Redact email in logs.
- Do not put full customer data in queue payloads if you can avoid it; the current design includes name/email because the notification service has no database. Document the trade-off and keep the payload minimal.
- Encrypt backups at rest.
- Use TLS in production.
- Do not commit `.env`.
- Add `SECURITY.md` with a vulnerability reporting process.

#### 3.13.4 Secrets

- `.env` is local-only; `.env.example` has placeholders.
- `JWT_SECRET` has no insecure default; boot fails if missing or too short.
- Production: use Docker secrets or the platform secret manager.
- Run `gitleaks` in CI.
- Rotate any secret that is accidentally committed; rewriting history is not enough.

#### 3.13.5 Container and network

- Non-root user.
- `no-new-privileges`, `cap_drop: ALL`.
- Read-only root filesystem where possible.
- No DB/Redis host ports in production.
- Internal network for data stores.
- TLS termination at a reverse proxy/load balancer.

---

### 3.14 Documentation and reviewer experience

#### 3.14.1 README first screen

The reviewer should understand the project in 60 seconds:

1. One-line description.
2. Badges: CI, coverage, license, Node version.
3. Architecture diagram (Mermaid).
4. Quickstart: `cp .env.example .env && docker compose up --build`.
5. Demo credentials.
6. Endpoints table.
7. 5-minute demo script.
8. Links to deeper docs.

#### 3.14.2 Proof pack

Create `docs/proof/` with:

- `graphiql-auth.png`
- `graphiql-schedule.png`
- `mailpit-created.png`
- `mailpit-deleted.png`
- `bull-board.png`
- `coverage.png`
- `ci-green.png`
- `docker-compose-ps.png`
- `metrics.png`
- `audit-log.png`
- `redis-keys.png`

A 3–5 minute Loom/GIF is a strong differentiator. Reviewers may not run Docker; visual proof carries the bonus claims.

#### 3.14.3 Additional docs

Add:

- `docs/demo.md` — exact commands and expected output.
- `docs/glossary.md` — customer, doctor, schedule, objective, conflict.
- `docs/slo.md` — SLOs and error budget.
- `docs/threat-model.md` — STRIDE table.
- `docs/onboarding.md` — day-one developer guide.
- `docs/troubleshooting.md` — common failures and fixes.
- `docs/release-process.md` — branch, tag, release, rollback.
- `docs/environments.md` — local, CI, staging, production.
- `docs/api-versioning.md` — additive changes, deprecation.
- `docs/adr/template.md` — ADR template.
- `README.id.md` — optional Indonesian summary for the reviewer.

#### 3.14.4 Postman

- Collection with folders: Auth, Customers, Doctors, Schedules, Negative tests.
- Environment: `authUrl`, `scheduleUrl`, `token`, `customerId`, `doctorId`, `scheduleId`.
- Test scripts save IDs and assert:
  - `200` HTTP status for GraphQL.
  - `errors[0].extensions.code` for negative cases.
  - `data.createSchedule.id` exists.
  - `pageInfo.total >= 1`.
- Newman HTML report (`newman-reporter-htmlextra`) as a CI artifact.
- Include a “no token -> UNAUTHORIZED” request.
- Include a “conflict -> SCHEDULE_CONFLICT” request.

---

## 4. Compatibility verification (npm peer dependencies)

Checked against the npm registry on 2026-11-08. Pin exact versions and commit lockfiles.

| Package | Version | Peer/notes | Status |
|---|---:|---|---|
| `@nestjs/core` / `common` | 12.4.0 | Nest 12 line | Verified |
| `@nestjs/graphql` | 14.2.0 | `graphql ^16.11 \|\| ^17`, `typescript ^5.5 \|\| ^6`, Nest `^12` | Verified |
| `@nestjs/apollo` | 14.2.0 | `@apollo/server ^5`, `graphql ^16.10 \|\| ^17`, Nest `^12` | Verified |
| `@apollo/server` | 5.5.1 | `graphql ^16.11` only | Verified; pin GraphQL 16.15 |
| `graphql` | 16.15.0 | Apollo 5 peer | Verified |
| `@as-integrations/express5` | 1.1.2 | Required by `@nestjs/apollo` 14 | Verified |
| `@escape.tech/graphql-armor` | 3.2.0 | `@apollo/server ^4 \|\| ^5`, `@envelop/core ^5` | Verified |
| `@envelop/core` | 5.6.1 | Armor peer; do not use 6.x | Verified |
| `@nestjs/bullmq` | 12.0.1 | `bullmq ^3–^6`, Nest `^10–^12` | Verified |
| `bullmq` | 6.7.2 | `ioredis >=5` (optional peer) | Verified; ioredis 6 okay |
| `ioredis` | 6.0.0 | Cache client; BullMQ can use its own | Verified |
| `nestjs-pino` | 5.3.1 | Nest `^11.0.8 \|\| ^12.0.2`, pino `^10`, pino-http `^11` | Verified |
| `@bull-board/nestjs` | 9.11.0 | Nest `^9–^12`, `@bull-board/api ^9.11`, `@nestjs/bull-shared ^10–^12` | Verified |
| `@nestjs-modules/mailer` | 4.0.0 | Nest `>=7`, `nodemailer >=8.0.5`, `handlebars >=4.7.10`; optional peers | Verified; test the API |
| `@nestjs/terminus` | 12.1.0 | Nest `^11 \|\| ^12`; optional `@prisma/client` | Verified |
| `@nestjs/config` | 12.1.1 | Nest `^11 \|\| ^12` | Verified |
| `@nestjs/jwt` | 12.0.4 | Nest `^8–^12` | Verified |
| `prisma` / `@prisma/client` | 7.10.1 | TypeScript `>=5.4` | Verified |
| `typescript-eslint` | 8.72.1 | ESLint `^8.57 \|\| ^9 \|\| ^10`, TS `<6.1` | Verified |
| `ts-jest` | 29.4.15 | Jest `^29 \|\| ^30`, TS `<7` | Verified |
| `jest` | 30.5.2 | ts-jest supports it | Verified |
| `typescript` | 6.0.3 | Nest/GraphQL/ts-jest support it | Verified |
| `eslint` | 10.14.0 | typescript-eslint supports it | Verified |

### 4.1 Additional dependencies the plan should list

- `dotenv` — required by `prisma.config.ts` when loading `.env`.
- `@nestjs/throttler` — rate limiting.
- `@bull-board/api`, `@nestjs/bull-shared` — Bull Board peers.
- `newman`, `newman-reporter-htmlextra` — smoke suite and HTML report.
- `jest-mock-extended` (optional) — typed Prisma mocks.
- `graphql-inspector` / `@graphql-inspector/cli` — schema diff in CI.
- `gitleaks` (CI binary, not npm) — secret scanning.
- `@types/node` — match Node 24.

### 4.2 Phase 0 compatibility gates

Run these before writing feature code:

1. `nest build` with Prisma 7 `prisma-client` generator under CommonJS.
2. `prisma migrate deploy` + seed in a clean container.
3. GraphQL code-first schema generation + GraphiQL.
4. Apollo Server 5 + `@as-integrations/express5` boots.
5. GraphQL Armor plugin loads.
6. Apollo CSRF behavior with Postman/GraphiQL.
7. `GraphQLError` with `extensions.http.status` returns the expected HTTP status.
8. Jest 30 + ts-jest 29 runs a Nest test.
9. Native `bcrypt` builds in the multi-stage image.
10. `@nestjs-modules/mailer` sends through Mailpit.
11. BullMQ worker connects and processes a job.
12. Bull Board mounts.
13. Postgres healthcheck waits for both databases.
14. `@nestjs/throttler` works with GraphQL context.

If any gate fails, use the documented fallback before proceeding:

| Gate | Fallback |
|---|---|
| Prisma 7 CJS | `prisma-client-js` generator, or ESM + Vitest |
| GraphQL Armor | Manual depth/alias validation plugin |
| Mailer module | Direct `nodemailer` service |
| Bull Board | `@bull-board/express` mounted manually |
| Native bcrypt | `bcryptjs` |
| Throttler GraphQL | Custom guard with an in-memory/Redis counter |

---

## 5. Revised execution plan and hard gates

The original single-day phases are sound. Add these gates and adjust the order slightly so the demo path exists early.

| Phase | Time | Focus | Hard gate |
|---|---:|---|---|
| 0 | 0:00–1:00 | Spike + scaffold | All 14 compatibility gates pass or fallback chosen |
| 1 | 1:00–2:30 | Auth service | register/login/validateToken + tests |
| 2 | 2:30–4:30 | Schedule core | CRUD + auth guard + conflict + pagination/filter + tests |
| 3 | 4:30–5:15 | Cache | Hit/miss observable; invalidation works; Redis-down fallback |
| 4 | 5:15–6:45 | Queue + notification | Create/delete emails visible in Mailpit; retries/DLQ |
| 5 | 6:45–7:45 | Tests + coverage | Each service >= 50%, target 80% |
| 6 | 7:45–9:00 | Docker + CI + security | Clean-clone `docker compose up --build`; CI config valid |
| 7 | 9:00–10:30 | Docs + ADRs + Postman + proof pack | README is sufficient without questions |
| 8 | 10:30–11:30 | Clean-clone validation + release | Demo script passes from a fresh clone; `v1.0.0` |
| Buffer | 11:30–12:00 | Fixes | No new features |

### 5.1 Freeze rule

At the start of Phase 6, **freeze features**. From that point:

- No new endpoints.
- No schema changes unless a bug requires it.
- Only tests, docs, Docker, CI, and demo polish.

### 5.2 Cut line

If time is short:

**Never cut:**
- Auth + Schedule functionality.
- Docker one-command run.
- README quickstart.
- All five bonuses (they are 50 points).
- 50% coverage.
- No secrets.

**Cut first:**
- GraphQL Armor.
- Bull Board.
- Prometheus/Grafana profile.
- k6 load test.
- Multi-arch build.
- Some ADRs (keep the 4 most important: architecture, DB-per-service, auth delegation, cache/queue).
- Fancy dashboards.
- `docs/slo.md`, `docs/threat-model.md`.

**Cut last:**
- Mailpit proof.
- Coverage report.
- Postman collection.
- Demo script.
- CI badge.

---

## 6. Pre-flight checklists

### 6.1 Before writing code

- [ ] All 14 Phase 0 gates pass or fallbacks are chosen.
- [ ] `prisma.config.ts` works with and without `DATABASE_URL`.
- [ ] Seed compiles and runs in a clean container.
- [ ] Postgres healthcheck waits for both databases.
- [ ] `.env.example` has every variable, with comments.
- [ ] `JWT_SECRET` has no insecure default.
- [ ] `tsconfig` strict mode.
- [ ] ESLint/Prettier/commitlint/Husky installed.
- [ ] Branch `develop` exists.
- [ ] `.gitignore` excludes `.env`, `node_modules`, `dist`, `coverage`, `src/generated`.

### 6.2 Before the demo

- [ ] `docker compose down -v` then `docker compose up --build` works.
- [ ] All containers healthy.
- [ ] Seed data present.
- [ ] Login works with the documented credentials.
- [ ] All Schedule operations require a token.
- [ ] `createSchedule` sends an email.
- [ ] Duplicate `createSchedule` returns `SCHEDULE_CONFLICT`.
- [ ] `deleteSchedule` sends an email.
- [ ] `schedules` filter + pagination works.
- [ ] Redis cache keys exist and invalidate.
- [ ] Bull Board shows the job history.
- [ ] `/metrics` returns data.
- [ ] Audit log has rows.
- [ ] Coverage report exists.
- [ ] Postman/Newman passes.
- [ ] README quickstart matches reality.

### 6.3 Before submission

- [ ] Clean clone from GitHub.
- [ ] `cp .env.example .env`.
- [ ] `docker compose up --build`.
- [ ] Run the 5-minute demo script.
- [ ] Run Newman.
- [ ] Run the unit tests.
- [ ] Check coverage >= 50%.
- [ ] Check no secrets: `gitleaks detect`.
- [ ] Check `git log` is conventional and meaningful.
- [ ] Check `main` and `develop` exist; tag `v1.0.0`.
- [ ] Check README has all required sections.
- [ ] Check proof pack images/GIF/video.
- [ ] Check `CHANGELOG.md`.
- [ ] Check `SECURITY.md`, `CONTRIBUTING.md`, `CODEOWNERS`.
- [ ] Check `docs/roadmap.md` lists non-goals.
- [ ] Check `docs/runbooks/` exists.
- [ ] Check `contracts/*.graphql` matches the running schema.

### 6.4 Clean-clone test

```bash
git clone <repo-url> /tmp/healthcare-clean
cd /tmp/healthcare-clean
cp .env.example .env
docker compose up --build -d
# wait for health
curl -fsS http://localhost:3001/health
curl -fsS http://localhost:3002/health
curl -fsS http://localhost:3003/health
# run the demo and smoke suite
```

If this fails, the submission is not done.

---

## 7. Top 15 things not to miss

1. **Seed compilation** — `node dist/prisma/seed.js` must exist.
2. **Postgres init race** — wait for both databases, not just `pg_isready`.
3. **`timestamptz`** — do not store schedules in a timezone-naive column.
4. **GraphQL error HTTP status** — set `extensions.http.status` where promised.
5. **Apollo CSRF** — keep it on; document the `POST application/json` requirement.
6. **Redis connection split** — cache client vs BullMQ worker client.
7. **Redis memory policy** — do not let cache growth break the queue.
8. **Audit transactionality** — mutation + audit in one transaction.
9. **Job idempotency + DLQ** — no duplicate emails; failed jobs are inspectable.
10. **Mailpit API assertion** — automate the email proof.
11. **Test database isolation** — e2e tests must not touch dev data.
12. **Windows scripts** — npm scripts or PowerShell equivalents.
13. **Clean-clone test** — the only proof that matters.
14. **Proof pack** — screenshots/GIF/video for a reviewer who does not run Docker.
15. **Feature freeze** — stop adding features at Phase 6.

---

## 8. Decisions to lock now

| Decision | Recommendation | Why |
|---|---|---|
| Not-found behavior | Queries return `null`; mutations/relations throw domain errors | Idiomatic GraphQL and consistent error table |
| Pagination invalid input | Reject with `VALIDATION_ERROR` (do not silently clamp) | Predictable API |
| Password policy | Min 8 chars, max 72 bytes, no strict composition | Avoid bcrypt truncation and reviewer friction |
| JWT claims | `sub`, `email`, `iat`, `exp`, `iss`, `aud`, `HS256` | Standard and verifiable |
| Customer double-booking | Document as a non-goal | Not required by the brief |
| Schedule update | Do not implement | Not in the brief’s operation table |
| Redis topology | Two instances in prod; one instance with a documented caveat for local | Avoid cache/queue memory conflict |
| Mail display timezone | `MAIL_TIMEZONE=Asia/Jakarta` (or `UTC`) | Indonesian reviewer context; explicit |
| Email uniqueness | Lowercase normalization + DB-level unique index | Prevent case-variant duplicates |
| Audit failure | Fail the mutation if the audit write fails | Healthcare-like integrity |
| GraphiQL in production | Disabled; introspection disabled | Security |
| Bull Board in production | Disabled by default | Operator-only tool |
| Rate limits | Global 100/min; auth 5/min per IP+email | Protect auth without breaking demo |
| CI security failures | Non-blocking for unfixable transitive issues; documented | Keep the pipeline useful |

---

## 9. Suggested additions to the repository

```text
docs/
├── demo.md
├── glossary.md
├── slo.md
├── threat-model.md
├── onboarding.md
├── troubleshooting.md
├── release-process.md
├── environments.md
├── api-versioning.md
├── proof/
│   ├── graphiql-auth.png
│   ├── graphiql-schedule.png
│   ├── mailpit-created.png
│   ├── mailpit-deleted.png
│   ├── bull-board.png
│   ├── coverage.png
│   ├── ci-green.png
│   ├── docker-compose-ps.png
│   ├── metrics.png
│   ├── audit-log.png
│   └── redis-keys.png
└── adr/
    └── template.md

scripts/
├── verify.sh
├── demo.sh
├── mailpit-assert.sh
├── schema-diff.sh
├── migration-diff.sh
└── wait-for-health.sh

postman/
├── Healthcare-Scheduling.postman_collection.json
├── Healthcare-Scheduling.postman_environment.json
└── README.md
```

Optional:

- `README.id.md` — Indonesian summary.
- `docs/proof/demo.mp4` or a Loom link.
- `docker-compose.ci.yml` — deterministic CI stack.
- `infra/prometheus/alerts.yml`.
- `infra/grafana/dashboards/healthcare.json`.

---

## 10. Final reviewer mapping

| Rubric aspect | What the reviewer will check | Where the proof lives |
|---|---|---|
| Functionality 30% | All operations, auth, conflict, pagination, filters | GraphiQL, Postman/Newman, e2e tests, demo |
| Code Quality 25% | Structure, naming, DTOs, repositories, error handling, no dead code | `src/` modules, lint config, ADRs |
| Architecture 20% | Service boundaries, DB-per-service, auth delegation, queue, cache | `docs/architecture.md`, Mermaid diagrams, compose |
| Docker 15% | One command, healthchecks, migrations, seed, non-root, volumes | `docker-compose.yml`, Dockerfiles, `docker compose ps` |
| Documentation 10% | README, diagram, env table, GraphQL examples, Postman | `README.md`, `docs/`, `postman/` |
| Email +15 | Create/delete emails visible | Mailpit screenshots + automated assertion |
| Queue +10 | BullMQ worker, retries, async behavior | Bull Board, logs, DLQ |
| Caching +10 | Redis cache, TTL, invalidation, fallback | Redis keys, metrics, tests |
| Testing +10 | >= 50% coverage, CI artifact | Coverage report, CI |
| API Docs +5 | GraphiQL descriptions, schema, examples | GraphiQL, `contracts/`, `docs/api.md` |

---

## 11. One-paragraph summary

The plan does not miss a required feature. It misses **runtime details that decide whether the delivery feels real**: the Prisma seed pipeline, the Postgres init race, `timestamptz`, GraphQL error/HTTP semantics, Redis memory and connection topology, queue idempotency and DLQ, audit transactionality, test-database isolation, Windows tooling, and reviewer evidence. Add those details, gate the risky integrations in Phase 0, freeze features at Phase 6, and prove everything from a clean clone. That is the difference between a complete assignment and a production-shaped delivery.
