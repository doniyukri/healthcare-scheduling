# Testing

The authoritative hands-on walkthrough is the [reviewer testing guide](testing-guide.md). The release gates are:

1. `docker compose config --quiet`
2. Lint, build, and coverage in every service.
3. A healthy rebuilt Compose stack.
4. `node scripts/acceptance.mjs` returning `PASS`.
5. A successful Postman collection run against the same stack.

## Service checks

Run in each service directory:

```sh
npm ci
npm run lint
npm run build
npm run test:cov
```

Run `npm run prisma:generate` before build/test in Auth and Schedule. Notification has no Prisma client. Jest enforces the configured coverage thresholds; the delivery requirement is at least 50% per service.

## Test layers

| Layer | Evidence |
|---|---|
| Unit | Domain behavior, validation, resilience, caching, queue production/consumption, mail rendering, and health checks. |
| Build/static | ESLint and strict TypeScript compilation. |
| Acceptance | Real GraphQL services, PostgreSQL, both Redis instances, BullMQ worker, and Mailpit API. |
| Postman | Reviewer-friendly chained API workflow with assertions and cleanup. |
| Manual UI | Staff sign-in, patient/doctor creation, appointment booking/conflict, cancellation, and Mailpit inspection. |

The acceptance and Postman runs intentionally leave a uniquely named Auth user because the brief does not define user deletion. Domain records created by a successful run are removed.

## CI

`.github/workflows/ci.yml` executes service lint, build, and coverage in a matrix and validates the Compose model. Coverage directories are uploaded as workflow artifacts for reviewer inspection.
