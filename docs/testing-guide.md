# Reviewer testing guide

This guide covers the required API and the optional email, queue, caching, and testing features. Allow about 10 minutes for the manual walkthrough. The examples are for a **local development stack only**.

## 1. Start the project

Requirements: Docker Desktop with Compose. Node.js 24 is also needed for the automated acceptance and unit tests.

```sh
git clone https://github.com/doniyukri/healthcare-scheduling.git
cd healthcare-scheduling
git switch develop
cp .env.example .env
docker compose up --build -d
docker compose ps
```

On Windows PowerShell, use `Copy-Item .env.example .env` in place of `cp`. If `develop` has already been merged into `main`, the default branch can be used instead. Wait until the application containers are healthy; first startup builds images and applies database migrations. The local example configuration seeds demo data. The example credentials below are public development defaults, not production secrets.

| Endpoint | Purpose |
|---|---|
| [localhost:3000](http://localhost:3000) | Clinic staff interface |
| [localhost:3001/graphql](http://localhost:3001/graphql) | Auth GraphQL API |
| [localhost:3002/graphql](http://localhost:3002/graphql) | Schedule GraphQL API |
| [localhost:8025](http://localhost:8025) | Mailpit email inbox |
| [localhost:3001/health](http://localhost:3001/health), [localhost:3002/health](http://localhost:3002/health), [localhost:3003/health](http://localhost:3003/health) | Service readiness checks |

If a port is in use, change the corresponding host-port variable in `.env`; see the environment table in the README. If startup fails, inspect `docker compose logs --tail=100` and check that Docker Desktop is running. The default credentials only apply when demo seeding is enabled and the local configuration has not been changed.

## 2. Try the staff interface

1. Open [localhost:3000](http://localhost:3000) and sign in with `admin@clinic.local` / `Password123`, or the demo credentials you configured in `.env`.
2. Open **Patients**, add a patient using an email address you can identify in Mailpit, then open **Doctors** and add a doctor.
3. Open **Appointments**, select **New appointment**, choose that patient and doctor, enter a reason and date/time, and save. The time is entered in your browser's local timezone and stored in UTC.
4. Check the confirmation in [Mailpit](http://localhost:8025). Try another appointment for the same doctor at exactly the same time: it should be rejected as a conflict.
5. Cancel the appointment and check Mailpit again for the cancellation. Refresh the list and switch between sections to check that dates continue to render.

The interface provides the main workflow; customer and doctor updates, schedule filters, and single-record queries can be tested through GraphQL below. The appointment form currently lists up to the first 100 patients and doctors.

## 3. Test GraphQL manually

Use a GraphQL client, or the local GraphQL landing pages where available. Send requests as `POST` with `Content-Type: application/json`. In a GraphQL client, paste the operations below into the query editor. To test authentication, set the HTTP headers to `{"Authorization":"Bearer YOUR_TOKEN"}`; replace the placeholder with the token returned by login. The Schedule API delegates validation to Auth on each protected operation.

### Login and validate the token

Send to **Auth** (`http://localhost:3001/graphql`):

```graphql
mutation {
  login(input: { email: "admin@clinic.local", password: "Password123" }) {
    accessToken
    user { id email }
  }
}
```

Copy `accessToken`, set the bearer header, and send this query to Auth:

```graphql
query { validateToken { id email } }
```

It should return the authenticated user. Send a Schedule query without the bearer header, or with an invalid token, and check for `UNAUTHORIZED` in `errors[0].extensions.code`. Depending on the error, the HTTP status may also indicate failure; inspect the GraphQL response body.

### Create the records

With the same bearer header, send these operations to **Schedule** (`http://localhost:3002/graphql`). Use a unique patient email and save the two returned IDs:

```graphql
mutation {
  createCustomer(input: { name: "Test Patient", email: "reviewer-patient@example.com" }) {
    id name email
  }
}
```

```graphql
mutation { createDoctor(input: { name: "Test Doctor" }) { id name } }
```

```graphql
mutation {
  createSchedule(input: {
    customerId: "CUSTOMER_ID"
    doctorId: "DOCTOR_ID"
    objective: "Consultation"
    scheduledAt: "2030-01-01T09:00:00Z"
  }) {
    id scheduledAt customer { name email } doctor { name }
  }
}
```

Replace both IDs with the returned UUIDs. Save the schedule ID. The first creation should succeed; repeat the same mutation to see `SCHEDULE_CONFLICT`. A nonexistent valid customer or doctor UUID should produce the corresponding `CUSTOMER_NOT_FOUND` or `DOCTOR_NOT_FOUND` error.

### Query, update, and cancel

Replace `DOCTOR_ID` and query the appointment list with a filter and pagination:

```graphql
query {
  schedules(filter: { doctorId: "DOCTOR_ID", search: "Consultation" }, pagination: { page: 1, limit: 10 }) {
    items { id objective scheduledAt customer { name } doctor { name } }
    pageInfo { page limit total totalPages hasNextPage hasPreviousPage }
  }
}
```

You can also query `customer(id: "CUSTOMER_ID")`, `doctor(id: "DOCTOR_ID")`, and `schedule(id: "SCHEDULE_ID")` with the fields you need. Use `customers(pagination: {page: 1, limit: 10})` and `doctors(pagination: {page: 1, limit: 10})` to test the other paginated lists.

Update a patient or doctor, then repeat the schedule query to see the new name:

```graphql
mutation { updateCustomer(id: "CUSTOMER_ID", input: { name: "Updated Patient" }) { id name } }
```

```graphql
mutation { updateDoctor(id: "DOCTOR_ID", input: { name: "Updated Doctor" }) { id name } }
```

Cancel the schedule and verify both emails in Mailpit:

```graphql
mutation { deleteSchedule(id: "SCHEDULE_ID") { id } }
```

After cancellation, `deleteCustomer(id: "CUSTOMER_ID")` and `deleteDoctor(id: "DOCTOR_ID")` can remove the manual test records. Deleting a patient or doctor with an existing schedule is rejected to preserve referential integrity. The emails remain in Mailpit for inspection.

## 4. Run the automated acceptance test

With the stack running and Node.js installed, run from the repository root:

```sh
node scripts/acceptance.mjs
```

The script checks registration, login, protected access, patient and doctor CRUD, pagination, scheduling, filters, double-booking rejection, repeated cached reads, cache invalidation after updates, and confirmation and cancellation emails. A successful run prints `PASS`. It removes its patient, doctor, and appointment, but leaves its uniquely named test user; a failed run may leave additional test data. Override `AUTH_URL`, `SCHEDULE_URL`, or `MAILPIT_URL` if the stack uses non-default host ports.

For unit tests and coverage, run the following in **each** of `services/auth-service`, `services/schedule-service`, and `services/notification-service`:

```sh
npm ci
# Auth and Schedule only:
npm run prisma:generate
npm run test:cov
```

Skip `npm run prisma:generate` in Notification. Coverage is printed in the terminal and written to each service's `coverage/` directory. The reported percentage reflects the exclusions in that service's Jest configuration.

## 5. Inspect queue and cache

The confirmation and cancellation messages in Mailpit demonstrate the queue worker and SMTP path. For queue activity, inspect `docker compose logs notification-service`; jobs are retried after delivery failures. If Redis is unavailable **before** a job is enqueued, scheduling succeeds and the notification can be lost; this MVP does not use a transactional outbox.

For a cache check, query the same Schedule list twice, then inspect keys with `docker compose exec redis-cache redis-cli --scan --pattern 'schedule:v1:*'`. Update a patient or doctor and repeat the schedule query: the updated name should appear. The automated acceptance test covers this path.

## Stop the stack

```sh
docker compose down
```

This stops and removes the containers and network but **retains named volumes** and the data in them. Avoid `docker compose down -v` unless you deliberately want to delete the local databases, cached data, and queue data.
