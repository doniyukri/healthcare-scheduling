const auth = 'http://localhost:3001/graphql';
const schedule = 'http://localhost:3002/graphql';
const email = `mvp-${Date.now()}@example.com`;
async function gql(url, query, variables = {}, token) {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ query, variables }) });
  const body = await response.json();
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  return body.data;
}
const { register } = await gql(auth, 'mutation($input: RegisterInput!) { register(input: $input) { accessToken } }', { input: { email, password: 'DemoPassword123' } });
const token = register.accessToken;
await gql(auth, '{ validateToken { id email } }', {}, token);
const { createCustomer } = await gql(schedule, 'mutation($input: CreateCustomerInput!) { createCustomer(input: $input) { id } }', { input: { name: 'MVP Test Patient', email } }, token);
const { createDoctor } = await gql(schedule, 'mutation($input: CreateDoctorInput!) { createDoctor(input: $input) { id } }', { input: { name: 'MVP Test Doctor' } }, token);
const input = { customerId: createCustomer.id, doctorId: createDoctor.id, objective: 'MVP verification', scheduledAt: '2030-01-01T09:00:00.000Z' };
const { createSchedule } = await gql(schedule, 'mutation($input: CreateScheduleInput!) { createSchedule(input: $input) { id customer { name } doctor { name } } }', { input }, token);
const { schedules } = await gql(schedule, '{ schedules { items { id } pageInfo { total } } }', {}, token);
if (!schedules.items.some(item => item.id === createSchedule.id)) throw new Error('Created schedule missing from list');
await gql(schedule, 'mutation($id: ID!) { deleteSchedule(id: $id) { id } }', { id: createSchedule.id }, token);
console.log(JSON.stringify({ email, scheduleId: createSchedule.id, result: 'registration, bearer validation, customer, doctor, create/list/delete schedule passed' }));
