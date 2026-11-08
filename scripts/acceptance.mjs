import assert from 'node:assert/strict';
const auth = process.env.AUTH_URL || 'http://localhost:3001/graphql';
const schedule = process.env.SCHEDULE_URL || 'http://localhost:3002/graphql';
const mail = process.env.MAILPIT_URL || 'http://localhost:8025';
const email = `smoke-${Date.now()}@example.com`;
async function gql(url, query, variables = {}, token, expectedError) {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ query, variables }) });
  const body = await response.json();
  if (expectedError) { assert.equal(body.errors?.[0]?.extensions?.code, expectedError, JSON.stringify(body)); return; }
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  assert.ok(response.ok, `HTTP ${response.status}`);
  return body.data;
}
const account = { email, password: 'SmokeTestPassword123' };
const { register } = await gql(auth, 'mutation($input: RegisterInput!) { register(input: $input) { accessToken user { id } } }', { input: account });
const { login } = await gql(auth, 'mutation($input: LoginInput!) { login(input: $input) { accessToken user { id } } }', { input: account });
assert.equal(login.user.id, register.user.id);
const token = login.accessToken;
await gql(auth, '{ validateToken { id email } }', {}, token);
await gql(schedule, '{ doctors { items { id } } }', {}, undefined, 'UNAUTHORIZED');
await gql(schedule, '{ doctors { items { id } } }', {}, 'invalid', 'UNAUTHORIZED');
const customer = (await gql(schedule, 'mutation($input: CreateCustomerInput!) { createCustomer(input: $input) { id } }', { input: { name: 'Smoke Patient', email } }, token)).createCustomer;
const doctor = (await gql(schedule, 'mutation($input: CreateDoctorInput!) { createDoctor(input: $input) { id } }', { input: { name: 'Smoke Doctor' } }, token)).createDoctor;
await gql(schedule, 'mutation($id: ID!, $input: UpdateCustomerInput!) { updateCustomer(id: $id, input: $input) { id name } }', { id: customer.id, input: { name: 'Updated Patient' } }, token);
await gql(schedule, 'mutation($id: ID!, $input: UpdateDoctorInput!) { updateDoctor(id: $id, input: $input) { id name } }', { id: doctor.id, input: { name: 'Updated Doctor' } }, token);
assert.equal((await gql(schedule, 'query($id: ID!) { customer(id: $id) { name } }', { id: customer.id }, token)).customer.name, 'Updated Patient');
assert.equal((await gql(schedule, 'query($id: ID!) { doctor(id: $id) { name } }', { id: doctor.id }, token)).doctor.name, 'Updated Doctor');
for (const query of ['{ customers(pagination: { page: 1, limit: 1 }) { items { id } pageInfo { total } } }', '{ doctors(pagination: { page: 1, limit: 1 }) { items { id } pageInfo { total } } }']) await gql(schedule, query, {}, token);
const input = { customerId: customer.id, doctorId: doctor.id, objective: 'Smoke verification', scheduledAt: '2030-01-01T09:00:00.000Z' };
const create = 'mutation($input: CreateScheduleInput!) { createSchedule(input: $input) { id customer { name } doctor { name } } }';
const appointment = (await gql(schedule, create, { input }, token)).createSchedule;
const scheduleDetail = 'query($id: ID!) { schedule(id: $id) { id scheduledAt createdAt updatedAt customer { name createdAt } doctor { name createdAt } } }';
const scheduleList = 'query($filter: ScheduleFilterInput!) { schedules(filter: $filter) { items { id scheduledAt createdAt customer { name createdAt } doctor { name createdAt } } } }';
const filter = { doctorId: doctor.id };
for (let i = 0; i < 2; i++) {
  await gql(schedule, scheduleDetail, { id: appointment.id }, token);
  await gql(schedule, scheduleList, { filter }, token);
  await gql(schedule, 'query($id: ID!) { customer(id: $id) { id createdAt updatedAt } }', { id: customer.id }, token);
  await gql(schedule, 'query($id: ID!) { doctor(id: $id) { id createdAt updatedAt } }', { id: doctor.id }, token);
}
await gql(schedule, 'mutation($id: ID!, $input: UpdateCustomerInput!) { updateCustomer(id: $id, input: $input) { id } }', { id: customer.id, input: { name: 'Changed Patient' } }, token);
await gql(schedule, 'mutation($id: ID!, $input: UpdateDoctorInput!) { updateDoctor(id: $id, input: $input) { id } }', { id: doctor.id, input: { name: 'Changed Doctor' } }, token);
for (const result of [(await gql(schedule, scheduleDetail, { id: appointment.id }, token)).schedule, (await gql(schedule, scheduleList, { filter }, token)).schedules.items.find(item => item.id === appointment.id)]) {
  assert.equal(result.customer.name, 'Changed Patient', 'Schedule retained stale patient');
  assert.equal(result.doctor.name, 'Changed Doctor', 'Schedule retained stale doctor');
}
await gql(schedule, create, { input }, token, 'SCHEDULE_CONFLICT');
await gql(schedule, create, { input: { ...input, doctorId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } }, token, 'DOCTOR_NOT_FOUND');
assert.equal((await gql(schedule, 'query($id: ID!) { schedule(id: $id) { id } }', { id: appointment.id }, token)).schedule.id, appointment.id);
const filtered = await gql(schedule, 'query($filter: ScheduleFilterInput!) { schedules(filter: $filter, pagination: { page: 1, limit: 10 }) { items { id } pageInfo { total } } }', { filter: { doctorId: doctor.id, search: 'Smoke' } }, token);
assert.ok(filtered.schedules.items.some(item => item.id === appointment.id));
await gql(schedule, 'mutation($id: ID!) { deleteSchedule(id: $id) { id } }', { id: appointment.id }, token);
await gql(schedule, 'mutation($id: ID!) { deleteCustomer(id: $id) { id } }', { id: customer.id }, token);
await gql(schedule, 'mutation($id: ID!) { deleteDoctor(id: $id) { id } }', { id: doctor.id }, token);
let messages = [];
for (let i = 0; i < 20; i++) {
  const result = await fetch(`${mail}/api/v1/search?query=${encodeURIComponent(email)}`).then(r => r.json());
  messages = result.messages || [];
  if (messages.length >= 2) break;
  await new Promise(resolve => setTimeout(resolve, 500));
}
assert.ok(messages.some(item => /confirmation/i.test(item.Subject)), 'Confirmation email missing');
assert.ok(messages.some(item => /cancelled/i.test(item.Subject)), 'Cancellation email missing');
console.log('PASS: auth, protected access, customer and doctor CRUD, pagination, schedule filters, conflict, validation, create/delete and both emails.');
console.log(`A test account remains: ${email}`);
