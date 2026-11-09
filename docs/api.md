# GraphQL API

Auth is available at `http://localhost:3001/graphql`; Schedule is available at `http://localhost:3002/graphql`. Send JSON requests with `Content-Type: application/json`. Every Schedule operation requires `Authorization: Bearer <token>`.

The generated GraphQL schema contains descriptions for operations, inputs, arguments, and returned types. Local development enables the Apollo landing page and introspection; production disables Auth introspection by default.

## Error contract

GraphQL failures use `errors[0].extensions.code`. Important domain codes include:

| Code | Meaning |
|---|---|
| `UNAUTHORIZED` | Bearer token is missing, invalid, expired, or rejected by Auth. |
| `BAD_USER_INPUT` | Input validation failed. |
| `EMAIL_ALREADY_EXISTS` | Registration or customer email conflicts with an existing record. |
| `CUSTOMER_NOT_FOUND`, `DOCTOR_NOT_FOUND`, `SCHEDULE_NOT_FOUND` | A referenced record does not exist. |
| `SCHEDULE_CONFLICT` | The doctor already has an appointment at that timestamp. |
| `RESOURCE_IN_USE` | A customer or doctor still has schedules and cannot be deleted. |
| `AUTH_SERVICE_UNAVAILABLE` | Auth delegation failed after the configured resilience policy. |

Successful GraphQL responses use HTTP 200 and return data under `data`. Clients must inspect the `errors` member instead of relying only on HTTP status.

## Auth operations

```graphql
mutation Register($input: RegisterInput!) {
  register(input: $input) { accessToken user { id email createdAt } }
}

mutation Login($input: LoginInput!) {
  login(input: $input) { accessToken user { id email } }
}

query ValidateToken {
  validateToken { id email }
}
```

`RegisterInput` and `LoginInput` contain `email` and `password`. Registration normalizes email addresses and requires a password between 8 characters and 72 bytes.

## Customer operations

```graphql
query Customers($filter: CustomerFilterInput, $pagination: PaginationInput) {
  customers(filter: $filter, pagination: $pagination) {
    items { id name email createdAt updatedAt }
    pageInfo { page limit total totalPages hasNextPage hasPreviousPage }
  }
}

mutation CreateCustomer($input: CreateCustomerInput!) {
  createCustomer(input: $input) { id name email }
}

mutation UpdateCustomer($id: ID!, $input: UpdateCustomerInput!) {
  updateCustomer(id: $id, input: $input) { id name email }
}

mutation DeleteCustomer($id: ID!) {
  deleteCustomer(id: $id) { id }
}
```

Customers support single-record lookup with `customer(id: ID!)`. The list filter accepts case-insensitive `search` and exact `email` fields.

## Doctor operations

```graphql
query Doctors($filter: DoctorFilterInput, $pagination: PaginationInput) {
  doctors(filter: $filter, pagination: $pagination) {
    items { id name createdAt updatedAt }
    pageInfo { page limit total totalPages hasNextPage hasPreviousPage }
  }
}

mutation CreateDoctor($input: CreateDoctorInput!) {
  createDoctor(input: $input) { id name }
}

mutation UpdateDoctor($id: ID!, $input: UpdateDoctorInput!) {
  updateDoctor(id: $id, input: $input) { id name }
}

mutation DeleteDoctor($id: ID!) {
  deleteDoctor(id: $id) { id }
}
```

Doctors support single-record lookup with `doctor(id: ID!)`. The list filter accepts a case-insensitive `search` field.

## Schedule operations

```graphql
query Schedules($filter: ScheduleFilterInput, $pagination: PaginationInput) {
  schedules(filter: $filter, pagination: $pagination) {
    items {
      id objective scheduledAt
      customer { id name email }
      doctor { id name }
    }
    pageInfo { page limit total totalPages hasNextPage hasPreviousPage }
  }
}

mutation CreateSchedule($input: CreateScheduleInput!) {
  createSchedule(input: $input) {
    id objective scheduledAt customer { name email } doctor { name }
  }
}

mutation DeleteSchedule($id: ID!) {
  deleteSchedule(id: $id) { id }
}
```

`CreateScheduleInput` requires `objective`, `customerId`, `doctorId`, and an ISO-8601 `scheduledAt` timestamp. Schedule filters accept `doctorId`, `customerId`, inclusive `from`/`to` timestamps, and objective `search`. A single schedule is available through `schedule(id: ID!)`.

Creating and deleting a schedule writes a transactional audit record and asynchronously queues an email. Email delivery failure does not roll back the committed schedule change.

## Postman

Import `postman/Healthcare-Scheduling.postman_collection.json` and `postman/Local.postman_environment.json`. Select the Local environment and run the complete collection. Its scripts generate unique data, carry the JWT and record IDs between requests, assert the expected responses, and clean up the schedule, customer, and doctor. The generated test user remains because the API intentionally has no user-delete operation.
