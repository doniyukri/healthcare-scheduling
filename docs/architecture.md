# Architecture

The system uses service-owned data and synchronous authentication delegation. Email delivery and response caching are optional infrastructure paths: an outage in either must not prevent the core scheduling database operation.

```mermaid
flowchart LR
  Browser[Clinic staff UI] --> Auth[Auth service :3001]
  Browser --> Schedule[Schedule service :3002]
  Schedule -->|validateToken GraphQL query| Auth
  Auth --> AuthDB[(auth_db)]
  Schedule --> ScheduleDB[(schedule_db)]
  Schedule <--> Cache[(Redis cache)]
  Schedule --> Queue[(Redis / BullMQ)]
  Queue --> Worker[Notification service :3003]
  Worker --> Mailpit[Mailpit SMTP + inbox]
```

## Service boundaries

| Component | Owns | Does not own |
|---|---|---|
| Auth service | Users, password hashes, JWT issuance and validation | Clinic or appointment data |
| Schedule service | Customers, doctors, schedules, audit records | User credentials or email transport |
| Notification service | Queue consumption and email rendering/delivery | Scheduling state |
| Web | Staff workflow and presentation | Durable business data |

Auth and Schedule use separate Prisma schemas and PostgreSQL databases. Schedule accepts a bearer token only after Auth validates its signature, expiry, issuer, audience, and user existence. A timeout, bounded retry, and circuit breaker keep Auth failures from indefinitely consuming Schedule resources.

## Appointment creation

```mermaid
sequenceDiagram
  participant C as Client
  participant S as Schedule
  participant A as Auth
  participant D as Schedule DB
  participant Q as BullMQ
  participant N as Notification worker
  participant M as Mailpit

  C->>S: createSchedule + bearer token
  S->>A: validateToken
  A-->>S: authenticated user
  S->>D: transaction: schedule + audit entry
  D-->>S: committed schedule
  S->>Q: enqueue schedule.created
  S-->>C: schedule
  Q-->>N: job
  N->>M: confirmation email
```

The database uniqueness constraint is the final double-booking guard, so concurrent requests cannot reserve the same doctor and timestamp. Queue publication is best-effort after the transaction; a transactional outbox is deliberately deferred to the roadmap.

## Cache consistency

List and detail reads use versioned Redis keys with bounded TTLs. Mutations increment the affected namespace version instead of scanning and deleting keys. Customer and doctor updates also invalidate schedule reads because those responses embed related names. When Redis is unavailable, requests continue against PostgreSQL.

## Deployment model

`docker-compose.yml` is the local deployment contract. Each Node image is multi-stage, runs as a non-root user under `tini`, and exposes a health check. Startup entrypoints deploy Prisma migrations before starting Auth or Schedule; optional demo seeding is idempotent.
