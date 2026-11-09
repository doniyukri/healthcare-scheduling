# Operations

## Start and stop

Copy `.env.example` to `.env`, then start the complete local stack:

```sh
docker compose up --build -d
docker compose ps
```

All application services should become healthy. Stop containers without deleting data with `docker compose down`. Named volumes retain both databases and Redis data. `docker compose down -v` permanently removes local stack data and should only be used for an intentional reset.

## Health and diagnostics

| Check | URL or command |
|---|---|
| Auth readiness | `http://localhost:3001/health` |
| Schedule readiness | `http://localhost:3002/health` |
| Notification readiness | `http://localhost:3003/health` |
| Container state | `docker compose ps` |
| Recent logs | `docker compose logs --tail=100 SERVICE` |
| Live acceptance | `node scripts/acceptance.mjs` |
| Metrics | `/metrics` on each service when `METRICS_ENABLED=true` |

Logs are structured and include service and request identifiers. Do not place passwords, bearer tokens, or patient data in diagnostic commands or tickets.

## Migrations and seed data

Auth and Schedule run `prisma migrate deploy` in their container entrypoints before starting. With `SEED_DEMO_DATA=true`, the entrypoints also apply idempotent local demo seeding. A migration failure keeps the service from reporting healthy; inspect its logs before retrying.

## Degraded dependencies

- **Auth unavailable:** Schedule rejects protected operations after its timeout/retry/circuit-breaker policy. Confirm Auth health and connectivity; do not bypass token validation.
- **Cache unavailable:** Schedule logs the Redis error and reads from PostgreSQL. Restore `redis-cache`; correctness is preserved at higher latency.
- **Queue unavailable before enqueue:** Scheduling still succeeds, but that notification can be lost. Restore `redis-queue` and document affected appointments; v1.0.0 has no transactional outbox.
- **SMTP unavailable after enqueue:** BullMQ retries with backoff and ultimately records a failed job. Restore Mailpit/SMTP and inspect notification logs.
- **Database unavailable:** The owning service becomes unhealthy. Restore PostgreSQL and allow health checks to recover before sending traffic.

## Audit records

Schedule mutations write their audit record in the same PostgreSQL transaction as the domain change. The table is an operational record and is not exposed through the public GraphQL API in v1.0.0. Query it only through controlled database access and avoid exporting sensitive payloads.

## Backup and restore

Production backup automation is deployment-specific and outside this local Compose delivery. Before any restore, stop writes, verify the target database (`auth_db` or `schedule_db`), and retain the pre-restore backup. Never restore one service's data into the other service's database.
